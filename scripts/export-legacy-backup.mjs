// SPDX-License-Identifier: MPL-2.0
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const zip = new JSZip();
const folders = ['projects', 'templates', 'brands'];
const counts = { projects: 0, templates: 0, brands: 0, assets: 0 };

for (const folder of folders) {
  const directory = path.join(root, 'data', folder);
  let entries = [];
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { /* carpeta aún no creada */ }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === '.gitkeep') continue;
    const content = await readFile(path.join(directory, entry.name));
    zip.file(`${folder}/${entry.name}`, content);
    counts[folder] += 1;
  }
}

const assetsDirectory = path.join(root, 'data', 'assets');
let assetEntries = [];
try { assetEntries = await readdir(assetsDirectory, { withFileTypes: true }); } catch { /* carpeta aún no creada */ }
const assets = [];
for (const entry of assetEntries) {
  if (!entry.isFile() || entry.name === '.gitkeep') continue;
  const content = await readFile(path.join(assetsDirectory, entry.name));
  const type = entry.name.endsWith('.svg') ? 'image/svg+xml' : entry.name.endsWith('.png') ? 'image/png' : entry.name.endsWith('.webp') ? 'image/webp' : entry.name.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
  const assetPath = `assets/${entry.name}`;
  zip.file(assetPath, content);
  assets.push({ id: entry.name, name: entry.name, type, path: assetPath });
  counts.assets += 1;
}

zip.file('manifest.json', JSON.stringify({ format: 'fragua-browser-backup', version: 1, createdAt: new Date().toISOString(), migrationSource: 'local-data-folder', counts, assets }, null, 2));
const outputDirectory = path.join(root, 'data', 'exports');
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, `fragua-migracion-${new Date().toISOString().slice(0, 10)}.zip`);
await writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 4 } }));
console.log(`Respaldo listo: ${path.relative(root, outputPath)}`);
console.log(`Proyectos: ${counts.projects} · plantillas: ${counts.templates} · kits: ${counts.brands} · recursos: ${counts.assets}`);
