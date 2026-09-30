'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { AlignCenter, BringToFront, Circle, Copy, Download, FolderOpen, ImagePlus, Layers3, Redo2, Save, SendToBack, Square, Trash2, Type, Undo2 } from 'lucide-react';

type ProjectListItem = { id: string; name: string; updatedAt: string };
type StockImage = { id: number; alt: string; photographer: string; thumb: string; full: string };
type Inspector = { fill: string; opacity: number; angle: number; fontSize: number; isText: boolean };
const SIZES = [{ name: 'Cuadrado', w: 1080, h: 1080 }, { name: 'Historia', w: 1080, h: 1920 }, { name: 'Horizontal', w: 1200, h: 630 }, { name: 'A4', w: 1240, h: 1754 }];
const COLORS = ['#18181b', '#f8fafc', '#ff4d6d', '#ffb703', '#3a86ff', '#8338ec', '#06d6a0'];

export default function Editor() {
  const canvasNode = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<fabric.Canvas | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const restoring = useRef(false);
  const [name, setName] = useState('Mi diseño');
  const [projectId, setProjectId] = useState('');
  const [size, setSize] = useState({ w: 1080, h: 1080 });
  const [zoom, setZoom] = useState(56);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [layers, setLayers] = useState<fabric.FabricObject[]>([]);
  const [selected, setSelected] = useState(false);
  const [inspector, setInspector] = useState<Inspector>({ fill: '#18181b', opacity: 100, angle: 0, fontSize: 72, isText: false });
  const [status, setStatus] = useState('Listo');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [mediaQuery, setMediaQuery] = useState('texturas abstractas');
  const [media, setMedia] = useState<StockImage[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const syncUi = useCallback(() => {
    const c = canvas.current; if (!c) return;
    setLayers([...c.getObjects()].reverse());
    const o = c.getActiveObject(); setSelected(Boolean(o));
    if (o) setInspector({ fill: typeof o.fill === 'string' ? o.fill : '#18181b', opacity: Math.round((o.opacity ?? 1) * 100), angle: Math.round(o.angle ?? 0), fontSize: 'fontSize' in o ? Number(o.fontSize) : 72, isText: o.type === 'textbox' || o.type === 'i-text' });
  }, []);

  const snapshot = useCallback(() => {
    if (restoring.current || !canvas.current) return;
    const next = JSON.stringify(canvas.current.toJSON());
    if (history.current[historyIndex.current] === next) return;
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(next); if (history.current.length > 40) history.current.shift();
    historyIndex.current = history.current.length - 1;
    setCanUndo(historyIndex.current > 0); setCanRedo(false); syncUi();
  }, [syncUi]);

  useEffect(() => {
    if (!canvasNode.current) return;
    const c = new fabric.Canvas(canvasNode.current, { width: size.w, height: size.h, backgroundColor: '#ffffff', preserveObjectStacking: true, selectionColor: 'rgba(255,77,109,.12)', selectionBorderColor: '#ff4d6d' });
    canvas.current = c;
    c.on('object:added', snapshot); c.on('object:modified', snapshot); c.on('object:removed', snapshot);
    c.on('selection:created', syncUi); c.on('selection:updated', syncUi); c.on('selection:cleared', syncUi);
    snapshot(); void refreshProjects();
    return () => { c.dispose(); canvas.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshProjects() { try { setProjects(await (await fetch('/api/projects')).json()); } catch { setStatus('No pude leer los proyectos'); } }
  function add(object: fabric.FabricObject) { const c = canvas.current; if (!c) return; c.add(object); c.centerObject(object); c.setActiveObject(object); c.requestRenderAll(); syncUi(); }
  function addText() { add(new fabric.Textbox('Escribe aquí', { width: 620, fontSize: 92, fontWeight: 700, fontFamily: 'Arial', fill: '#18181b', textAlign: 'center', originX: 'center', originY: 'center' })); }
  function addRect() { add(new fabric.Rect({ width: 420, height: 280, rx: 24, ry: 24, fill: '#ff4d6d', originX: 'center', originY: 'center' })); }
  function addCircle() { add(new fabric.Circle({ radius: 180, fill: '#3a86ff', originX: 'center', originY: 'center' })); }
  async function uploadImage(file?: File) {
    if (!file) return; setStatus('Importando imagen…');
    const form = new FormData(); form.append('file', file);
    try { const result = await (await fetch('/api/assets', { method: 'POST', body: form })).json(); const image = await fabric.FabricImage.fromURL(result.dataUrl); const max = Math.min(700 / (image.width || 1), 700 / (image.height || 1), 1); image.scale(max); add(image); setStatus(`Guardada en data/assets/${result.filename}`); } catch { setStatus('No pude importar esa imagen'); }
  }
  async function searchMedia(e?: React.FormEvent) { e?.preventDefault(); if (!mediaQuery.trim()) return; setMediaLoading(true); setStatus('Buscando en Pexels…'); try { const result = await (await fetch(`/api/media/pexels?q=${encodeURIComponent(mediaQuery)}`)).json(); if (result.error) throw new Error(result.error); setMedia(result.photos); setStatus(`${result.photos.length} imágenes encontradas`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude buscar imágenes'); } finally { setMediaLoading(false); } }
  async function addStockImage(item: StockImage) { setStatus('Guardando imagen en assets…'); try { const result = await (await fetch('/api/media/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: item.full, name: item.alt || `pexels-${item.id}` }) })).json(); const image = await fabric.FabricImage.fromURL(result.dataUrl); const max = Math.min(800 / (image.width || 1), 800 / (image.height || 1), 1); image.scale(max); add(image); setStatus(`Crédito: ${item.photographer} · guardada en assets`); } catch { setStatus('No pude agregar esa imagen'); } }
  function remove() { const c = canvas.current; if (!c) return; c.getActiveObjects().forEach((o) => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); syncUi(); }
  async function duplicate() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active) return; const clone = await active.clone(); clone.set({ left: (active.left ?? 0) + 28, top: (active.top ?? 0) + 28 }); c.add(clone); c.setActiveObject(clone); c.requestRenderAll(); }
  async function travel(delta: number) { const c = canvas.current; const next = historyIndex.current + delta; if (!c || next < 0 || next >= history.current.length) return; restoring.current = true; historyIndex.current = next; await c.loadFromJSON(history.current[next]); c.requestRenderAll(); restoring.current = false; setCanUndo(next > 0); setCanRedo(next < history.current.length - 1); syncUi(); }
  function patchObject(values: Record<string, unknown>) { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; o.set(values); o.setCoords(); c.requestRenderAll(); snapshot(); syncUi(); }
  function resize(w: number, h: number) { const c = canvas.current; if (!c) return; c.setDimensions({ width: w, height: h }); setSize({ w, h }); c.requestRenderAll(); snapshot(); }
  function layer(action: 'front' | 'back') { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; action === 'front' ? c.bringObjectToFront(o) : c.sendObjectToBack(o); c.requestRenderAll(); snapshot(); }
  function center() { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; c.centerObject(o); o.setCoords(); c.requestRenderAll(); snapshot(); }
  async function saveProject() { const c = canvas.current; if (!c) return; setStatus('Guardando…'); const response = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: projectId, name, width: size.w, height: size.h, background: c.backgroundColor, canvas: c.toJSON() }) }); const result = await response.json(); setProjectId(result.id); setStatus(`Guardado en data/projects/${result.id}.json`); await refreshProjects(); }
  async function loadProject(id: string) { if (!id || !canvas.current) return; setStatus('Abriendo…'); const data = await (await fetch(`/api/projects/${id}`)).json(); restoring.current = true; resize(data.width, data.height); await canvas.current.loadFromJSON(data.canvas); canvas.current.backgroundColor = data.background; canvas.current.requestRenderAll(); restoring.current = false; setProjectId(data.id); setName(data.name); history.current = []; historyIndex.current = -1; snapshot(); syncUi(); setStatus('Proyecto abierto'); }
  async function exportPng() { const c = canvas.current; if (!c) return; c.discardActiveObject(); c.requestRenderAll(); const dataUrl = c.toDataURL({ format: 'png', multiplier: 1 }); setStatus('Exportando…'); const result = await (await fetch('/api/exports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name, dataUrl }) })).json(); const a = document.createElement('a'); a.href = dataUrl; a.download = result.filename; a.click(); setStatus(`Copia guardada en ${result.path}`); }

  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.matches('input, textarea, select')) return; if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); void travel(e.shiftKey ? 1 : -1); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveProject(); } if ((e.key === 'Delete' || e.key === 'Backspace')) remove(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">F</span><div><strong>Taller Fabric</strong><small>Editor local</small></div></div>
      <label className="project-name"><span>Nombre del proyecto</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="top-actions"><button className="button ghost" onClick={() => void saveProject()}><Save /> Guardar</button><button className="button primary" onClick={() => void exportPng()}><Download /> Exportar PNG</button></div>
    </header>
    <div className="workspace">
      <aside className="sidebar left-panel">
        <section><h2>Agregar</h2><div className="tool-grid"><button onClick={addText}><Type/><span>Texto</span></button><button onClick={addRect}><Square/><span>Rectángulo</span></button><button onClick={addCircle}><Circle/><span>Círculo</span></button><label className="tool"><ImagePlus/><span>Imagen</span><input type="file" accept="image/*" hidden onChange={(e) => void uploadImage(e.target.files?.[0])}/></label></div></section>
        <section><h2>Lienzo</h2><label className="field">Formato<select value={`${size.w}x${size.h}`} onChange={(e) => { const [w,h] = e.target.value.split('x').map(Number); resize(w,h); }}>{SIZES.map((s) => <option key={s.name} value={`${s.w}x${s.h}`}>{s.name} · {s.w}×{s.h}</option>)}</select></label><label className="field">Fondo<input type="color" value={String(canvas.current?.backgroundColor || '#ffffff')} onChange={(e) => { if (canvas.current) { canvas.current.backgroundColor = e.target.value; canvas.current.requestRenderAll(); snapshot(); } }}/></label></section>
        <section><h2>Banco de imágenes</h2><form className="media-search" onSubmit={(e) => void searchMedia(e)}><input aria-label="Buscar en Pexels" value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)} placeholder="Buscar fotos…"/><button disabled={mediaLoading}>{mediaLoading ? '…' : 'Buscar'}</button></form><div className="media-grid">{media.map((item) => <button key={item.id} onClick={() => void addStockImage(item)} title={`${item.alt} · ${item.photographer}`}><img src={item.thumb} alt={item.alt || `Foto de ${item.photographer}`}/><span>{item.photographer}</span></button>)}</div></section>
        <section><h2>Abrir proyecto</h2><select aria-label="Abrir proyecto" value="" onChange={(e) => void loadProject(e.target.value)}><option value="">Seleccionar…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="hint"><FolderOpen/> {projects.length} guardado{projects.length === 1 ? '' : 's'} localmente</p></section>
      </aside>
      <section className="stage-column">
        <div className="stage-toolbar"><div><button aria-label="Deshacer" disabled={!canUndo} onClick={() => void travel(-1)}><Undo2/></button><button aria-label="Rehacer" disabled={!canRedo} onClick={() => void travel(1)}><Redo2/></button><span className="divider"/><button aria-label="Duplicar" disabled={!selected} onClick={() => void duplicate()}><Copy/></button><button aria-label="Eliminar" disabled={!selected} onClick={remove}><Trash2/></button></div><label className="zoom">{zoom}%<input type="range" min="20" max="90" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}/></label></div>
        <div className="stage"><div className="canvas-frame" style={{ width: size.w * zoom / 100, height: size.h * zoom / 100 }}><div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}><canvas ref={canvasNode}/></div></div></div>
        <footer className="status"><span className="status-dot"/>{status}<span>{size.w} × {size.h}px</span></footer>
      </section>
      <aside className="sidebar right-panel">
        <section><h2>Propiedades</h2>{selected ? <><label className="field">Color<input type="color" value={inspector.fill} onChange={(e) => patchObject({ fill: e.target.value })}/></label>{inspector.isText && <label className="field">Tamaño<input type="number" min="8" max="500" value={inspector.fontSize} onChange={(e) => patchObject({ fontSize: Number(e.target.value) })}/></label>}<label className="field">Opacidad <span>{inspector.opacity}%</span><input type="range" min="5" max="100" value={inspector.opacity} onChange={(e) => patchObject({ opacity: Number(e.target.value) / 100 })}/></label><label className="field">Rotación <span>{inspector.angle}°</span><input type="range" min="-180" max="180" value={inspector.angle} onChange={(e) => patchObject({ angle: Number(e.target.value) })}/></label><div className="row"><button onClick={center}><AlignCenter/> Centrar</button><button onClick={() => layer('front')}><BringToFront/> Frente</button><button onClick={() => layer('back')}><SendToBack/> Fondo</button></div></> : <div className="empty">Selecciona un elemento para editarlo.</div>}</section>
        <section className="layers"><h2><Layers3/> Capas <span>{layers.length}</span></h2>{layers.length ? layers.map((o, i) => <button key={`${o.type}-${i}`} className={canvas.current?.getActiveObject() === o ? 'active' : ''} onClick={() => { canvas.current?.setActiveObject(o); canvas.current?.requestRenderAll(); syncUi(); }}><span className="layer-icon">{o.type === 'textbox' ? 'T' : o.type === 'image' ? 'IMG' : '◆'}</span><span>{o.type === 'textbox' ? String((o as fabric.Textbox).text).slice(0, 22) : o.type}</span></button>) : <div className="empty">Tu lienzo está vacío.</div>}</section>
        <section><h2>Paleta rápida</h2><div className="swatches">{COLORS.map((color) => <button key={color} aria-label={`Usar ${color}`} style={{ background: color }} onClick={() => selected ? patchObject({ fill: color }) : undefined}/>)}</div></section>
      </aside>
    </div>
  </main>;
}
