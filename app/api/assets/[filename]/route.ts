import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { assetDir, ensureDataDirs } from '@/lib/storage';
export const runtime = 'nodejs';
const MIME: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) { await ensureDataDirs(); const { filename } = await context.params; const clean = path.basename(filename); if (clean !== filename) return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 }); try { const bytes = await readFile(path.join(assetDir, clean)); return new NextResponse(bytes, { headers: { 'content-type': MIME[path.extname(clean).toLowerCase()] || 'application/octet-stream', 'cache-control': 'public, max-age=31536000, immutable' } }); } catch { return NextResponse.json({ error: 'Recurso no encontrado' }, { status: 404 }); } }
