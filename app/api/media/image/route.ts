import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { assetDir, ensureDataDirs, safeName } from '@/lib/storage';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  const { url, name = 'pexels' } = await request.json();
  if (!/^https:\/\/images\.pexels\.com\//.test(url ?? '')) return NextResponse.json({ error: 'Origen no permitido' }, { status: 400 });
  const response = await fetch(url); if (!response.ok) return NextResponse.json({ error: 'No se pudo descargar' }, { status: 502 });
  await ensureDataDirs(); const bytes = Buffer.from(await response.arrayBuffer()); const filename = `${safeName(name)}-${Date.now()}.jpg`;
  await writeFile(path.join(assetDir, filename), bytes);
  return NextResponse.json({ filename, src: `/api/assets/${encodeURIComponent(filename)}` });
}
