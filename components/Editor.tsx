// SPDX-License-Identifier: MPL-2.0
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { enterCropMode } from 'fabric/extensions';
import { AlignCenter, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd, AlignHorizontalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, BringToFront, Circle, Copy, Crop, Download, Eye, EyeOff, FilePlus2, FolderOpen, Group, ImagePlus, Layers3, Lock, Magnet, Pipette, Plus, Redo2, Save, SendToBack, Square, Trash2, Type, Ungroup, Unlock, Undo2, X } from 'lucide-react';
import ColorExtractorModal from './ColorExtractorModal';
import ShapeSoupModal from './ShapeSoupModal';
import { Waves } from 'lucide-react';
import { GOOGLE_FONTS } from './FontPicker';
import { createRecordId, deleteLibrary, getLibrary, getProject, hydrateCanvasJSON, hydrateLibraryAsset, listLibrary, listProjects, requestPersistentStorage, saveAsset, saveLibrary, saveProject as saveProjectRecord, stableAssetReference } from '@/lib/browser-db';
import { backupFilename, makeBrowserBackup, restoreBrowserBackup } from '@/lib/browser-backup';

type ProjectListItem = { id: string; name: string; updatedAt: string };
type StockImage = { id: number; alt: string; photographer: string; photographerUrl?: string; pageUrl?: string; thumb: string; full: string };
type PageData = { id: string; name: string; w: number; h: number; bg: string; json: object; thumb?: string };
type LibraryItem = { id: string; name: string; updatedAt: string };
type BrandKit = LibraryItem & { colors: string[]; fontFamily: string; logos: string[]; images: string[] };
type Inspector = { fill: string; stroke: string; canFill: boolean; canStroke: boolean; opacity: number; angle: number; fontSize: number; isText: boolean; isImage: boolean; canRound: boolean; radius: number; shadowOn: boolean; shadowIntensity: number; fontFamily: string; fontWeight: string; fontStyle: string; underline: boolean; charSpacing: number; lineHeight: number; textAlign: string };
type FraguaMaskObject = fabric.FabricObject & { fraguaMaskId?: string; fraguaMaskOwnerId?: string };
const SIZES = [{ name: 'Cuadrado', w: 1080, h: 1080 }, { name: 'Historia', w: 1080, h: 1920 }, { name: 'Horizontal', w: 1200, h: 630 }, { name: 'A4', w: 1240, h: 1754 }];
const COLORS = ['#18181b', '#f8fafc', '#ff4d6d', '#ffb703', '#3a86ff', '#8338ec', '#06d6a0'];
const BRAND_PALETTES = [
  { name: 'Vibrante', colors: ['#18181b', '#ff4d6d', '#ffb703', '#3a86ff', '#f8fafc'] },
  { name: 'Editorial', colors: ['#151515', '#f4efe6', '#b23a2f', '#d1a85b', '#ffffff'] },
  { name: 'Natural', colors: ['#233d2c', '#6f8f72', '#d8c9a7', '#f4f1e8', '#b8663b'] },
  { name: 'Nocturna', colors: ['#0b1020', '#202a44', '#7357ff', '#21d4a4', '#f5f7ff'] },
];
const TEXT_STYLE_KEYS = new Set(['fill', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'underline', 'stroke', 'strokeWidth']);
function paintableColor(value: unknown): value is string { return typeof value === 'string' && /^#[\da-f]{3,8}$/i.test(value); }
function exportSafeJSON(value: object) {
  const copy = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const item = node as Record<string, unknown>;
    if (typeof item.type === 'string' && item.type.toLowerCase() === 'image' && typeof item.src === 'string') {
      const src = stableAssetReference(item.src);
      item.src = src;
      if (/^https?:\/\//i.test(src)) item.crossOrigin = 'anonymous';
      else if (typeof item.crossOrigin === 'string') delete item.crossOrigin;
    }
    Object.values(item).forEach(visit);
  };
  visit(copy);
  return copy;
}
function GoogleFontOptions() { return <optgroup label="Google Fonts · se cargan al elegir">{GOOGLE_FONTS.map((font) => <option key={font} style={{ fontFamily: font }}>{font}</option>)}</optgroup>; }
function paintTargets(object: fabric.FabricObject): fabric.FabricObject[] {
  if (object.type === 'group' || object.type === 'activeselection') return (object as fabric.Group | fabric.ActiveSelection).getObjects().flatMap(paintTargets);
  return [object];
}
function isVectorShape(object: fabric.FabricObject) { return ['path', 'rect', 'circle', 'ellipse', 'line', 'polygon', 'polyline', 'triangle'].includes(object.type); }
function isClipMaskShape(object: fabric.FabricObject) {
  if (object.type === 'textbox' || object.type === 'i-text' || isVectorShape(object)) return true;
  return object.type === 'group' && paintTargets(object).every((child) => child.type === 'textbox' || child.type === 'i-text' || isVectorShape(child));
}
(fabric.FabricObject as typeof fabric.FabricObject & { customProperties: string[] }).customProperties = ['name', 'fraguaMaskId', 'fraguaMaskOwnerId'];

export default function Editor() {
  const canvasNode = useRef<HTMLCanvasElement>(null);
  const backupFileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvas = useRef<fabric.Canvas | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const restoring = useRef(false);
  const snapGuides = useRef<{ x?: number; y?: number }>({});
  const snappingRef = useRef(true);
  const maskDoubleClickHandlers = useRef(new WeakMap<fabric.FabricObject, () => void>());
  const pagesRef = useRef<PageData[]>([]);
  const savedNameRef = useRef('');
  const panRef = useRef({ active: false, x: 0, y: 0 });
  const googleFontLoads = useRef(new Map<string, Promise<boolean>>());
  const loadedGoogleFonts = useRef(new Set<string>());
  const settledFontRequests = useRef(new Set<string>());
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
  const [inspector, setInspector] = useState<Inspector>({ fill: '#18181b', stroke: '#18181b', canFill: false, canStroke: false, opacity: 100, angle: 0, fontSize: 72, isText: false, isImage: false, canRound: false, radius: 0, shadowOn: false, shadowIntensity: 45, fontFamily: 'Arial', fontWeight: '400', fontStyle: 'normal', underline: false, charSpacing: 0, lineHeight: 1.16, textAlign: 'left' });
  const [status, setStatus] = useState('Listo');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [mediaQuery, setMediaQuery] = useState('texturas abstractas');
  const [media, setMedia] = useState<StockImage[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMode, setMediaMode] = useState<'photos' | 'icons'>('photos');
  const [pexelsKey, setPexelsKey] = useState('');
  const [pexelsKeyDraft, setPexelsKeyDraft] = useState('');
  const [editingPexelsKey, setEditingPexelsKey] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [icons, setIcons] = useState<string[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [activePageId, setActivePageId] = useState('');
  const [templates, setTemplates] = useState<LibraryItem[]>([]);
  const [brands, setBrands] = useState<BrandKit[]>([]);
  const [palette, setPalette] = useState(COLORS);
  const [lastSaved, setLastSaved] = useState('Sin guardar');
  const [isPanning, setIsPanning] = useState(false);
  const [colorModalOpen, setColorModalOpen] = useState(false);
  const [shapeSoupModalOpen, setShapeSoupModalOpen] = useState(false);
  const closeShapeSoupModal = useCallback(() => setShapeSoupModalOpen(false), []);
  const [brandModalOpen, setBrandModalOpen] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState('');
  const [activeBrandId, setActiveBrandId] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandDraft, setBrandDraft] = useState({ name: '', fontFamily: 'Arial', colors: BRAND_PALETTES[0].colors, logos: [] as string[], images: [] as string[] });
  const maskEditingId = String((layers.find((object) => (object as FraguaMaskObject).fraguaMaskOwnerId) as FraguaMaskObject | undefined)?.fraguaMaskOwnerId || '');

  const syncUi = useCallback(() => {
    const c = canvas.current; if (!c) return;
    setLayers([...c.getObjects()].reverse());
    const o = c.getActiveObject(); setSelected(Boolean(o));
    setSelectionType(!o ? 'none' : o.type === 'activeselection' ? 'multiple' : o.type === 'group' ? 'group' : 'single');
    if (o) {
      const targets = paintTargets(o);
      const fillTarget = targets.find((item) => paintableColor(item.fill));
      const strokeTarget = targets.find((item) => paintableColor(item.stroke));
      const vectorTargets = targets.filter(isVectorShape);
      const imageClip = o.type === 'image' && o.clipPath?.type === 'rect' ? o.clipPath as fabric.Rect : null;
      const radiusPx = o.type === 'rect' ? Number((o as fabric.Rect).rx || 0) : Number(imageClip?.rx || 0);
      const radiusBase = Math.max(1, Math.min(Number(o.width || 1), Number(o.height || 1)) / 2);
      const shadow = o.shadow instanceof fabric.Shadow ? o.shadow : null;
      const textFill = typeof o.fill === 'string' && paintableColor(o.fill) ? o.fill : undefined;
      setInspector({ fill: textFill || (paintableColor(fillTarget?.fill) ? fillTarget.fill : '#18181b'), stroke: paintableColor(strokeTarget?.stroke) ? strokeTarget.stroke : '#18181b', canFill: Boolean(textFill || fillTarget) || (o.type === 'textbox' || o.type === 'i-text'), canStroke: Boolean(strokeTarget || vectorTargets.length), opacity: Math.round((o.opacity ?? 1) * 100), angle: Math.round(o.angle ?? 0), fontSize: 'fontSize' in o ? Number(o.fontSize) : 72, isText: o.type === 'textbox' || o.type === 'i-text', isImage: o.type === 'image', canRound: o.type === 'rect' || (o.type === 'image' && !(o as FraguaMaskObject).fraguaMaskId), radius: Math.round(Math.min(100, radiusPx / radiusBase * 100)), shadowOn: Boolean(shadow), shadowIntensity: shadow ? Math.round(Math.max(0, Math.min(100, (shadow.blur - 4) / .3))) : 45, fontFamily: 'fontFamily' in o ? String(o.fontFamily) : 'Arial', fontWeight: 'fontWeight' in o ? String(o.fontWeight) : '400', fontStyle: 'fontStyle' in o ? String(o.fontStyle) : 'normal', underline: 'underline' in o ? Boolean(o.underline) : false, charSpacing: 'charSpacing' in o ? Number(o.charSpacing) : 0, lineHeight: 'lineHeight' in o ? Number(o.lineHeight) : 1.16, textAlign: 'textAlign' in o ? String(o.textAlign) : 'left' });
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
      const previousMaskHandler = maskDoubleClickHandlers.current.get(object);
      if (previousMaskHandler) object.off('mousedblclick', previousMaskHandler);
      const maskId = (object as FraguaMaskObject).fraguaMaskId;
      if (maskId && object.clipPath) {
        const handler = () => beginMaskEditing(object);
        maskDoubleClickHandlers.current.set(object, handler);
        object.once('mousedblclick', handler);
      }
      else if (maskId && c.getObjects().some((item) => (item as FraguaMaskObject).fraguaMaskOwnerId === maskId)) object.off('mousedblclick', enterCropMode);
      else { maskDoubleClickHandlers.current.delete(object); object.once('mousedblclick', enterCropMode); }
    });
  }, []);

  const refreshCroppedImage = useCallback((object?: fabric.FabricObject) => {
    if (!object || object.type !== 'image') return;
    object.dirty = true;
    object.setCoords();
    object.canvas?.requestRenderAll();
  }, []);

  function pointerPosition(event: MouseEvent | TouchEvent | PointerEvent) { if ('touches' in event && event.touches.length) return { x: event.touches[0].clientX, y: event.touches[0].clientY }; return { x: (event as MouseEvent).clientX, y: (event as MouseEvent).clientY }; }
  const ensureGoogleFont = useCallback((family: string): Promise<boolean> => {
    if (!GOOGLE_FONTS.includes(family)) return Promise.resolve(true);
    if (loadedGoogleFonts.current.has(family)) return Promise.resolve(true);
    const pending = googleFontLoads.current.get(family); if (pending) return pending;
    const request = new Promise<boolean>((resolve) => {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
      link.onload = () => { void document.fonts.load(`16px "${family}"`).then(() => { loadedGoogleFonts.current.add(family); resolve(true); }).catch(() => resolve(false)); };
      link.onerror = () => { googleFontLoads.current.delete(family); resolve(false); };
      document.head.appendChild(link);
    });
    googleFontLoads.current.set(family, request); return request;
  }, []);
  async function prepareCanvasFonts(c: fabric.Canvas) {
    const objects = c.getObjects().flatMap(paintTargets);
    const families = [...new Set(objects.flatMap((object) => 'fontFamily' in object && typeof object.fontFamily === 'string' && GOOGLE_FONTS.includes(object.fontFamily) ? [object.fontFamily] : []))];
    await Promise.all(families.map(ensureGoogleFont));
    objects.forEach((object) => { if (object.type === 'textbox' || object.type === 'i-text') { (object as fabric.FabricObject & { initDimensions?: () => void }).initDimensions?.(); object.setCoords(); } });
    c.requestRenderAll();
  }
  function startPan(clientX: number, clientY: number) { panRef.current = { active: true, x: clientX, y: clientY }; setIsPanning(true); if (canvas.current) { canvas.current.selection = false; canvas.current.defaultCursor = 'grabbing'; } }
  function stopPan() { if (!panRef.current.active) return; panRef.current.active = false; setIsPanning(false); if (canvas.current) { canvas.current.selection = true; canvas.current.defaultCursor = 'default'; canvas.current.requestRenderAll(); } }

  useEffect(() => {
    const key = window.localStorage.getItem('fragua.pexels-key') || '';
    setPexelsKey(key); setPexelsKeyDraft(key);
  }, []);

  useEffect(() => {
    if (!canvasNode.current) return;
    const c = new fabric.Canvas(canvasNode.current, { width: size.w, height: size.h, backgroundColor: '#ffffff', preserveObjectStacking: true, selectionColor: 'rgba(255,77,109,.12)', selectionBorderColor: '#ff4d6d', defaultCursor: 'default' });
    canvas.current = c;
    c.on('object:added', snapshot); c.on('object:modified', snapshot); c.on('object:removed', snapshot);
    c.on('selection:created', syncUi); c.on('selection:updated', syncUi); c.on('selection:cleared', syncUi);
    c.on('object:added', () => attachCrop(c));
    c.on('mouse:down', (event) => {
      const nativeEvent = event.e as MouseEvent | PointerEvent;
      if (!event.target && nativeEvent.ctrlKey && nativeEvent.altKey) {
        nativeEvent.preventDefault();
        const point = pointerPosition(nativeEvent);
        startPan(point.x, point.y);
      }
    });
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
    c.on('after:render', ({ ctx }) => {
      const context = ctx; const { x, y } = snapGuides.current;
      if (!context) return;
      context.save(); context.strokeStyle = '#ff4d6d'; context.lineWidth = 2; context.setLineDash([10, 8]);
      if (x !== undefined) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, c.height); context.stroke(); }
      if (y !== undefined) { context.beginPath(); context.moveTo(0, y); context.lineTo(c.width, y); context.stroke(); }
      context.restore();
    });
    snapshot();
    const firstPage: PageData = { id: `page-${Date.now()}`, name: 'Página 1', w: size.w, h: size.h, bg: '#ffffff', json: c.toJSON() };
    pagesRef.current = [firstPage]; setPages([firstPage]); setActivePageId(firstPage.id);
    void requestPersistentStorage().catch(() => false);
    void refreshProjects(); void refreshLibraries();
    return () => { c.dispose(); canvas.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { const move = (event: PointerEvent) => { const stage = stageRef.current; if (!stage || !panRef.current.active) return; event.preventDefault(); const dx = event.clientX - panRef.current.x; const dy = event.clientY - panRef.current.y; stage.scrollLeft -= dx; stage.scrollTop -= dy; panRef.current.x = event.clientX; panRef.current.y = event.clientY; }; window.addEventListener('pointermove', move, { passive: false }); window.addEventListener('pointerup', stopPan); window.addEventListener('pointercancel', stopPan); return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stopPan); window.removeEventListener('pointercancel', stopPan); }; }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const handleWheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      setZoom((current) => Math.max(20, Math.min(300, Math.round(current * Math.exp(-event.deltaY * 0.0015)))));
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    return () => stage.removeEventListener('wheel', handleWheel);
  }, []);

  async function refreshProjects() { try { setProjects(await listProjects()); } catch { setStatus('No pude leer los proyectos de este navegador'); } }
  async function refreshLibraries() {
    try {
      const [templateList, brandRecords] = await Promise.all([listLibrary('templates'), listLibrary('brands')]);
      const brandList = await Promise.all(brandRecords.map(async (kit) => ({ ...kit, logos: await Promise.all((Array.isArray(kit.logos) ? kit.logos as string[] : []).map(hydrateLibraryAsset)), images: await Promise.all((Array.isArray(kit.images) ? kit.images as string[] : []).map(hydrateLibraryAsset)) } as BrandKit)));
      setTemplates(templateList); setBrands(brandList);
      brandList.forEach((kit) => { if (typeof kit.fontFamily === 'string' && GOOGLE_FONTS.includes(kit.fontFamily)) void ensureGoogleFont(kit.fontFamily); });
    } catch { setStatus('No pude leer plantillas o marcas locales'); }
  }
  function setPagesSynced(next: PageData[]) { pagesRef.current = next; setPages(next); }
  function capturePage(page?: PageData): PageData | null { const c = canvas.current; if (!c) return null; const base = page || pagesRef.current.find((item) => item.id === activePageId) || pagesRef.current[0] || { id: activePageId || `page-${Date.now()}`, name: 'Página 1', w: c.width, h: c.height, bg: '#ffffff', json: { objects: [] } }; return { ...base, w: c.width, h: c.height, bg: String(c.backgroundColor || '#ffffff'), json: c.toJSON() }; }
  function commitCurrentPage() { const current = capturePage(); if (!current) return pagesRef.current; const exists = pagesRef.current.some((item) => item.id === current.id); const next = exists ? pagesRef.current.map((item) => item.id === current.id ? current : item) : [...pagesRef.current, current]; setPagesSynced(next); if (!activePageId) setActivePageId(current.id); return next; }
  async function openPage(id: string) { const c = canvas.current; const target = pagesRef.current.find((item) => item.id === id); if (!c || !target || id === activePageId) return; commitCurrentPage(); restoring.current = true; c.setDimensions({ width: target.w, height: target.h }); setSize({ w: target.w, h: target.h }); setCustomWidth(String(target.w)); setCustomHeight(String(target.h)); await c.loadFromJSON(target.json); await prepareCanvasFonts(c); c.backgroundColor = target.bg; attachCrop(c); c.requestRenderAll(); restoring.current = false; setActivePageId(id); history.current = []; historyIndex.current = -1; snapshot(); syncUi(); }
  function addPage(duplicatePage = false) { const c = canvas.current; if (!c) return; const list = commitCurrentPage(); const page: PageData = { id: `page-${Date.now()}`, name: `Página ${list.length + 1}`, w: c.width, h: c.height, bg: String(c.backgroundColor || '#ffffff'), json: duplicatePage ? c.toJSON() : { version: fabric.version, objects: [], background: String(c.backgroundColor || '#ffffff') } }; setPagesSynced([...list, page]); setActivePageId(page.id); restoring.current = true; c.clear(); c.setDimensions({ width: page.w, height: page.h }); c.backgroundColor = page.bg; if (duplicatePage) void c.loadFromJSON(page.json).then(() => { attachCrop(c); c.requestRenderAll(); restoring.current = false; snapshot(); syncUi(); }); else { c.requestRenderAll(); restoring.current = false; snapshot(); syncUi(); } setStatus(duplicatePage ? 'Página duplicada' : 'Página nueva'); }
  async function deletePage(id: string) { if (pagesRef.current.length === 1) { setStatus('El documento necesita al menos una página'); return; } const index = pagesRef.current.findIndex((item) => item.id === id); const next = pagesRef.current.filter((item) => item.id !== id); setPagesSynced(next); if (id === activePageId) { setActivePageId(''); await openPage(next[Math.max(0, index - 1)].id); } }
  function movePage(id: string, direction: -1 | 1) { const list = [...pagesRef.current]; const from = list.findIndex((item) => item.id === id); const to = from + direction; if (from < 0 || to < 0 || to >= list.length) return; [list[from], list[to]] = [list[to], list[from]]; setPagesSynced(list); }
  function renamePage(id: string) { const page = pagesRef.current.find((item) => item.id === id); if (!page) return; const nextName = window.prompt('Nombre de la página', page.name); if (!nextName?.trim()) return; setPagesSynced(pagesRef.current.map((item) => item.id === id ? { ...item, name: nextName.trim() } : item)); }
  function add(object: fabric.FabricObject) { const c = canvas.current; if (!c) return; c.add(object); c.centerObject(object); c.setActiveObject(object); c.requestRenderAll(); syncUi(); }
  function addText() { add(new fabric.Textbox('Escribe aquí', { width: 620, fontSize: 92, fontWeight: 700, fontFamily: 'Arial', fill: '#18181b', textAlign: 'center', originX: 'center', originY: 'center' })); }
  function addRect() { add(new fabric.Rect({ width: 420, height: 280, rx: 24, ry: 24, fill: '#ff4d6d', originX: 'center', originY: 'center' })); }
  function addCircle() { add(new fabric.Circle({ radius: 180, fill: '#3a86ff', originX: 'center', originY: 'center' })); }
  function canCreateMask() {
    const objects = canvas.current?.getActiveObjects() || [];
    return objects.length === 2 && objects.filter((object) => object.type === 'image').length === 1 && objects.every((object) => object.type === 'image' ? !object.clipPath && !(object as FraguaMaskObject).fraguaMaskId : isClipMaskShape(object));
  }
  function createMask() {
    const c = canvas.current; const selectedObjects = c?.getActiveObjects() || [];
    if (!c || selectedObjects.length !== 2) return;
    const image = selectedObjects.find((object) => object.type === 'image') as fabric.FabricImage | undefined;
    const mask = selectedObjects.find((object) => object !== image);
    if (!image || !mask || image.clipPath || !isClipMaskShape(mask)) { setStatus('Selecciona una imagen y un texto o vector sin recorte previo'); return; }
    c.discardActiveObject();
    const bounds = mask.getBoundingRect(); const center = mask.getCenterPoint();
    const frameRatio = Math.max(.0001, bounds.width) / Math.max(.0001, bounds.height);
    let cropX = 0; let cropY = 0; let cropWidth = image.width || 1; let cropHeight = image.height || 1;
    if (cropWidth / cropHeight > frameRatio) { cropWidth = cropHeight * frameRatio; cropX = ((image.width || cropWidth) - cropWidth) / 2; }
    else { cropHeight = cropWidth / frameRatio; cropY = ((image.height || cropHeight) - cropHeight) / 2; }
    const scale = bounds.height / cropHeight;
    image.set({ cropX, cropY, width: cropWidth, height: cropHeight, scaleX: scale, scaleY: scale, originX: 'center', originY: 'center' });
    image.setPositionByOrigin(center, 'center', 'center'); image.setCoords();
    const relativeMaskMatrix = fabric.util.multiplyTransformMatrices(fabric.util.invertTransform(image.calcTransformMatrix()), mask.calcTransformMatrix());
    fabric.util.applyTransformToObject(mask, relativeMaskMatrix);
    mask.set({ fill: mask.fill || '#18181b', stroke: null, strokeWidth: 0, opacity: 1, absolutePositioned: false, selectable: false, evented: false, shadow: null });
    const id = `mask-${crypto.randomUUID()}`;
    const label = mask.type === 'textbox' || mask.type === 'i-text' ? String((mask as fabric.Textbox).text || 'texto').replace(/\s+/g, ' ').slice(0, 32) : String((mask as fabric.FabricObject & { name?: string }).name || mask.type);
    (image as FraguaMaskObject).fraguaMaskId = id;
    (image as fabric.FabricImage & { name?: string }).name = `Máscara · ${label}`;
    image.clipPath = mask; image.dirty = true;
    restoring.current = true; c.remove(mask); c.requestRenderAll(); restoring.current = false;
    c.setActiveObject(image); attachCrop(c); snapshot(); syncUi();
    setStatus('Máscara creada · doble clic en la imagen para ajustar su contenido');
  }
  function beginMaskEditing(image: fabric.FabricObject) {
    const c = canvas.current; const maskedImage = image as FraguaMaskObject;
    const id = maskedImage.fraguaMaskId; const mask = image.clipPath as fabric.FabricObject | undefined;
    if (!c || !id || !mask) return;
    const worldMatrix = fabric.util.multiplyTransformMatrices(image.calcTransformMatrix(), mask.calcTransformMatrix());
    fabric.util.applyTransformToObject(mask, worldMatrix);
    mask.set({ absolutePositioned: false, opacity: .36, selectable: true, evented: true });
    (mask as FraguaMaskObject).fraguaMaskOwnerId = id;
    image.clipPath = undefined; image.dirty = true; image.setCoords();
    restoring.current = true; c.add(mask); c.bringObjectToFront(mask); restoring.current = false;
    c.setActiveObject(mask); c.requestRenderAll(); attachCrop(c); syncUi();
    setStatus('Editando máscara · ajusta imagen o forma y pulsa “Terminar máscara”');
  }
  function finishMaskEditing() {
    const c = canvas.current; if (!c || !maskEditingId) return;
    const mask = c.getObjects().find((object) => (object as FraguaMaskObject).fraguaMaskOwnerId === maskEditingId) as FraguaMaskObject | undefined;
    const image = c.getObjects().find((object) => (object as FraguaMaskObject).fraguaMaskId === maskEditingId) as (fabric.FabricImage & FraguaMaskObject) | undefined;
    if (!mask || !image) { setStatus('No pude completar la máscara: falta su imagen o su forma'); return; }
    const relativeMatrix = fabric.util.multiplyTransformMatrices(fabric.util.invertTransform(image.calcTransformMatrix()), mask.calcTransformMatrix());
    fabric.util.applyTransformToObject(mask, relativeMatrix);
    mask.set({ absolutePositioned: false, opacity: 1, selectable: false, evented: false });
    image.clipPath = mask; image.dirty = true; image.setCoords();
    restoring.current = true; c.remove(mask); restoring.current = false;
    c.setActiveObject(image); c.requestRenderAll(); attachCrop(c); snapshot(); syncUi();
    setStatus('Edición de máscara terminada');
  }
  async function insertShapeSoup(svg: string, label: string): Promise<boolean> {
    try {
      const c = canvas.current;
      if (!c) return false;
      const { objects, options } = await fabric.loadSVGFromString(svg);
      const valid = objects.filter((object): object is fabric.FabricObject => Boolean(object));
      if (!valid.length) throw new Error('ShapeSoup no produjo objetos compatibles con Fabric');
      const shape = fabric.util.groupSVGElements(valid, options);
      const scale = Math.min(600 / Math.max(shape.width || 1, shape.height || 1), 1);
      shape.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center', name: label } as fabric.Group & { name: string });
      add(shape);
      setStatus(`${label} insertada como vector editable`);
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No pude insertar la forma');
      return false;
    }
  }
  async function uploadImage(file?: File) {
    if (!file) return; setStatus('Importando imagen…');
    try { const asset = await saveAsset(file, file.name); const image = await fabric.FabricImage.fromURL(asset.url); const max = Math.min(700 / (image.width || 1), 700 / (image.height || 1), 1); image.scale(max); add(image); if (canvas.current) attachCrop(canvas.current); setStatus(`Imagen guardada en este navegador · doble clic para recortar`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude importar esa imagen'); }
  }
  async function replaceImage(file?: File) { const c = canvas.current; const old = c?.getActiveObject(); if (!file || !c || !old || old.type !== 'image') return; setStatus('Reemplazando imagen…'); try { const asset = await saveAsset(file, file.name); const image = await fabric.FabricImage.fromURL(asset.url); image.set({ left: old.left, top: old.top, originX: old.originX, originY: old.originY, angle: old.angle, opacity: old.opacity, shadow: old.shadow, clipPath: old.clipPath, scaleX: (old.getScaledWidth() / (image.width || 1)), scaleY: (old.getScaledHeight() / (image.height || 1)) }); const oldMask = old as FraguaMaskObject; if (oldMask.fraguaMaskId) (image as FraguaMaskObject).fraguaMaskId = oldMask.fraguaMaskId; (image as fabric.FabricImage & { name?: string }).name = (old as fabric.FabricImage & { name?: string }).name; c.remove(old); c.add(image); c.setActiveObject(image); attachCrop(c); c.requestRenderAll(); snapshot(); syncUi(); setStatus('Imagen reemplazada y guardada en este navegador'); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude reemplazar la imagen'); } }
  async function searchMedia(e?: React.FormEvent) {
    e?.preventDefault(); if (!mediaQuery.trim()) return;
    if (mediaMode === 'photos' && !pexelsKey) { setEditingPexelsKey(true); setStatus('Configura tu clave de Pexels para buscar fotografías'); return; }
    setMediaLoading(true); setStatus(mediaMode === 'photos' ? 'Buscando en Pexels…' : 'Buscando en Iconify…');
    try {
      if (mediaMode === 'photos') {
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(mediaQuery)}&per_page=18`, { headers: { Authorization: pexelsKey } });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || (response.status === 401 ? 'La clave de Pexels no es válida' : 'Pexels no respondió'));
        const photos: StockImage[] = (result.photos || []).map((photo: { id: number; alt: string; photographer: string; photographer_url?: string; url?: string; src: Record<string, string> }) => ({ id: photo.id, alt: photo.alt || '', photographer: photo.photographer, photographerUrl: photo.photographer_url, pageUrl: photo.url, thumb: photo.src.medium, full: photo.src.large2x || photo.src.large }));
        setMedia(photos); setStatus(`${photos.length} imágenes encontradas · fotos por Pexels`);
      } else {
        const response = await fetch(`https://api.iconify.design/search?query=${encodeURIComponent(mediaQuery)}&limit=48`);
        const result = await response.json(); if (!response.ok) throw new Error('Iconify no respondió');
        setIcons(result.icons || []); setStatus(`${(result.icons || []).length} iconos encontrados`);
      }
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude buscar recursos'); }
    finally { setMediaLoading(false); }
  }
  function savePexelsKey() { const key = pexelsKeyDraft.trim(); if (key) window.localStorage.setItem('fragua.pexels-key', key); else window.localStorage.removeItem('fragua.pexels-key'); setPexelsKey(key); setPexelsKeyDraft(key); setEditingPexelsKey(false); setStatus(key ? 'Clave de Pexels guardada solo en este navegador' : 'Clave de Pexels eliminada'); }
  async function addStockImage(item: StockImage) { setStatus('Descargando imagen en este navegador…'); try { const response = await fetch(item.full); if (!response.ok) throw new Error('Pexels no permitió descargar la imagen desde este navegador'); const blob = await response.blob(); const asset = await saveAsset(blob, item.alt || `pexels-${item.id}`); const image = await fabric.FabricImage.fromURL(asset.url); const max = Math.min(800 / (image.width || 1), 800 / (image.height || 1), 1); image.scale(max); add(image); if (canvas.current) attachCrop(canvas.current); setStatus(`Crédito: ${item.photographer} · guardada en este navegador`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude agregar esa imagen'); } }
  async function addIcon(iconId: string) { const [prefix, iconName] = iconId.split(':'); if (!prefix || !iconName) return; try { const response = await fetch(`https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(iconName)}.svg?color=${encodeURIComponent(inspector.fill || '#18181b')}`); if (!response.ok) throw new Error('No pude descargar el ícono'); const { objects, options } = await fabric.loadSVGFromString(await response.text()); const valid = objects.filter((object): object is fabric.FabricObject => Boolean(object)); if (!valid.length) throw new Error('SVG vacío'); const icon = fabric.util.groupSVGElements(valid, options); const scale = 220 / Math.max(icon.width || 220, icon.height || 220); icon.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center' }); add(icon); setStatus(`Ícono ${iconId} insertado como vector editable`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude insertar el ícono'); } }
  function remove() { const c = canvas.current; if (!c) return; c.getActiveObjects().forEach((o) => c.remove(o)); c.discardActiveObject(); c.requestRenderAll(); syncUi(); }
  async function duplicate() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active) return; const clone = await active.clone(); clone.set({ left: (active.left ?? 0) + 28, top: (active.top ?? 0) + 28 }); if (clone.type === 'image' && (clone as FraguaMaskObject).fraguaMaskId) (clone as FraguaMaskObject).fraguaMaskId = `mask-${crypto.randomUUID()}`; c.add(clone); c.setActiveObject(clone); c.requestRenderAll(); }
  async function travel(delta: number) { const c = canvas.current; const next = historyIndex.current + delta; if (!c || next < 0 || next >= history.current.length) return; restoring.current = true; historyIndex.current = next; await c.loadFromJSON(history.current[next]); await prepareCanvasFonts(c); attachCrop(c); c.requestRenderAll(); restoring.current = false; setCanUndo(next > 0); setCanRedo(next < history.current.length - 1); syncUi(); }
  function patchObject(values: Record<string, unknown>) { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; const family = values.fontFamily; if (typeof family === 'string' && GOOGLE_FONTS.includes(family) && !settledFontRequests.current.has(family)) { setStatus(`Cargando ${family}…`); void ensureGoogleFont(family).then((loaded) => { settledFontRequests.current.add(family); if (canvas.current?.getActiveObject() !== o) return; if (!loaded) setStatus(`No pude conectar con Google Fonts; se usará una fuente alternativa a ${family}`); patchObject(values); }); return; } const text = o instanceof fabric.Textbox ? o : null; const isRange = text?.isEditing && text.selectionStart !== text.selectionEnd; const isTextStyle = Object.keys(values).every((key) => TEXT_STYLE_KEYS.has(key)); if (text && isRange && isTextStyle) text.setSelectionStyles(values as fabric.TextStyleDeclaration); else if (o.type === 'group' || o.type === 'activeselection') { const targets = paintTargets(o); Object.entries(values).forEach(([key, value]) => { if (key === 'fill') targets.filter((object) => paintableColor(object.fill)).forEach((object) => object.set({ fill: value })); else if (key === 'stroke') targets.filter(isVectorShape).forEach((object) => object.set({ stroke: value })); else o.set({ [key]: value }); }); } else o.set(values); o.setCoords(); o.dirty = true; c.requestRenderAll(); snapshot(); syncUi(); }
  function applyRadius(value: number) { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; const radius = Math.min(Number(o.width || 1), Number(o.height || 1)) / 2 * value / 100; if (o.type === 'rect') (o as fabric.Rect).set({ rx: radius, ry: radius }); else if (o.type === 'image' && !(o as FraguaMaskObject).fraguaMaskId) o.set({ clipPath: value === 0 ? undefined : new fabric.Rect({ width: o.width, height: o.height, rx: radius, ry: radius, originX: 'center', originY: 'center' }) }); o.setCoords(); c.requestRenderAll(); snapshot(); syncUi(); }
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
  function toggleLayerVisible(object: fabric.FabricObject) { object.set({ visible: !object.visible }); object.dirty = true; canvas.current?.requestRenderAll(); snapshot(); syncUi(); }
  function toggleLayerLock(object: fabric.FabricObject) { const locked = object.selectable === false; object.set({ selectable: locked, evented: locked, lockMovementX: !locked, lockMovementY: !locked, lockScalingX: !locked, lockScalingY: !locked, lockRotation: !locked }); if (!locked) canvas.current?.discardActiveObject(); canvas.current?.requestRenderAll(); snapshot(); syncUi(); }
  function reorderLayer(draggedIndex: number, targetIndex: number) { const c = canvas.current; if (!c || draggedIndex === targetIndex) return; const visual = [...c.getObjects()].reverse(); const object = visual[draggedIndex]; const target = visual[targetIndex]; c.moveObjectTo(object, c.getObjects().indexOf(target)); c.requestRenderAll(); snapshot(); syncUi(); }
  function selectLayer(event: React.MouseEvent, object: fabric.FabricObject) { const c = canvas.current; if (!c || object.selectable === false) return; if (event.ctrlKey || event.metaKey || event.shiftKey) { const selected = c.getActiveObjects(); const objects = selected.includes(object) ? selected.filter((item) => item !== object) : [...selected, object]; c.discardActiveObject(); if (objects.length === 1) c.setActiveObject(objects[0]); else if (objects.length > 1) c.setActiveObject(new fabric.ActiveSelection(objects, { canvas: c })); } else c.setActiveObject(object); c.requestRenderAll(); syncUi(); }
  function renameLayer(object: fabric.FabricObject) { const current = String((object as fabric.FabricObject & { name?: string }).name || object.type); const nextName = window.prompt('Nombre de la capa', current); if (!nextName?.trim()) return; (object as fabric.FabricObject & { name?: string }).name = nextName.trim(); snapshot(); syncUi(); }
  function center() { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; c.centerObject(o); o.setCoords(); c.requestRenderAll(); snapshot(); }
  function alignToCanvas(mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') { const c = canvas.current; const o = c?.getActiveObject(); if (!c || !o) return; const bounds = o.getBoundingRect(); if (mode === 'centerH') c.centerObjectH(o); else if (mode === 'centerV') c.centerObjectV(o); else if (mode === 'left') o.set({ left: (o.left ?? 0) - bounds.left + 24 }); else if (mode === 'right') o.set({ left: (o.left ?? 0) + c.width - bounds.left - bounds.width - 24 }); else if (mode === 'top') o.set({ top: (o.top ?? 0) - bounds.top + 24 }); else o.set({ top: (o.top ?? 0) + c.height - bounds.top - bounds.height - 24 }); o.setCoords(); c.requestRenderAll(); snapshot(); }
  function alignSelection(mode: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom') { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active || active.type !== 'activeselection') return; const objects = (active as fabric.ActiveSelection).getObjects(); const rects = objects.map((object) => ({ object, rect: object.getBoundingRect() })); const left = Math.min(...rects.map(({ rect }) => rect.left)); const right = Math.max(...rects.map(({ rect }) => rect.left + rect.width)); const top = Math.min(...rects.map(({ rect }) => rect.top)); const bottom = Math.max(...rects.map(({ rect }) => rect.top + rect.height)); rects.forEach(({ object, rect }) => { let dx = 0; let dy = 0; if (mode === 'left') dx = left - rect.left; if (mode === 'centerH') dx = (left + right) / 2 - (rect.left + rect.width / 2); if (mode === 'right') dx = right - (rect.left + rect.width); if (mode === 'top') dy = top - rect.top; if (mode === 'centerV') dy = (top + bottom) / 2 - (rect.top + rect.height / 2); if (mode === 'bottom') dy = bottom - (rect.top + rect.height); object.set({ left: (object.left ?? 0) + dx, top: (object.top ?? 0) + dy }); object.setCoords(); }); active.setCoords(); c.requestRenderAll(); snapshot(); }
  function groupSelection() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active || active.type !== 'activeselection') return; const objects = (active as fabric.ActiveSelection).getObjects().slice(); c.discardActiveObject(); c.remove(...objects); const group = new fabric.Group(objects); c.add(group); c.setActiveObject(group); c.requestRenderAll(); snapshot(); syncUi(); setStatus(`${objects.length} elementos agrupados`); }
  function ungroupSelection() { const c = canvas.current; const active = c?.getActiveObject(); if (!c || !active || active.type !== 'group') return; const objects = (active as fabric.Group).removeAll(); c.remove(active); c.add(...objects); c.setActiveObject(new fabric.ActiveSelection(objects, { canvas: c })); c.requestRenderAll(); snapshot(); syncUi(); setStatus(`${objects.length} elementos desagrupados`); }
  function cropSelected() { const o = canvas.current?.getActiveObject(); if (!o || o.type !== 'image') { setStatus('Selecciona una imagen para recortarla'); return; } o.off('mousedblclick', enterCropMode); enterCropMode.call(enterCropMode, { target: o } as fabric.TPointerEventInfo); refreshCroppedImage(o); setStatus('Modo recorte activo · doble clic para terminar'); }
  function toggleSnapping() { const next = !snappingRef.current; snappingRef.current = next; setSnapping(next); snapGuides.current = {}; canvas.current?.requestRenderAll(); setStatus(next ? 'Ajuste magnético activado' : 'Ajuste magnético desactivado'); }
  function addColorToPalette(color: string) { setPalette((current) => [color, ...current.filter((item) => item.toLowerCase() !== color.toLowerCase())].slice(0, 7)); setStatus(`${color} añadido a la paleta rápida`); }
  async function saveProject(silent = false): Promise<boolean> {
    const c = canvas.current; if (!c) return false;
    const cleanName = name.trim() || 'Sin título'; if (!silent) setStatus('Guardando en este navegador…');
    try {
      const updatedPages = commitCurrentPage();
      const effectivePageId = updatedPages.some((page) => page.id === activePageId) ? activePageId : updatedPages[0]?.id;
      const isRenamedCopy = Boolean(projectId && savedNameRef.current && savedNameRef.current !== cleanName);
      const id = isRenamedCopy || !projectId ? createRecordId(cleanName) : projectId;
      await saveProjectRecord({ id, name: cleanName, width: c.width, height: c.height, background: String(c.backgroundColor || '#ffffff'), canvas: exportSafeJSON(c.toJSON()), pages: updatedPages.map((page) => ({ ...page, json: exportSafeJSON(page.json) })), activePageId: effectivePageId });
      setProjectId(id); savedNameRef.current = cleanName;
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); setLastSaved(time);
      if (!silent) setStatus(`${isRenamedCopy ? 'Copia creada' : 'Guardado en este navegador'} · ${id}`);
      await refreshProjects();
      return true;
    } catch (error) { setStatus(error instanceof Error ? `No se guardó: ${error.message}` : 'No se pudo guardar'); return false; }
  }
  async function loadProject(id: string) {
    if (!id || !canvas.current) return;
    setStatus('Abriendo…');
    try {
      const data = await getProject(id); if (!data) throw new Error('No encontré ese proyecto en este navegador.');
      const sourcePages: PageData[] = data.pages?.length ? data.pages : [{ id: `page-${Date.now()}`, name: 'Página 1', w: data.width, h: data.height, bg: data.background, json: data.canvas }];
      const incoming = await Promise.all(sourcePages.map(async (page) => ({ ...page, json: await hydrateCanvasJSON(page.json) })));
      setPagesSynced(incoming); const first = incoming.find((item) => item.id === data.activePageId) || incoming[0];
      setActivePageId(first.id); restoring.current = true; canvas.current.setDimensions({ width: first.w, height: first.h }); setSize({ w: first.w, h: first.h }); setCustomWidth(String(first.w)); setCustomHeight(String(first.h));
      await canvas.current.loadFromJSON(first.json); await prepareCanvasFonts(canvas.current); attachCrop(canvas.current); canvas.current.backgroundColor = first.bg; canvas.current.requestRenderAll(); restoring.current = false;
      setProjectId(data.id); setName(data.name); savedNameRef.current = data.name; history.current = []; historyIndex.current = -1; snapshot(); syncUi();
      setLastSaved(new Date(data.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); setStatus(`Proyecto abierto · ${incoming.length} página${incoming.length === 1 ? '' : 's'}`);
    } catch (error) { restoring.current = false; setStatus(error instanceof Error ? error.message : 'No pude abrir el proyecto'); }
  }
  async function duplicateAndResize() { const c = canvas.current; if (!c) return; const w = Math.round(Number(customWidth)); const h = Math.round(Number(customHeight)); if (w < 64 || h < 64 || w > 10000 || h > 10000) return setStatus('Define primero medidas válidas'); commitCurrentPage(); const temp = new fabric.StaticCanvas(undefined, { width: w, height: h, backgroundColor: c.backgroundColor }); await temp.loadFromJSON(c.toJSON()); const sx = w / c.width; const sy = h / c.height; temp.getObjects().forEach((o) => o.set({ left: (o.left ?? 0) * sx, top: (o.top ?? 0) * sy, scaleX: (o.scaleX ?? 1) * sx, scaleY: (o.scaleY ?? 1) * sy })); const page: PageData = { id: `page-${Date.now()}`, name: `Página ${pagesRef.current.length + 1} · ${w}×${h}`, w, h, bg: String(c.backgroundColor || '#fff'), json: temp.toJSON() }; temp.dispose(); setPagesSynced([...pagesRef.current, page]); await openPage(page.id); setStatus(`Copia creada en ${w} × ${h}px`); }
  async function saveTemplate() { const title = window.prompt('Nombre de la plantilla', `${name} base`); if (!title?.trim()) return; const pages = commitCurrentPage().map((page) => ({ ...page, json: exportSafeJSON(page.json) })); await saveLibrary('templates', { id: createRecordId(title), name: title.trim(), pages }); await refreshLibraries(); setStatus(`Plantilla “${title.trim()}” guardada en este navegador`); }
  async function useTemplate(id: string) {
    const data = await getLibrary('templates', id); if (!data || !Array.isArray(data.pages) || !canvas.current) return;
    const sourcePages = data.pages as PageData[];
    const cloned = await Promise.all(sourcePages.map(async (page, index) => ({ ...page, id: `page-${Date.now()}-${index}`, json: await hydrateCanvasJSON(page.json) })));
    setPagesSynced(cloned); const first = cloned[0]; setActivePageId(first.id); restoring.current = true;
    canvas.current.setDimensions({ width: first.w, height: first.h }); setSize({ w: first.w, h: first.h }); setCustomWidth(String(first.w)); setCustomHeight(String(first.h));
    await canvas.current.loadFromJSON(first.json); await prepareCanvasFonts(canvas.current); canvas.current.backgroundColor = first.bg; attachCrop(canvas.current); canvas.current.requestRenderAll(); restoring.current = false;
    setProjectId(''); savedNameRef.current = ''; setName(`${data.name} copia`); history.current = []; historyIndex.current = -1; snapshot(); syncUi(); setStatus('Plantilla aplicada como documento nuevo');
  }
  async function uploadBrandAssets(files: FileList | null, kind: 'logos' | 'images') { if (!files?.length) return; setBrandSaving(true); try { const uploaded: string[] = []; for (const file of [...files]) uploaded.push((await saveAsset(file, file.name)).url); setBrandDraft((current) => ({ ...current, [kind]: [...current[kind], ...uploaded] })); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude guardar los recursos de marca'); } finally { setBrandSaving(false); } }
  function openNewBrand() { setEditingBrandId(''); setBrandDraft({ name: '', fontFamily: 'Arial', colors: [...BRAND_PALETTES[0].colors], logos: [], images: [] }); setBrandModalOpen(true); }
  function editBrand(kit: BrandKit) { setEditingBrandId(kit.id); setBrandDraft({ name: kit.name, fontFamily: kit.fontFamily, colors: [...kit.colors], logos: [...kit.logos], images: [...kit.images] }); setBrandModalOpen(true); }
  async function saveBrand(event: React.FormEvent) { event.preventDefault(); const title = brandDraft.name.trim(); if (!title) return setStatus('Escribe un nombre para el kit'); setBrandSaving(true); try { const fontLoaded = await ensureGoogleFont(brandDraft.fontFamily); if (!fontLoaded) setStatus(`Kit guardado con fuente alternativa a ${brandDraft.fontFamily}`); const id = editingBrandId || createRecordId(title); await saveLibrary('brands', { ...brandDraft, id, name: title, logos: brandDraft.logos.map(stableAssetReference), images: brandDraft.images.map(stableAssetReference) }); await refreshLibraries(); setPalette(brandDraft.colors); setBrandModalOpen(false); setEditingBrandId(''); setBrandDraft({ name: '', fontFamily: 'Arial', colors: BRAND_PALETTES[0].colors, logos: [], images: [] }); setStatus(`Kit “${title}” ${editingBrandId ? 'actualizado' : 'creado'} en este navegador`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude guardar el kit'); } finally { setBrandSaving(false); } }
  async function deleteBrand() { if (!editingBrandId || !window.confirm(`¿Eliminar el kit “${brandDraft.name}”? Los recursos quedan disponibles para tus proyectos.`)) return; setBrandSaving(true); try { await deleteLibrary('brands', editingBrandId); if (activeBrandId === editingBrandId) setActiveBrandId(''); setBrandModalOpen(false); setEditingBrandId(''); await refreshLibraries(); setStatus(`Kit “${brandDraft.name}” eliminado`); } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude eliminar el kit'); } finally { setBrandSaving(false); } }
  async function useBrand(id: string) { const data = await getLibrary('brands', id); if (!data) return; if (Array.isArray(data.colors)) setPalette(data.colors as string[]); if (typeof data.fontFamily === 'string') { const loaded = await ensureGoogleFont(data.fontFamily); if (!loaded) setStatus(`No pude cargar ${data.fontFamily}; se usará una fuente alternativa`); if (inspector.isText) patchObject({ fontFamily: data.fontFamily }); } setActiveBrandId(id); setStatus(`Kit “${data.name}” activo · selecciona un recurso para insertarlo`); }
  async function addBrandAsset(src: string, label: string) {
    try {
      const response = await fetch(src); if (!response.ok) throw new Error('No pude leer el recurso del kit');
      const blob = await response.blob();
      if (blob.type === 'image/svg+xml' || src.toLowerCase().includes('.svg')) {
        const { objects, options } = await fabric.loadSVGFromString(await blob.text());
        const valid = objects.filter((object): object is fabric.FabricObject => Boolean(object)); if (!valid.length) throw new Error('El SVG está vacío');
        const vector = fabric.util.groupSVGElements(valid, options); const scale = 320 / Math.max(vector.width || 320, vector.height || 320);
        vector.set({ scaleX: scale, scaleY: scale, originX: 'center', originY: 'center' }); add(vector);
      } else {
        const asset = await saveAsset(blob, label); const image = await fabric.FabricImage.fromURL(asset.url); const scale = Math.min(600 / (image.width || 1), 600 / (image.height || 1), 1);
        image.scale(scale); add(image); if (canvas.current) attachCrop(canvas.current);
      }
      setStatus(`${label} insertado desde el kit de marca`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude insertar el recurso de marca'); }
  }
  async function renderPages(format: 'png' | 'jpeg') {
    const c = canvas.current;
    if (!c) return [];
    const list = commitCurrentPage();
    const active = activePageId;
    const output: { page: PageData; dataUrl: string }[] = [];
    const restore = list.find((page) => page.id === active) || list[0];
    try {
      for (const page of list) {
        c.setDimensions({ width: page.w, height: page.h });
        await c.loadFromJSON(page.json);
        await prepareCanvasFonts(c);
        c.backgroundColor = page.bg;
        c.discardActiveObject();
        c.requestRenderAll();
        output.push({ page, dataUrl: c.toDataURL({ format, quality: .94, multiplier: 1 }) });
      }
      return output;
    } finally {
      if (restore) {
        c.setDimensions({ width: restore.w, height: restore.h });
        await c.loadFromJSON(restore.json);
        await prepareCanvasFonts(c);
        c.backgroundColor = restore.bg;
        attachCrop(c);
        c.requestRenderAll();
        setSize({ w: restore.w, h: restore.h });
        syncUi();
      }
    }
  }
  async function exportDocument(format: 'png' | 'jpeg' | 'svg' | 'zip' | 'pdf') {
    const c = canvas.current;
    if (!c) return;
    setStatus('Preparando exportación…');
    if (format === 'svg') {
      const blob = new Blob([c.toSVG()], { type: 'image/svg+xml' });
      downloadBlob(blob, `${name}.svg`);
      return setStatus('SVG exportado');
    }
    try {
      const images = await renderPages(format === 'jpeg' ? 'jpeg' : 'png');
      if (!images.length) throw new Error('No hay páginas para exportar');
      if (format === 'png' || format === 'jpeg') {
        const item = images.find(({ page }) => page.id === activePageId) || images[0];
        const extension = format === 'jpeg' ? 'jpg' : 'png';
        const a = document.createElement('a'); a.href = item.dataUrl; a.download = `${safeDownloadName(name)}-${safeDownloadName(item.page.name)}.${extension}`; a.click();
        return setStatus(`${format.toUpperCase()} descargado a tu dispositivo`);
      }
      if (format === 'zip') {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        images.forEach(({ page, dataUrl }, index) => zip.file(`${String(index + 1).padStart(2, '0')}-${page.name}.png`, dataUrl.split(',')[1], { base64: true }));
        downloadBlob(await zip.generateAsync({ type: 'blob' }), `${name}.zip`);
        return setStatus('Páginas exportadas como ZIP');
      }
      const { jsPDF } = await import('jspdf');
      const first = images[0].page;
      const pdf = new jsPDF({ orientation: first.w >= first.h ? 'landscape' : 'portrait', unit: 'px', format: [first.w, first.h] });
      images.forEach(({ page, dataUrl }, index) => { if (index) pdf.addPage([page.w, page.h], page.w >= page.h ? 'landscape' : 'portrait'); pdf.addImage(dataUrl, 'PNG', 0, 0, page.w, page.h); });
      pdf.save(`${name}.pdf`);
      setStatus('PDF exportado');
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'SecurityError'
        ? 'No se pudo exportar porque una imagen externa bloquea el lienzo. Sustituye esa imagen por una guardada en assets.'
        : error instanceof Error ? error.message : 'No pude exportar el proyecto';
      setStatus(message);
    }
  }
  function downloadBlob(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function safeDownloadName(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'fragua'; }
  async function exportBrowserBackup() {
    setBackupBusy(true); setStatus('Preparando respaldo local…');
    try {
      if (canvas.current && !(await saveProject(true))) throw new Error('No pude guardar los cambios antes de crear el respaldo.');
      const { blob, counts } = await makeBrowserBackup(); downloadBlob(blob, backupFilename());
      setStatus(`Respaldo descargado · ${counts.projects} proyectos, ${counts.assets} recursos y bibliotecas`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude crear el respaldo'); }
    finally { setBackupBusy(false); }
  }
  async function importBrowserBackup(file?: File) {
    if (!file) return; setBackupBusy(true); setStatus('Importando respaldo al almacenamiento de este navegador…');
    try {
      const result = await restoreBrowserBackup(file); await refreshProjects(); await refreshLibraries();
      const note = result.jsonOnly ? ' El JSON no incluye imágenes; para conservarlas importa el ZIP de respaldo.' : '';
      setStatus(`Respaldo importado · ${result.projects} proyectos, ${result.assets} recursos, ${result.templates} plantillas y ${result.brands} kits.${note}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : 'No pude importar el respaldo'); }
    finally { setBackupBusy(false); if (backupFileRef.current) backupFileRef.current.value = ''; }
  }

  useEffect(() => { const key = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.matches('input, textarea, select')) return; if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); void travel(e.shiftKey ? 1 : -1); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void saveProject(); } if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); void duplicate(); } if ((e.key === 'Delete' || e.key === 'Backspace')) remove(); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); });
  useEffect(() => { const timer = window.setInterval(() => { if (projectId) void saveProject(true); }, 60_000); return () => window.clearInterval(timer); });
  useEffect(() => { if (!brandModalOpen) return; const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setBrandModalOpen(false); }; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; window.addEventListener('keydown', close); return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close); }; }, [brandModalOpen]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (brandModalOpen && GOOGLE_FONTS.includes(brandDraft.fontFamily)) void ensureGoogleFont(brandDraft.fontFamily); }, [brandModalOpen, brandDraft.fontFamily]);
  useEffect(() => {
    const selector = 'aside.sidebar section';
    const initialize = () => {
      const sections = [...document.querySelectorAll<HTMLElement>(selector)];
      sections.forEach((section) => {
        if (section.dataset.accordionReady) return;
        section.dataset.accordionReady = 'true';
        section.classList.add('accordion-section');
        const heading = section.querySelector<HTMLElement>(':scope > h2');
        if (!heading) return;
        heading.setAttribute('role', 'button');
        heading.tabIndex = 0;
        const shouldOpen = document.querySelectorAll(`${selector}.accordion-open`).length < 2;
        section.classList.toggle('accordion-open', shouldOpen);
        heading.setAttribute('aria-expanded', String(shouldOpen));
      });
    };
    const toggle = (heading: HTMLElement) => {
      const section = heading.parentElement;
      if (!section?.matches(selector)) return;
      const opening = !section.classList.contains('accordion-open');
      if (opening) {
        const open = [...document.querySelectorAll<HTMLElement>(`${selector}.accordion-open`)].filter((item) => item !== section);
        while (open.length >= 2) {
          const oldest = open.shift();
          oldest?.classList.remove('accordion-open');
          oldest?.querySelector(':scope > h2')?.setAttribute('aria-expanded', 'false');
        }
      }
      section.classList.toggle('accordion-open', opening);
      heading.setAttribute('aria-expanded', String(opening));
    };
    const click = (event: Event) => { const heading = (event.target as HTMLElement).closest<HTMLElement>('aside.sidebar section > h2'); if (heading) toggle(heading); };
    const key = (event: KeyboardEvent) => { const heading = (event.target as HTMLElement).closest<HTMLElement>('aside.sidebar section > h2'); if (heading && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggle(heading); } };
    initialize();
    const observer = new MutationObserver(initialize); observer.observe(document.querySelector('.workspace') || document.body, { childList: true, subtree: true });
    document.addEventListener('click', click); document.addEventListener('keydown', key);
    return () => { observer.disconnect(); document.removeEventListener('click', click); document.removeEventListener('keydown', key); };
  }, []);

  return <main className="app-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">F</span><div><strong>Fragua</strong><small>Editor gráfico abierto, local y sin cuentas · <a className="brand-credit" href="https://rtsi.site" target="_blank" rel="noreferrer">.Site de RTSI</a></small></div></div>
      <label className="project-name"><span>Nombre del proyecto</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="top-actions"><span className="save-time">{lastSaved}</span><button type="button" className="button ghost" onClick={() => void saveProject()}><Save /> Guardar</button><select className="export-select" aria-label="Formato de exportación" defaultValue="" onChange={(e) => { if (e.target.value) void exportDocument(e.target.value as 'png' | 'jpeg' | 'svg' | 'zip' | 'pdf'); e.target.value = ''; }}><option value="">Exportar…</option><option value="png">PNG actual</option><option value="jpeg">JPEG actual</option><option value="svg">SVG actual</option><option value="zip">Todas · ZIP</option><option value="pdf">Todas · PDF</option></select><button type="button" className="button primary" onClick={() => void exportDocument('png')}><Download /> PNG</button></div>
    </header>
    <div className="workspace">
      <aside className="sidebar left-panel">
        <div className="left-panel-content">
        <section><h2>Agregar</h2><div className="tool-grid"><button onClick={addText}><Type/><span>Texto</span></button><button onClick={addRect}><Square/><span>Rectángulo</span></button><button onClick={addCircle}><Circle/><span>Círculo</span></button><button onClick={() => setShapeSoupModalOpen(true)}><Waves/><span>Formas</span></button><label className="tool"><ImagePlus/><span>Imagen</span><input type="file" accept="image/*" hidden onChange={(e) => void uploadImage(e.target.files?.[0])}/></label></div></section>
        <section><h2>Lienzo</h2><label className="field">Formato<select value={SIZES.some((s) => s.w === size.w && s.h === size.h) ? `${size.w}x${size.h}` : 'custom'} onChange={(e) => { if (e.target.value === 'custom') return; const [w,h] = e.target.value.split('x').map(Number); resize(w,h); }}>{SIZES.map((s) => <option key={s.name} value={`${s.w}x${s.h}`}>{s.name} · {s.w}×{s.h}</option>)}<option value="custom">Personalizado · {size.w}×{size.h}</option></select></label><div className="custom-size"><label>Ancho<input type="number" min="64" max="10000" inputMode="numeric" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCustomSize(); }}/></label><span>×</span><label>Alto<input type="number" min="64" max="10000" inputMode="numeric" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyCustomSize(); }}/></label></div><button className="apply-size" onClick={applyCustomSize}>Aplicar tamaño libre</button><button className="secondary-size" onClick={() => void duplicateAndResize()}>Duplicar y redimensionar</button><p className="size-help">De 64 a 10,000 px por lado.</p><label className="field">Fondo<input type="color" value={String(canvas.current?.backgroundColor || '#ffffff')} onChange={(e) => { if (canvas.current) { canvas.current.backgroundColor = e.target.value; canvas.current.requestRenderAll(); snapshot(); } }}/></label></section>
        <section>
          <h2>Biblioteca</h2>
          <div className="media-tabs"><button className={mediaMode === 'photos' ? 'active' : ''} onClick={() => setMediaMode('photos')}>Fotos</button><button className={mediaMode === 'icons' ? 'active' : ''} onClick={() => setMediaMode('icons')}>Iconos</button></div>
          <form className="media-search" onSubmit={(e) => void searchMedia(e)}><input aria-label={mediaMode === 'photos' ? 'Buscar en Pexels' : 'Buscar en Iconify'} value={mediaQuery} onChange={(e) => setMediaQuery(e.target.value)} placeholder={mediaMode === 'photos' ? 'Buscar fotos…' : 'Buscar iconos…'}/><button disabled={mediaLoading}>{mediaLoading ? '…' : 'Buscar'}</button></form>
          {mediaMode === 'photos' && <div className="pexels-tools"><a href="https://www.pexels.com" target="_blank" rel="noreferrer">Fotos proporcionadas por Pexels</a>{editingPexelsKey ? <form onSubmit={(e) => { e.preventDefault(); savePexelsKey(); }}><label>Tu clave API de Pexels<input type="password" autoComplete="off" value={pexelsKeyDraft} onChange={(e) => setPexelsKeyDraft(e.target.value)} placeholder="Pega aquí tu clave"/></label><small>Se guarda solo en este navegador y no se incluye en los proyectos ni respaldos. Pexels recibe la clave al buscar.</small><div><button type="submit">Guardar clave</button><button type="button" onClick={() => { setPexelsKeyDraft(pexelsKey); setEditingPexelsKey(false); }}>Cancelar</button>{pexelsKey && <button type="button" onClick={() => { setPexelsKeyDraft(''); window.localStorage.removeItem('fragua.pexels-key'); setPexelsKey(''); setEditingPexelsKey(false); }}>Quitar</button>}</div></form> : <button className="pexels-key-button" onClick={() => { setPexelsKeyDraft(pexelsKey); setEditingPexelsKey(true); }}>{pexelsKey ? 'Cambiar clave de Pexels' : 'Configurar clave de Pexels'}</button>}</div>}
          {mediaMode === 'photos' ? <div className="media-grid">{media.map((item) => <button key={item.id} onClick={() => void addStockImage(item)} title={`${item.alt} · ${item.photographer}`}><img src={item.thumb} alt={item.alt || `Foto de ${item.photographer}`}/><span>{item.photographer}</span></button>)}</div> : <div className="icon-grid">{icons.map((icon) => { const [prefix, iconName] = icon.split(':'); return <button key={icon} title={icon} onClick={() => void addIcon(icon)}><img src={`https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(iconName)}.svg?color=%2318181b`} alt=""/><span>{iconName}</span></button>; })}</div>}
        </section>
        <section>
          <h2>Abrir proyecto</h2>
          <select aria-label="Abrir proyecto" value="" onChange={(e) => void loadProject(e.target.value)}><option value="">Seleccionar…</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <p className="hint"><FolderOpen/> {projects.length} guardado{projects.length === 1 ? '' : 's'} en este navegador</p>
          <div className="backup-actions"><button className="wide-action" onClick={() => void exportBrowserBackup()} disabled={backupBusy}><Download/> {backupBusy ? 'Procesando…' : 'Descargar respaldo ZIP'}</button><label className={`wide-action ${backupBusy ? 'is-disabled' : ''}`}><FolderOpen/> Importar respaldo<input ref={backupFileRef} type="file" accept=".zip,.json,application/zip,application/json" hidden disabled={backupBusy} onChange={(e) => void importBrowserBackup(e.target.files?.[0])}/></label></div>
          <p className="local-storage-note">Proyectos y recursos viven en el almacenamiento de este navegador. Descarga respaldos ZIP con JSON, imágenes, plantillas y kits; impórtalos en otro navegador o dominio.</p>
        </section>
        <section><h2>Plantillas</h2><button className="wide-action" onClick={() => void saveTemplate()}><Save/> Guardar como plantilla</button><select aria-label="Usar plantilla" value="" onChange={(e) => void useTemplate(e.target.value)}><option value="">Usar una plantilla…</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></section>
        <section><h2>Kits de marca</h2><button className="wide-action" onClick={openNewBrand}><Plus/> Crear kit de marca</button><div className="brand-grid">{brands.map((kit) => { const preview = kit.images[0] || kit.logos[0]; return <button key={kit.id} className={`brand-card ${kit.id === activeBrandId ? 'active' : ''}`} onClick={() => void useBrand(kit.id)} onDoubleClick={(event) => { event.preventDefault(); editBrand(kit); }} title="Clic para activar · doble clic para editar"><div className="brand-visual">{preview ? <img src={preview} alt=""/> : <span style={{ background: kit.colors[0] || '#eee' }}/>}<div className="brand-colors">{kit.colors.slice(0,3).map((color) => <i key={color} style={{ background: color }}/>)}</div></div><strong style={{ fontFamily: kit.fontFamily }}>{kit.name}</strong><small>{kit.fontFamily}</small></button>; })}</div>{activeBrandId && (() => { const kit = brands.find((item) => item.id === activeBrandId); if (!kit) return null; return <div className="brand-assets"><h3>Recursos de {kit.name}</h3>{kit.logos.length > 0 && <><small>Logos</small><div>{kit.logos.map((src, index) => <button key={src} onClick={() => void addBrandAsset(src, `Logo ${index + 1}`)} title="Insertar logo"><img src={src} alt={`Logo ${index + 1}`}/></button>)}</div></>}{kit.images.length > 0 && <><small>Imágenes</small><div>{kit.images.map((src, index) => <button key={src} onClick={() => void addBrandAsset(src, `Imagen ${index + 1}`)} title="Insertar imagen"><img src={src} alt={`Imagen ${index + 1}`}/></button>)}</div></>}{!kit.logos.length && !kit.images.length && <p className="size-help">Este kit no tiene recursos visuales.</p>}</div>; })()}{!brands.length && <p className="size-help">Todavía no hay kits. Crea el primero.</p>}</section>
        </div>
      </aside>
      <section className="stage-column">
        <div className="stage-toolbar"><div><button aria-label="Deshacer" disabled={!canUndo} onClick={() => void travel(-1)}><Undo2/></button><button aria-label="Rehacer" disabled={!canRedo} onClick={() => void travel(1)}><Redo2/></button><span className="divider"/><button aria-label="Duplicar" disabled={!selected} onClick={() => void duplicate()}><Copy/></button><button aria-label="Eliminar" disabled={!selected} onClick={remove}><Trash2/></button><span className="divider"/><button className={snapping ? 'is-active' : ''} aria-label={snapping ? 'Desactivar ajuste magnético' : 'Activar ajuste magnético'} aria-pressed={snapping} onClick={toggleSnapping}><Magnet/></button><button aria-label="Abrir extractor de color" title="Extraer color de una imagen" onClick={() => setColorModalOpen(true)}><Pipette/></button>{maskEditingId && <button className="mask-edit-finish" onClick={finishMaskEditing}><Crop/> Terminar máscara</button>}</div><label className="zoom">{zoom}%<input type="range" min="20" max="300" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}/></label></div>
        <div ref={stageRef} className={`stage ${isPanning ? 'is-panning' : ''}`} onPointerDown={(event) => { const target = event.target; if (target instanceof Element && !target.closest('.canvas-frame')) startPan(event.clientX, event.clientY); }}><div className="canvas-frame" style={{ width: size.w * zoom / 100, height: size.h * zoom / 100 }}><div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top left' }}><canvas ref={canvasNode}/></div></div></div>
        <div className="page-strip"><button className="add-page" onClick={() => addPage(false)}><FilePlus2/> Nueva</button>{pages.map((page, index) => <div key={page.id} className={`page-chip ${page.id === activePageId ? 'active' : ''}`}><button onClick={() => void openPage(page.id)} onDoubleClick={() => renamePage(page.id)} title="Doble clic para renombrar">{page.thumb ? <img src={page.thumb} alt=""/> : <span>{index + 1}</span>}<small>{page.name}</small></button><div><button disabled={index === 0} onClick={() => movePage(page.id, -1)}>←</button><button onClick={() => { if (page.id === activePageId) addPage(true); }}>＋</button><button disabled={pages.length === 1} onClick={() => void deletePage(page.id)}>×</button><button disabled={index === pages.length - 1} onClick={() => movePage(page.id, 1)}>→</button></div></div>)}</div>
        <footer className="status"><span className="status-dot"/>{status}<span>{size.w} × {size.h}px</span></footer>
      </section>
      <aside className="sidebar right-panel">
        <div className="right-panel-content">
        <section><h2>Propiedades</h2>{selected ? <><label className="field">Color<input type="color" value={inspector.fill} onChange={(e) => patchObject({ fill: e.target.value })}/></label>{inspector.isText && <div className="text-tools"><label>Fuente<select value={inspector.fontFamily} onChange={(e) => patchObject({ fontFamily: e.target.value })}><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option><option>Times New Roman</option><GoogleFontOptions/></select></label><label>Tamaño<input type="number" min="8" max="500" value={inspector.fontSize} onChange={(e) => patchObject({ fontSize: Number(e.target.value) })}/></label><div className="text-buttons"><button className={Number(inspector.fontWeight) >= 600 ? 'active' : ''} onClick={() => patchObject({ fontWeight: Number(inspector.fontWeight) >= 600 ? 400 : 700 })}><b>B</b></button><button className={inspector.fontStyle === 'italic' ? 'active' : ''} onClick={() => patchObject({ fontStyle: inspector.fontStyle === 'italic' ? 'normal' : 'italic' })}><i>I</i></button><button className={inspector.underline ? 'active' : ''} onClick={() => patchObject({ underline: !inspector.underline })}><u>U</u></button><select aria-label="Alineación del texto" value={inspector.textAlign} onChange={(e) => patchObject({ textAlign: e.target.value })}><option value="left">Izq.</option><option value="center">Centro</option><option value="right">Der.</option><option value="justify">Justificar</option></select></div><label>Espaciado <span>{inspector.charSpacing}</span><input type="range" min="-100" max="500" value={inspector.charSpacing} onChange={(e) => patchObject({ charSpacing: Number(e.target.value) })}/></label><label>Interlínea <span>{inspector.lineHeight.toFixed(1)}</span><input type="range" min="0.7" max="2.5" step="0.1" value={inspector.lineHeight} onChange={(e) => patchObject({ lineHeight: Number(e.target.value) })}/></label></div>}<label className="field">Opacidad <span>{inspector.opacity}%</span><input type="range" min="5" max="100" value={inspector.opacity} onChange={(e) => patchObject({ opacity: Number(e.target.value) / 100 })}/></label><label className="field">Rotación <span>{inspector.angle}°</span><input type="range" min="-180" max="180" value={inspector.angle} onChange={(e) => patchObject({ angle: Number(e.target.value) })}/></label>{inspector.canRound && <label className="field">Radio de esquinas <span>{inspector.radius}%</span><input type="range" min="0" max="100" value={inspector.radius} onChange={(e) => applyRadius(Number(e.target.value))}/></label>}<div className="effect-row"><label><input type="checkbox" checked={inspector.shadowOn} onChange={(e) => applyShadow(e.target.checked)}/> Sombra</label>{inspector.shadowOn && <span>{inspector.shadowIntensity}%</span>}</div>{inspector.shadowOn && <label className="field shadow-slider">Intensidad<input type="range" min="0" max="100" value={inspector.shadowIntensity} onChange={(e) => applyShadow(true, Number(e.target.value))}/></label>}{inspector.isImage && <><button className="wide-action" onClick={cropSelected}><Crop/> Recortar imagen</button><label className="wide-action"><ImagePlus/> Reemplazar imagen<input type="file" accept="image/*" hidden onChange={(e) => void replaceImage(e.target.files?.[0])}/></label></>}<div className="row"><button onClick={center}><AlignCenter/> Centrar</button><button onClick={() => layer('front')}><BringToFront/> Frente</button><button onClick={() => layer('back')}><SendToBack/> Fondo</button></div></> : <div className="empty">Selecciona un elemento para editarlo.</div>}</section>
        {selected && <section><h2>Alinear</h2><p className="section-help">{selectionType === 'multiple' ? 'Respecto a la selección' : 'Respecto al lienzo'}</p><div className="align-grid"><button title="Izquierda" aria-label="Alinear a la izquierda" onClick={() => selectionType === 'multiple' ? alignSelection('left') : alignToCanvas('left')}><AlignHorizontalJustifyStart/></button><button title="Centro horizontal" aria-label="Centrar horizontalmente" onClick={() => selectionType === 'multiple' ? alignSelection('centerH') : alignToCanvas('centerH')}><AlignHorizontalJustifyCenter/></button><button title="Derecha" aria-label="Alinear a la derecha" onClick={() => selectionType === 'multiple' ? alignSelection('right') : alignToCanvas('right')}><AlignHorizontalJustifyEnd/></button><button title="Arriba" aria-label="Alinear arriba" onClick={() => selectionType === 'multiple' ? alignSelection('top') : alignToCanvas('top')}><AlignVerticalJustifyStart/></button><button title="Centro vertical" aria-label="Centrar verticalmente" onClick={() => selectionType === 'multiple' ? alignSelection('centerV') : alignToCanvas('centerV')}><AlignVerticalJustifyCenter/></button><button title="Abajo" aria-label="Alinear abajo" onClick={() => selectionType === 'multiple' ? alignSelection('bottom') : alignToCanvas('bottom')}><AlignVerticalJustifyEnd/></button></div>{selectionType === 'multiple' && canCreateMask() && <button className="wide-action" onClick={createMask}><Crop/> Crear máscara de recorte</button>}{selectionType === 'multiple' && <button className="wide-action" onClick={groupSelection}><Group/> Agrupar selección</button>}{selectionType === 'group' && <button className="wide-action" onClick={ungroupSelection}><Ungroup/> Desagrupar</button>}</section>}
        <section className="layers"><h2><Layers3/> Capas <span>{layers.length}</span></h2><p className="section-help">Arrastra para ordenar · Shift/Ctrl para seleccionar varias · doble clic para renombrar.</p>{layers.length ? layers.map((o, i) => <div key={`${o.type}-${i}`} draggable onDragStart={(e) => e.dataTransfer.setData('text/layer-index', String(i))} onDragOver={(e) => e.preventDefault()} onDrop={(e) => reorderLayer(Number(e.dataTransfer.getData('text/layer-index')), i)} className={`layer-row ${canvas.current?.getActiveObjects().includes(o) ? 'active' : ''}`}><button className="layer-main" onClick={(e) => selectLayer(e, o)} onDoubleClick={() => renameLayer(o)}><span className="layer-icon">{o.type === 'textbox' ? 'T' : o.type === 'image' ? 'IMG' : '◆'}</span><span>{String((o as fabric.FabricObject & { name?: string }).name || (o.type === 'textbox' ? (o as fabric.Textbox).text : `${o.type} ${layers.length - i}`)).slice(0, 18)}</span></button><button aria-label={o.visible ? 'Ocultar capa' : 'Mostrar capa'} onClick={() => toggleLayerVisible(o)}>{o.visible ? <Eye/> : <EyeOff/>}</button><button aria-label={o.selectable === false ? 'Desbloquear capa' : 'Bloquear capa'} onClick={() => toggleLayerLock(o)}>{o.selectable === false ? <Lock/> : <Unlock/>}</button></div>) : <div className="empty">Tu lienzo está vacío.</div>}</section>
        <section><h2>Paleta rápida</h2><div className="swatches">{palette.map((color) => <button key={color} aria-label={`Usar ${color}`} style={{ background: color }} onClick={() => selected ? patchObject({ fill: color }) : undefined}/>)}</div></section>
        {selected && inspector.canStroke && <section><h2>Trazo</h2><label className="field">Color del trazo<input type="color" value={inspector.stroke} onChange={(e) => patchObject({ stroke: e.target.value })}/></label></section>}
        </div>
        <nav className="right-panel-footer" aria-label="Ayuda y créditos"><a href="/wiki">Wiki</a><a href="/legal">Créditos</a></nav>
      </aside>
    </div>
    {brandModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setBrandModalOpen(false); }}><div className="brand-modal" role="dialog" aria-modal="true" aria-labelledby="brand-modal-title"><header><div><span>Identidad visual</span><h2 id="brand-modal-title">{editingBrandId ? 'Editar kit de marca' : 'Crear kit de marca'}</h2></div><button type="button" aria-label="Cerrar" onClick={() => setBrandModalOpen(false)}><X/></button></header><form onSubmit={(e) => void saveBrand(e)}><label className="modal-field">Nombre del kit<input autoFocus required value={brandDraft.name} onChange={(e) => setBrandDraft((current) => ({ ...current, name: e.target.value }))} placeholder="Ej. Marca principal"/></label><label className="modal-field">Tipografía<select value={brandDraft.fontFamily} onChange={(e) => setBrandDraft((current) => ({ ...current, fontFamily: e.target.value }))}><option>Arial</option><option>Georgia</option><option>Verdana</option><option>Trebuchet MS</option><option>Courier New</option><option>Times New Roman</option><GoogleFontOptions/></select></label><label className="modal-field">Paleta base<select onChange={(e) => { const chosen = BRAND_PALETTES[Number(e.target.value)]; if (chosen) setBrandDraft((current) => ({ ...current, colors: [...chosen.colors] })); }}>{BRAND_PALETTES.map((item, index) => <option key={item.name} value={index}>{item.name}</option>)}</select></label><fieldset><legend>Colores</legend><div className="brand-color-editors">{brandDraft.colors.map((color, index) => <label key={index}><input type="color" value={color} onChange={(e) => setBrandDraft((current) => ({ ...current, colors: current.colors.map((item, itemIndex) => itemIndex === index ? e.target.value : item) }))}/><span>{color}</span></label>)}</div></fieldset><div className="asset-upload-grid"><label><strong>Logos</strong><span>PNG, JPG, WebP o SVG</span><input type="file" accept="image/*,.svg" multiple onChange={(e) => void uploadBrandAssets(e.target.files, 'logos')}/></label><label><strong>Imágenes</strong><span>Fotos y recursos de marca</span><input type="file" accept="image/*" multiple onChange={(e) => void uploadBrandAssets(e.target.files, 'images')}/></label></div>{(brandDraft.logos.length > 0 || brandDraft.images.length > 0) && <div className="asset-preview">{[...brandDraft.logos, ...brandDraft.images].map((src) => <img key={src} src={src} alt=""/>)}</div>}<footer>{editingBrandId && <button type="button" className="button danger" onClick={() => void deleteBrand()} disabled={brandSaving}><Trash2/> Eliminar kit</button>}<span className="modal-spacer"/><button type="button" className="button ghost" onClick={() => setBrandModalOpen(false)}>Cancelar</button><button type="submit" className="button primary" disabled={brandSaving}>{brandSaving ? 'Guardando…' : editingBrandId ? 'Guardar cambios' : 'Crear kit'}</button></footer></form></div></div>}
    {shapeSoupModalOpen && <ShapeSoupModal onClose={closeShapeSoupModal} onInsert={insertShapeSoup}/>}
    {colorModalOpen && <ColorExtractorModal onClose={() => setColorModalOpen(false)} canApplyFill={selected && inspector.canFill} canApplyStroke={selected && inspector.canStroke} onApplyFill={(color) => patchObject({ fill: color })} onApplyStroke={(color) => patchObject({ stroke: color })} onAddPalette={addColorToPalette}/>}
  </main>;
}
