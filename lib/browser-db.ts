export type ProjectRecord = {
  id: string;
  name: string;
  updatedAt: string;
  width: number;
  height: number;
  background: string;
  canvas: object;
  pages: Array<{ id: string; name: string; w: number; h: number; bg: string; json: object; thumb?: string }>;
  activePageId?: string;
};

export type AssetRecord = { id: string; name: string; type: string; blob: Blob; createdAt: string };
export type LibraryRecord = { id: string; name: string; updatedAt: string; [key: string]: unknown };

// SPDX-License-Identifier: MPL-2.0
const DB_NAME = 'fragua-browser';
const DB_VERSION = 1;
const TABLES = ['projects', 'assets', 'templates', 'brands'] as const;
type TableName = (typeof TABLES)[number];
const objectUrls = new Map<string, string>();
const refsByUrl = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('Este navegador no tiene IndexedDB disponible.'));
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const table of TABLES) if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No pude abrir el almacenamiento local.'));
    request.onblocked = () => reject(new Error('Cierra otras pestañas de Fragua para actualizar el almacenamiento local.'));
  });
  return databasePromise;
}

function requestValue<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falló una operación de almacenamiento local.'));
  });
}

async function run<T>(table: TableName, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  const tx = db.transaction(table, mode);
  const done = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error || new Error('No se pudo completar el guardado local.'));
  });
  try {
    const value = await requestValue(action(tx.objectStore(table)));
    await done;
    return value;
  } catch (error) {
    await done.catch(() => undefined);
    throw error;
  }
}

function cleanId(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'sin-titulo';
}

export function createRecordId(name: string) {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${cleanId(name)}-${Date.now()}-${random}`;
}

export async function listProjects(): Promise<ProjectRecord[]> {
  const rows = await run<ProjectRecord[]>('projects', 'readonly', (store) => store.getAll());
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string) {
  return run<ProjectRecord | undefined>('projects', 'readonly', (store) => store.get(id));
}

export async function saveProject(record: Omit<ProjectRecord, 'updatedAt'> & { updatedAt?: string }) {
  const saved = { ...record, updatedAt: new Date().toISOString() };
  await run<IDBValidKey>('projects', 'readwrite', (store) => store.put(saved));
  return saved;
}

export async function listLibrary(table: 'templates' | 'brands'): Promise<LibraryRecord[]> {
  return run<LibraryRecord[]>(table, 'readonly', (store) => store.getAll());
}

export async function getLibrary(table: 'templates' | 'brands', id: string) {
  return run<LibraryRecord | undefined>(table, 'readonly', (store) => store.get(id));
}

export async function saveLibrary(table: 'templates' | 'brands', record: Omit<LibraryRecord, 'updatedAt'> & { updatedAt?: string }) {
  const saved = { ...record, updatedAt: new Date().toISOString() };
  await run<IDBValidKey>(table, 'readwrite', (store) => store.put(saved));
  return saved;
}

export async function deleteLibrary(table: 'templates' | 'brands', id: string) {
  await run<undefined>(table, 'readwrite', (store) => store.delete(id));
}

export function assetReference(id: string) { return `asset://${encodeURIComponent(id)}`; }

function legacyAssetId(src: string) {
  const match = src.match(/(?:^|\/)api\/assets\/([^/?#]+)/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

export async function saveAsset(blob: Blob, name: string, id = createRecordId(name)) {
  const record: AssetRecord = { id, name, type: blob.type || 'application/octet-stream', blob, createdAt: new Date().toISOString() };
  await run<IDBValidKey>('assets', 'readwrite', (store) => store.put(record));
  const url = URL.createObjectURL(blob);
  objectUrls.set(id, url);
  refsByUrl.set(url, assetReference(id));
  return { ...record, url, ref: assetReference(id) };
}

export async function getAssetUrl(id: string) {
  const cached = objectUrls.get(id);
  if (cached) return cached;
  const record = await run<AssetRecord | undefined>('assets', 'readonly', (store) => store.get(id));
  if (!record) return undefined;
  const url = URL.createObjectURL(record.blob);
  objectUrls.set(id, url);
  refsByUrl.set(url, assetReference(id));
  return url;
}

export async function getAsset(id: string) {
  return run<AssetRecord | undefined>('assets', 'readonly', (store) => store.get(id));
}

export async function listAssets() {
  return run<AssetRecord[]>('assets', 'readonly', (store) => store.getAll());
}

export function stableAssetReference(src: string) {
  if (refsByUrl.has(src)) return refsByUrl.get(src)!;
  if (src.startsWith('asset://')) return src;
  const legacyId = legacyAssetId(src);
  return legacyId ? assetReference(legacyId) : src;
}

export async function hydrateCanvasJSON<T>(value: T): Promise<T> {
  const copy = JSON.parse(JSON.stringify(value)) as unknown;
  const tasks: Promise<void>[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const item = node as Record<string, unknown>;
    if (typeof item.type === 'string' && item.type.toLowerCase() === 'image' && typeof item.src === 'string') {
      const ref = stableAssetReference(item.src);
      if (ref.startsWith('asset://')) {
        let id = ref.slice('asset://'.length);
        try { id = decodeURIComponent(id); } catch { /* conserva el id original */ }
        tasks.push(getAssetUrl(id).then((url) => { if (url) { item.src = url; item.crossOrigin = 'anonymous'; } }));
      } else if (/^https?:\/\//i.test(ref)) {
        item.src = ref;
        item.crossOrigin = 'anonymous';
      }
    }
    Object.values(item).forEach(visit);
  };
  visit(copy);
  await Promise.all(tasks);
  return copy as T;
}

export async function hydrateLibraryAsset(src: string) {
  const ref = stableAssetReference(src);
  if (!ref.startsWith('asset://')) return ref;
  let id = ref.slice('asset://'.length);
  try { id = decodeURIComponent(id); } catch { /* conserva el id original */ }
  return (await getAssetUrl(id)) || src;
}

export function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return Promise.resolve(false);
  return navigator.storage.persist();
}

export async function importAsset(id: string, file: Blob, name = id) {
  await saveAsset(file, name, id);
}
