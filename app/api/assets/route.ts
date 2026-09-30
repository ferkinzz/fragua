import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { assetDir, ensureDataDirs, safeName } from '@/lib/storage';
export const runtime = 'nodejs';
export async function POST(request: Request) { await ensureDataDirs(); const form = await request.formData(); const file = form.get('file'); if (!(file instanceof File)) return NextResponse.json({ error: 'Archivo requerido' }, { status: 400 }); const extension = path.extname(file.name).toLowerCase().replace(/[^.a-z0-9]/g, '') || '.png'; const filename = `${safeName(path.basename(file.name, path.extname(file.name)))}-${Date.now()}${extension}`; const bytes = Buffer.from(await file.arrayBuffer()); await writeFile(path.join(assetDir, filename), bytes); return NextResponse.json({ filename, src: `/api/assets/${encodeURIComponent(filename)}` }); }
