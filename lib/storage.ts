import { mkdir } from 'node:fs/promises';
import path from 'node:path';
export const dataRoot = path.join(process.cwd(), 'data');
export const projectDir = path.join(dataRoot, 'projects');
export const assetDir = path.join(dataRoot, 'assets');
export const exportDir = path.join(dataRoot, 'exports');
export async function ensureDataDirs() { await Promise.all([projectDir, assetDir, exportDir].map((dir) => mkdir(dir, { recursive: true }))); }
export function safeName(value: string, fallback = 'sin-titulo') { const clean = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80); return clean || fallback; }
