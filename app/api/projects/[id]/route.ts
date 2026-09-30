import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ensureDataDirs, projectDir, safeName } from '@/lib/storage';
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) { await ensureDataDirs(); const { id } = await context.params; try { const value = await readFile(path.join(projectDir, `${safeName(id)}.json`), 'utf8'); return new NextResponse(value, { headers: { 'content-type': 'application/json' } }); } catch { return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 }); } }
