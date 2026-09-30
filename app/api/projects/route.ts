import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ensureDataDirs, projectDir, safeName } from '@/lib/storage';
export const runtime = 'nodejs';
export async function GET() { await ensureDataDirs(); const files = (await readdir(projectDir)).filter((file) => file.endsWith('.json')); const projects = await Promise.all(files.map(async (file) => { try { const value = JSON.parse(await readFile(path.join(projectDir, file), 'utf8')); return { id: file.slice(0, -5), name: value.name ?? file.slice(0, -5), updatedAt: value.updatedAt ?? '' }; } catch { return null; } })); return NextResponse.json(projects.filter(Boolean).sort((a, b) => (b?.updatedAt ?? '').localeCompare(a?.updatedAt ?? ''))); }
export async function POST(request: Request) { await ensureDataDirs(); const body = await request.json(); const id = safeName(body.id || body.name); const payload = { ...body, id, updatedAt: new Date().toISOString() }; await writeFile(path.join(projectDir, `${id}.json`), JSON.stringify(payload, null, 2), 'utf8'); return NextResponse.json({ id, updatedAt: payload.updatedAt }); }
