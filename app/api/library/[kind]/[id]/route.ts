import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { brandDir, ensureDataDirs, safeName, templateDir } from '@/lib/storage';
export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) { await ensureDataDirs(); const { kind, id } = await context.params; const dir = kind === 'templates' ? templateDir : kind === 'brands' ? brandDir : null; if (!dir) return NextResponse.json({ error: 'Colección inválida' }, { status: 404 }); try { return NextResponse.json(JSON.parse(await readFile(path.join(dir, `${safeName(id)}.json`), 'utf8'))); } catch { return NextResponse.json({ error: 'No encontrado' }, { status: 404 }); } }
export async function DELETE(_request: Request, context: { params: Promise<{ kind: string; id: string }> }) { await ensureDataDirs(); const { kind, id } = await context.params; const dir = kind === 'templates' ? templateDir : kind === 'brands' ? brandDir : null; if (!dir) return NextResponse.json({ error: 'Colección inválida' }, { status: 404 }); try { await unlink(path.join(dir, `${safeName(id)}.json`)); return NextResponse.json({ deleted: true }); } catch { return NextResponse.json({ error: 'No encontrado' }, { status: 404 }); } }
