import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ensureDataDirs, exportDir, safeName } from '@/lib/storage';
export const runtime = 'nodejs';
export async function POST(request: Request) { await ensureDataDirs(); const { name, dataUrl } = await request.json(); const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl ?? ''); if (!match) return NextResponse.json({ error: 'Imagen inválida' }, { status: 400 }); const extension = match[1] === 'jpeg' ? 'jpg' : 'png'; const filename = `${safeName(name)}-${Date.now()}.${extension}`; await writeFile(path.join(exportDir, filename), Buffer.from(match[2], 'base64')); return NextResponse.json({ filename, path: `data/exports/${filename}` }); }
