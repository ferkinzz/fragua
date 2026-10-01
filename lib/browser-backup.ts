import JSZip from 'jszip';
import { createRecordId, importAsset, listAssets, listLibrary, listProjects, saveLibrary, saveProject, stableAssetReference, type LibraryRecord, type ProjectRecord } from './browser-db';

const BACKUP_FORMAT = 'fragua-browser-backup';
const BACKUP_VERSION = 1;

function jsonAssetRefs<T>(value: T): T {
  const copy = JSON.parse(JSON.stringify(value)) as unknown;
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const item = node as Record<string, unknown>;
    if (typeof item.type === 'string' && item.type.toLowerCase() === 'image' && typeof item.src === 'string') item.src = stableAssetReference(item.src);
    Object.values(item).forEach(visit);
  };
  visit(copy);
  return copy as T;
}

function safePath(value: string) { return value.replace(/[^a-zA-Z0-9._-]/g, '_'); }

export async function makeBrowserBackup() {
  const [projects, templates, brands, assets] = await Promise.all([listProjects(), listLibrary('templates'), listLibrary('brands'), listAssets()]);
  const zip = new JSZip();
  const assetManifest = assets.map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, path: `assets/${safePath(asset.id)}` }));
  zip.file('manifest.json', JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), counts: { projects: projects.length, templates: templates.length, brands: brands.length, assets: assets.length }, assets: assetManifest }, null, 2));
  projects.forEach((project) => zip.file(`projects/${safePath(project.id)}.json`, JSON.stringify(jsonAssetRefs(project), null, 2)));
  templates.forEach((template) => zip.file(`templates/${safePath(template.id)}.json`, JSON.stringify(template, null, 2)));
  brands.forEach((brand) => zip.file(`brands/${safePath(brand.id)}.json`, JSON.stringify(brand, null, 2)));
  assets.forEach((asset) => zip.file(`assets/${safePath(asset.id)}`, asset.blob));
  return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 4 } }), counts: { projects: projects.length, templates: templates.length, brands: brands.length, assets: assets.length } };
}

type BackupManifest = { format?: string; version?: number; assets?: Array<{ id: string; name?: string; type?: string; path?: string }> };

export async function restoreBrowserBackup(file: File) {
  if (file.name.toLowerCase().endsWith('.json')) {
    const data = JSON.parse(await file.text()) as ProjectRecord;
    if (typeof data.name !== 'string' || (!data.canvas && !Array.isArray(data.pages))) throw new Error('El JSON no parece un proyecto de Fragua.');
    const id = createRecordId(data.name);
    await saveProject({ ...data, id, canvas: jsonAssetRefs(data.canvas), pages: (data.pages || []).map((page) => ({ ...page, json: jsonAssetRefs(page.json) })) });
    return { projects: 1, templates: 0, brands: 0, assets: 0, jsonOnly: true };
  }
  if (!file.name.toLowerCase().endsWith('.zip')) throw new Error('El respaldo debe ser un .zip o un proyecto .json.');
  const zip = await JSZip.loadAsync(file);
  const manifestFile = zip.file('manifest.json');
  const manifest = manifestFile ? await manifestFile.async('string').then((text) => JSON.parse(text) as BackupManifest) : {};
  if (manifest.format && manifest.format !== BACKUP_FORMAT) throw new Error('El ZIP pertenece a otro formato de respaldo.');
  if (manifest.version && manifest.version > BACKUP_VERSION) throw new Error('Este respaldo fue creado por una versión más nueva de Fragua.');

  const assetMeta = new Map((manifest.assets || []).map((asset) => [asset.path || `assets/${safePath(asset.id)}`, asset]));
  let assetCount = 0;
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.startsWith('assets/')) continue;
    const metadata = assetMeta.get(path);
    const id = metadata?.id || path.slice('assets/'.length);
    const blob = await entry.async('blob');
    await importAsset(id, new Blob([blob], { type: metadata?.type || blob.type || 'application/octet-stream' }), metadata?.name || id);
    assetCount += 1;
  }

  let projectCount = 0; let templateCount = 0; let brandCount = 0;
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir || !path.endsWith('.json')) continue;
    const data = JSON.parse(await entry.async('string')) as Record<string, unknown>;
    if (path.startsWith('projects/')) {
      if (typeof data.name !== 'string' || (!data.canvas && !Array.isArray(data.pages))) continue;
      const id = createRecordId(data.name);
      const sourcePages = Array.isArray(data.pages) ? data.pages as ProjectRecord['pages'] : [];
      const project = { ...data, id, canvas: jsonAssetRefs(data.canvas), pages: sourcePages.map((page) => ({ ...page, json: jsonAssetRefs(page.json) })) } as ProjectRecord;
      await saveProject(project); projectCount += 1;
    } else if (path.startsWith('templates/') && typeof data.name === 'string') {
      const id = createRecordId(data.name);
      await saveLibrary('templates', { ...data, id, name: data.name } as LibraryRecord); templateCount += 1;
    } else if (path.startsWith('brands/') && typeof data.name === 'string') {
      const id = createRecordId(data.name);
      await saveLibrary('brands', { ...data, id, name: data.name } as LibraryRecord); brandCount += 1;
    }
  }
  if (!projectCount && !templateCount && !brandCount && !assetCount) throw new Error('No encontré proyectos, bibliotecas ni assets en ese respaldo.');
  return { projects: projectCount, templates: templateCount, brands: brandCount, assets: assetCount, jsonOnly: false };
}

export function backupFilename() { return `fragua-respaldo-${new Date().toISOString().slice(0, 10)}.zip`; }
