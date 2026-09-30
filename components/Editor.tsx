'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { enterCropMode } from 'fabric/extensions';
import { AlignCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, BringToFront, Circle, Copy, Crop, Download, FolderOpen, Group, ImagePlus, Layers3, Magnet, Redo2, Save, SendToBack, Square, Trash2, Type, Ungroup, Undo2 } from 'lucide-react';

type ProjectListItem = { id: string; name: string; updatedAt: string };
type StockImage = { id: number; alt: string; photographer: string; thumb: string; full: string };
type Inspector = { fill: string; opacity: number; angle: number; fontSize: number; isText: boolean; isImage: boolean; canRound: boolean; radius: number; shadowOn: boolean; shadowIntensity: number };
const SIZES = [{ name: 'Cuadrado', w: 1080, h: 1080 }, { name: 'Historia', w: 1080, h: 1920 }, { name: 'Horizontal', w: 1200, h: 630 }, { name: 'A4', w: 1240, h: 1754 }];
const COLORS = ['#18181b', '#f8fafc', '#ff4d6d', '#ffb703', '#3a86ff', '#8338ec', '#06d6a0'];

export default function Editor() {
  const canvasNode = useRef<HTMLCanvasElement>(null);
  const canvas = useRef<fabric.Canvas | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const restoring = useRef(false);
  const snapGuides = useRef<{ x?: number; y?: number }>({});
  const snappingRef = useRef(true);
  const [name, setName] = useState('Mi diseño');
  const [projectId, setProjectId] = useState('');
  const [size, setSize] = useState({ w: 1080, h: 1080 });
  const [customWidth, setCustomWidth] = useState('1080');
  const [customHeight, setCustomHeight] = useState('1080');
  const [zoom, setZoom] = useState(56);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [layers, setLayers] = useState<fabric.FabricObject[]>([]);
  const [selected, setSelected] = useState(false);
  const [selectionType, setSelectionType] = useState<'none' | 'single' | 'multiple' | 'group'>('none');
  const [snapping, setSnapping] = useState(true);
  const [inspector, setInspector] = useState<Inspector>({ fill: '#18181b', opacity: 100, angle: 0, fontSize: 72, isText: false, isImage: false, canRound: false, radius: 0, shadowOn: false, shadowIntensity: 45 });
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
    setSelectionType(!o ? 'none' : o.type === 'activeselection' ? 'multiple' : o.type === 'group' ? 'group' : 'single');
    if (o) {
      const imageClip = o.type === 'image' && o.clipPath?.type === 'rect' ? o.clipPath as fabric.Rect : null;
      const radiusPx = o.type === 'rect' ? Number((o as fabric.Rect).rx || 0) : Number(imageClip?.rx || 0);
      const radiusBase = Math.max(1, Math.min(Number(o.width || 1), Number(o.height || 1)) / 2);
      const shadow = o.shadow instanceof fabric.Shadow ? o.shadow : null;
      setInspector({ fill: typeof o.fill === 'string' ? o.fill : '#18181b', opacity: Math.round((o.opacity ?? 1) * 100), angle: Math.round(o.angle ?? 0), fontSize: 'fontSize' in o ? Number(o.fontSize) : 72, isText: o.type === 'textbox' || o.type === 'i-text', isImage: o.type === 'image', canRound: o.type === 'rect' || o.type === 'image', radius: Math.round(Math.min(100, radiusPx / radiusBase * 100)), shadowOn: Boolean(shadow), shadowIntensity: shadow ? Math.round(Math.max(0, Math.min(100, (shadow.blur - 4) / .3))) : 45 });
    }
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

  const attachCrop = useCallback((c: fabric.Canvas) => {
    c.getObjects('image').forEach((object) => {
      object.off('mousedblclick', enterCropMode);
      object.once('mousedblclick', enterCropMode);
    });
  }, []);

  const refreshCroppedImage = useCallback((object?: fabric.FabricObject) => {
    if (!object || object.type !== 'image') return;
    object.dirty = true;
    object.setCoords();
    object.canvas?.requestRenderAll();
  }, []);

  useEffect(() => {
    if (!canvasNode.current) return;
    const c = new fabric.Canvas(canvasNode.current, { width: size.w, height: size.h, backgroundColor: '#ffffff', preserveObjectStacking: true, selectionColor: 'rgba(255,77,109,.12)', selectionBorderColor: '#ff4d6d' });
    canvas.current = c;
    c.on('object:added', snapshot); c.on('object:modified', snapshot); c.on('object:removed', snapshot);
    c.on('selection:created', syncUi); c.on('selection:updated', syncUi); c.on('selection:cleared', syncUi);
    c.on('object:added', () => attachCrop(c));
    c.on('object:moving', (event) => {
      if (!snappingRef.current || !event.target) return;
      const object = event.target;
      const center = object.getCenterPoint();
      const threshold = 12;
      let snapX: number | undefined;
      let snapY: number | undefined;
      const xTargets = [c.width / 2];
      const yTargets = [c.height / 2];
      c.getObjects().filter((candidate) => candidate !== object).forEach((candidate) => {
        const point = candidate.getCenterPoint(); xTargets.push(point.x); yTargets.push(point.y);
      });
      const nearX = xTargets.find((value) => Math.abs(center.x - value) <= threshold);
      const nearY = yTargets.find((value) => Math.abs(center.y - value) <= threshold);
      if (nearX !== undefined) { snapX = nearX; object.setPositionByOrigin(new fabric.Point(nearX, object.getCenterPoint().y), 'center', 'center'); }
      if (nearY !== undefined) { snapY = nearY; object.setPositionByOrigin(new fabric.Point(object.getCenterPoint().x, nearY), 'center', 'center'); }
      snapGuides.current = { x: snapX, y: snapY }; c.requestRenderAll();
    });
    c.on('mouse:up', (event) => { snapGuides.current = {}; refreshCroppedImage(event.target); c.requestRenderAll(); });
    c.on('mouse:dblclick', (event) => {
      const target = event.target;
      requestAnimationFrame(() => refreshCroppedImage(target));
    });
    c.on('after:render', () => {
      const context = c.getTopContext(); const { x, y } = snapGuides.current;
      context.save(); context.strokeStyle = '#ff4d6d'; context.lineWidth = 2; context.setLineDash([10, 8]);
      if (x !== undefined) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, c.height); context.stroke(); }
      if (y !== undefined) { context.beginPath(); context.moveTo(0, y); context.lineTo(c.width, y); context.stroke(); }
      context.restore();
    });
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
    try { const result = await (await fetch('/api/assets', { method: 'POST', body: form })).json(); const image = await fabric.FabricImage.fromURL(result.dataUrl); const max = Math.min(700 / (image.width || 1), 700 / (image.height || 1), 1); image.scale(max); add(image); if (canvas.current) attachCrop(canvas.current); setStatus(`Guardada en data/assets/${result.filename} · doble clic para recortar`); } catch { setStatus('No pude importar esa imagen'); }
  }
  async function searchMedia(e?: React.FormEvent) { e?.preventDefault(); if (!mediaQuery.trim()) return; setMediaLoading(true); setStatus('Buscando en Pexels…'); try { const result = await (await fetch(`/api/media/pexels?q=${encodeURIComponent(mediaQuery)}`)).json(); if (result.error) throw new Error(result.error); setMedia(result.photos); setStatus(`${result.photos.length} imágenes encontradas`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude buscar imágenes'); } finally { setMediaLoading(false); } }
  async function addStockImage(item: StockImage) { setStatus('Guardando imagen en assets…'); try { const result = await (await fetch('/api/media/image', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: item.full, name: item.alt || `pexels-${item.id}` }) })).json(); const image = await fabric.FabricImage.fromURL(result.dataUrl); const max = Math.min(800 / (image.width || 1), 800 / (image.height || 1), 1); image.scale(max); add(image); if (canvas.current) attachCrop(canvas.current); setStatus(`Crédito: ${item.photographer} · doble clic para recortar`); } catch { setStatus('No pude agregar esa imagen'); } }
  function remove() { const c = canvas.current; if (!c) return; c.getActiveObjects().forEach((o) => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); syncUi(); }
  async function duplicate() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active) return; const clone = await active.clone(); clone.set({ left: (active.left ?? 0) + 28, top: (active.top ?? 0) + 28 }); c.add(clone); c.setActiveObject(clone); c.requestRenderAll(); }
  async function travel(delta: number) { const c = canvas.current; const next = historyIndex.current + delta; if (!c || next < 0 || next >= history.current.length) return; restoring.current = true; historyIndex.current = next; await c.loadFromJSON(history.current[next]); attachCrop(c); c.requestRenderAll(); restoring.current = false; setCanUndo(next > 0); setCanRedo(next < history.current.length - 1); syncUi(); }
  function patchObject(values: Record<string, unknown>) { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; o.set(values); o.setCoords(); c.requestRenderAll(); snapshot(); syncUi(); }
  function applyRadius(value: number) { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; const radius = Math.min(Number(o.width || 1), Number(o.height || 1)) / 2 * value / 100; if (o.type === 'rect') (o as fabric.Rect).set({ rx: radius, ry: radius }); else if (o.type === 'image') o.set({ clipPath: value === 0 ? undefined : new fabric.Rect({ width: o.width, height: o.height, rx: radius, ry: radius, originX: 'center', originY: 'center' }) }); o.setCoords(); c.requestRenderAll(); snapshot(); syncUi(); }
  function applyShadow(enabled: boolean, intensity = inspector.shadowIntensity) { const blur = 4 + intensity * .3; const offset = 2 + intensity * .08; const alpha = .15 + intensity * .003; patchObject({ shadow: enabled ? new fabric.Shadow({ color: `rgba(0,0,0,${alpha.toFixed(2)})`, blur, offsetX: offset, offsetY: offset }) : null }); }
  function resize(w: number, h: number) { const c = canvas.current; if (!c) return; c.setDimensions({ width: w, height: h }); setSize({ w, h }); setCustomWidth(String(w)); setCustomHeight(String(h)); c.requestRenderAll(); snapshot(); }
  function applyCustomSize() {
    const w = Math.round(Number(customWidth));
    const h = Math.round(Number(customHeight));
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 64 || w > 10000 || h > 10000) {
      setStatus('Usa medidas entre 64 y 10,000 px');
      return;
    }
    resize(w, h);
    setStatus(`Lienzo personalizado: ${w} × ${h}px`);
  }
  function layer(action: 'front' | 'back') { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; action === 'front' ? c.bringObjectToFront(o) : c.sendObjectToBack(o); c.requestRenderAll(); snapshot(); }
  function center() { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; c.centerObject(o); o.setCoords(); c.requestRenderAll(); snapshot(); }
  function alignToCanvas(mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; const bounds = o.getBoundingRect(); if (mode === 'centerH') c.centerObjectH(o); else if (mode === 'centerV') c.centerObjectV(o); else if (mode === 'left') o.set({ left: (o.left ?? 0) - bounds.left + 24 }); else if (mode === 'right') o.set({ left: (o.left ?? 0) + c.width - bounds.left - bounds.width - 24 }); else if (mode === 'top') o.set({ top: (o.top ?? 0) - bounds.top + 24 }); else o.set({ top: (o.top ?? 0) + c.height - bounds.top - bounds.height - 24 }); o.setCoords(); c.requestRenderAll(); snapshot(); }
  function alignSelection(mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active || active.type !== 'activeselection') return; const objects = (active as fabric.ActiveSelection).getObjects(); const rects = objects.map((object) => ({ object, rect: object.getBoundingRect() })); const left = Math.min(...rects.map(({ rect }) => rect.left)); const right = Math.max(...rects.map(({ rect }) => rect.left + rect.width)); const top = Math.min(...rects.map(({ rect }) => rect.top)); const bottom = Math.max(...rects.map(({ rect }) => rect.top + rect.height)); rects.forEach(({ object, rect }) => { let dx = 0; let dy = 0; if (mode === 'left') dx = left - rect.left; if (mode === 'centerH') dx = (left + right) / 2 - (rect.left + rect.width / 2); if (mode === 'right') dx = right - (rect.left + rect.width); if (mode === 'top') dy = top - rect.top; if (mode === 'centerV') dy = (top + bottom) / 2 - (rect.top + rect.height / 2); if (mode === 'bottom') dy = bottom - (rect.top + rect.height); object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy }); object.setCoords(); }); active.setCoords(); c.requestRenderAll(); snapshot(); }
  function groupSelection() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active || active.type !== 'activeselection') return; const objects = (active as fabric.ActiveSelection).getObjects().slice(); c.discardActiveObject(); c.remove(...objects); const group = new fabric.Group(objects); c.add(group); c.setActiveObject(group); c.requestRenderAll(); snapshot(); syncUi(); setStatus(`${objects.length} elementos agrupados`); }
  function ungroupSelection() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active || active.type !== 'group') return; const objects = (active as fabric.Group).removeAll(); c.remove(active); c.add(...objects); c.setActiveObject(new fabric.ActiveSelection(objects, { canvas: c })); c.requestRenderAll(); snapshot(); syncUi(); setStatus(`${objects.length} elementos desagrupados`); }
  function cropSelected() { const o = canvas.current?.getActiveObject(); if (!o || o.type !== 'image') { setStatus('Selecciona una imagen para recortarla'); return; } o.off('mousedblclick', enterCropMode); enterCropMode.call(enterCropMode, { target: o } as fabric.TPointerEventInfo); refreshCroppedImage(o); setStatus('Modo recorte activo · doble clic para terminar'); }
  function toggleSnapping() { const next = !snappingRef.current; snappingRef.current = next; setSnapping(next); snapGuides.current = {}; canvas.current?.requestRenderAll(); setStatus(next ? 'Ajuste magnético activado' : 'Ajuste magnético desactivado'); }
  async function saveProject() { const c = canvas.current; if (!c) return; setStatus('Guardando…'); const response = await fetch('/api/projects', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: projectId, name, width: size.w, height: size.h, background: c.backgroundColor, canvas: c.toJSON() }) }); const result = await response.json(); setProjectId(result.id); setStatus(`Guardado en data/projects/${result.id}.json`); await refreshProjects(); }
  async function loadProject(id: string) { if (!id || !canvas.current) return; setStatus('Abriendo…'); const data = await (await fetch(`/api/projects/${id}`)).json(); restoring.current = true; resize(data.width, data.height); await canvas.current.loadFromJSON(data.canvas); attachCrop(canvas.current); canvas.current.backgroundColor = data.background; canvas.current.requestRenderAll(); restoring.current = false; setProjectId(data.id); setName(data.name); history.current = []; historyIndex.current = -1; snapshot(); syncUi(); setStatus('Proyecto abierto'); }
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
        <section><h2>Lienzo</h2><label className="field">Formato<select value={SIZES.some((s) => s.w === size.w && s.h === size.h) ? `${size.w}x${size.h}` : 'custom'} onChange={(e) => { if (e.target.value === 'custom') return; const [w,h] = e.target.value.split('x').map(Number); resize(w,h); }}>{SIZES.map((s) => <option key={s.name} value={`${s.w}x${s.h}`}>{s.name} · {s.w}×{s.h}</option>)}<option value="custom">Personalizado · {size.w}×{size.h}</option></select></label><div className="custom-size"><label>Ancho<input type="number" min="64" max="10000" inputMode="numeric" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCustomSize(); }}/></label><span>×</span><label>Alto<input type="number" min="64" max="10000" inputMode="numeric" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCustomSize(); }}/></label></div><button className="apply-size" onClick={applyCustomSize}>Aplicar tamaño libre</button><p className="size-help">De 64 a 10,000 px por lado.</p><label className="field">Fondo<input type="color" value={String(canvas.current?.backgroundColor || '#ffffff')} onChange={(e) => { if (canvas.current) { canvas.current.backgroundColor = e.target.value; canvas.current.requestRenderAll(); snapshot(); } }}/></label></section>
        <section><h2>Banco de imágenes</h2><form className="media-search" onSubmit={(e) => void searchMedia(e)}><input aria-label="Buscar en Pexels" value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)} placeholder="Buscar fotos…"/><button disabled={mediaLoading}>{mediaLoading ? '…' : 'Buscar'}</button></form><div className="media-grid">{media.map((item) => <button key={item.id} onClick={() => void addStockImage(item)} title={`${item.alt} · ${item.photographer}`}><img src={item.thumb} alt={item.alt || `Foto de ${item.photographer}`}/><span>{item.photographer}</span></button>)}</div></section>
        <section><h2>Abrir proyecto</h2><select aria-label="Abrir proyecto" value="" onChange={(e) => void loadProject(e.target.value)}><option value="">Seleccionar…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><p className="hint"><FolderOpen/> {projects.length} guardado{projects.length === 1 ? '' : 's'} localmente</p></section>
      </aside>
      <section className="stage-column">
        <div className="stage-toolbar"><div><button aria-label="Deshacer" disabled={!canUndo} onClick={() => void travel(-1)}><Undo2/></button><button aria-label="Rehacer" disabled={!canRedo} onClick={() => void travel(1)}><Redo2/></button><span className="divider"/><button aria-label="Duplicar" disabled={!selected} onClick={() => void duplicate()}><Copy/></button><button aria-label="Eliminar" disabled={!selected} onClick={remove}><Trash2/></button><span className="divider"/><button className={snapping ? 'is-active' : ''} aria-label={snapping ? 'Desactivar ajuste magnético' : 'Activar ajuste magnético'} aria-pressed={snapping} onClick={toggleSnapping}><Magnet/></button></div><label className="zoom">{zoom}%<input type="range" min="20" max="90" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}/></label></div>
        <div className="stage"><div className="canvas-frame" style={{ width: size.w * zoom / 100, height: size.h * zoom / 100 }}><div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}><canvas ref={canvasNode}/></div></div></div>
        <footer className="status"><span className="status-dot"/>{status}<span>{size.w} × {size.h}px</span></footer>
      </section>
      <aside className="sidebar right-panel">
        <section><h2>Propiedades</h2>{selected ? <><label className="field">Color<input type="color" value={inspector.fill} onChange={(e) => patchObject({ fill: e.target.value })}/></label>{inspector.isText && <label className="field">Tamaño<input type="number" min="8" max="500" value={inspector.fontSize} onChange={(e) => patchObject({ fontSize: Number(e.target.value) })}/></label>}<label className="field">Opacidad <span>{inspector.opacity}%</span><input type="range" min="5" max="100" value={inspector.opacity} onChange={(e) => patchObject({ opacity: Number(e.target.value) / 100 })}/></label><label className="field">Rotación <span>{inspector.angle}°</span><input type="range" min="-180" max="180" value={inspector.angle} onChange={(e) => patchObject({ angle: Number(e.target.value) })}/></label>{inspector.canRound && <label className="field">Radio de esquinas <span>{inspector.radius}%</span><input type="range" min="0" max="100" value={inspector.radius} onChange={(e) => applyRadius(Number(e.target.value))}/></label>}<div className="effect-row"><label><input type="checkbox" checked={inspector.shadowOn} onChange={(e) => applyShadow(e.target.checked)}/> Sombra</label>{inspector.shadowOn && <span>{inspector.shadowIntensity}%</span>}</div>{inspector.shadowOn && <label className="field shadow-slider">Intensidad<input type="range" min="0" max="100" value={inspector.shadowIntensity} onChange={(e) => applyShadow(true, Number(e.target.value))}/></label>}{inspector.isImage && <button className="wide-action" onClick={cropSelected}><Crop/> Recortar imagen</button>}<div className="row"><button onClick={center}><AlignCenter/> Centrar</button><button onClick={() => layer('front')}><BringToFront/> Frente</button><button onClick={() => layer('back')}><SendToBack/> Fondo</button></div></> : <div className="empty">Selecciona un elemento para editarlo.</div>}</section>
        {selected && <section><h2>Alinear</h2><p className="section-help">{selectionType === 'multiple' ? 'Respecto a la selección' : 'Respecto al lienzo'}</p><div className="align-grid"><button title="Izquierda" aria-label="Alinear a la izquierda" onClick={() => selectionType === 'multiple' ? alignSelection('left') : alignToCanvas('left')}><AlignHorizontalJustifyStart/></button><button title="Centro horizontal" aria-label="Centrar horizontalmente" onClick={() => selectionType === 'multiple' ? alignSelection('centerH') : alignToCanvas('centerH')}><AlignHorizontalJustifyCenter/></button><button title="Derecha" aria-label="Alinear a la derecha" onClick={() => selectionType === 'multiple' ? alignSelection('right') : alignToCanvas('right')}><AlignHorizontalJustifyEnd/></button><button title="Arriba" aria-label="Alinear arriba" onClick={() => selectionType === 'multiple' ? alignSelection('top') : alignToCanvas('top')}><AlignVerticalJustifyStart/></button><button title="Centro vertical" aria-label="Centrar verticalmente" onClick={() => selectionType === 'multiple' ? alignSelection('centerV') : alignToCanvas('centerV')}><AlignVerticalJustifyCenter/></button><button title="Abajo" aria-label="Alinear abajo" onClick={() => selectionType === 'multiple' ? alignSelection('bottom') : alignToCanvas('bottom')}><AlignVerticalJustifyEnd/></button></div>{selectionType === 'multiple' && <button className="wide-action" onClick={groupSelection}><Group/> Agrupar selección</button>}{selectionType === 'group' && <button className="wide-action" onClick={ungroupSelection}><Ungroup/> Desagrupar</button>}</section>}
        <section className="layers"><h2><Layers3/> Capas <span>{layers.length}</span></h2>{layers.length ? layers.map((o, i) => <button key={`${o.type}-${i}`} className={canvas.current?.getActiveObject() === o ? 'active' : ''} onClick={() => { canvas.current?.setActiveObject(o); canvas.current?.requestRenderAll(); syncUi(); }}><span className="layer-icon">{o.type === 'textbox' ? 'T' : o.type === 'image' ? 'IMG' : '◆'}</span><span>{o.type === 'textbox' ? String((o as fabric.Textbox).text).slice(0, 22) : o.type}</span></button>) : <div className="empty">Tu lienzo está vacío.</div>}</section>
        <section><h2>Paleta rápida</h2><div className="swatches">{COLORS.map((color) => <button key={color} aria-label={`Usar ${color}`} style={{ background: color }} onClick={() => selected ? patchObject({ fill: color }) : undefined}/>)}</div></section>
      </aside>
    </div>
  </main>;
}
