// SPDX-License-Identifier: MPL-2.0
'use client';

import { useEffect, useRef, useState } from 'react';
import { Shapes, X } from 'lucide-react';

type TraceOptions = {
  ltres: number;
  qtres: number;
  pathomit: number;
  numberofcolors: number;
  colorsampling: number;
  colorquantcycles: number;
  strokewidth: number;
  scale: number;
  viewbox: boolean;
  pal?: { r: number; g: number; b: number; a: number }[];
};
type TraceEngine = { imagedataToSVG: (image: ImageData, options: TraceOptions) => string };
type Props = { source: HTMLCanvasElement; onClose: () => void; onInsert: (svg: string) => Promise<void> };

export default function ImageTraceModal({ source, onClose, onInsert }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const imageData = useRef<ImageData | null>(null);
  const [sourcePreview, setSourcePreview] = useState('');
  const [vectorPreview, setVectorPreview] = useState('');
  const [svg, setSvg] = useState('');
  const [mode, setMode] = useState<'color' | 'silhouette'>('color');
  const [colors, setColors] = useState(8);
  const [detail, setDetail] = useState(6);
  const [tracing, setTracing] = useState(true);
  const [inserting, setInserting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !inserting) onClose(); };
    window.addEventListener('keydown', keydown);
    closeButton.current?.focus();
    return () => window.removeEventListener('keydown', keydown);
  }, [inserting, onClose]);

  useEffect(() => {
    try {
      const maxDimension = 900;
      const ratio = Math.min(maxDimension / Math.max(source.width, source.height), 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * ratio));
      canvas.height = Math.max(1, Math.round(source.height * ratio));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('El navegador no pudo preparar esta imagen.');
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      imageData.current = context.getImageData(0, 0, canvas.width, canvas.height);
      setSourcePreview(canvas.toDataURL('image/png'));
      setError('');
    } catch {
      imageData.current = null;
      setError('No pude leer los píxeles de esta imagen. Prueba con una imagen guardada o subida en este navegador.');
      setTracing(false);
    }
  }, [source]);

  useEffect(() => {
    if (!imageData.current) return;
    let cancelled = false;
    setTracing(true); setError('');
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const imported = await import('imagetracerjs');
          const tracer = (imported.default || imported) as TraceEngine;
          const detailRatio = (detail - 1) / 9;
          const options: TraceOptions = {
            ltres: Number((2.5 - detailRatio * 2.1).toFixed(2)),
            qtres: Number((2.2 - detailRatio * 1.8).toFixed(2)),
            pathomit: Math.round(16 * (1 - detailRatio)),
            numberofcolors: mode === 'silhouette' ? 2 : colors,
            colorsampling: mode === 'silhouette' ? 0 : 2,
            colorquantcycles: 3,
            strokewidth: 0,
            scale: 1,
            viewbox: true,
          };
          if (mode === 'silhouette') options.pal = [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 0 }];
          const original = imageData.current!;
          const result = tracer.imagedataToSVG(new ImageData(new Uint8ClampedArray(original.data), original.width, original.height), options);
          if (!/<path\b/i.test(result)) throw new Error('No encontré formas en esta imagen. Prueba otro nivel de detalle o el modo a color.');
          if (!cancelled) setSvg(result);
        } catch (cause) {
          if (!cancelled) { setSvg(''); setError(cause instanceof Error ? cause.message : 'No pude vectorizar esta imagen.'); }
        } finally { if (!cancelled) setTracing(false); }
      })();
    }, 120);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [colors, detail, mode, sourcePreview]);

  useEffect(() => {
    if (!svg) { setVectorPreview(''); return; }
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    setVectorPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [svg]);

  async function insert() {
    if (!svg || tracing || inserting) return;
    setInserting(true); setError('');
    try { await onInsert(svg); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pude añadir el vector al lienzo.'); }
    finally { setInserting(false); }
  }

  const pathCount = (svg.match(/<path\b/gi) || []).length;
  const fileSize = svg ? `${Math.max(1, Math.round(new Blob([svg]).size / 1024))} KB` : '';

  return <div className="trace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !inserting) onClose(); }}>
    <section className="trace-modal" role="dialog" aria-modal="true" aria-labelledby="trace-modal-title" aria-describedby="trace-modal-help">
      <header><div><span>Herramienta de imagen</span><h2 id="trace-modal-title">Vectorizar imagen</h2></div><button ref={closeButton} type="button" aria-label="Cerrar vectorización" onClick={onClose} disabled={inserting}><X/></button></header>
      <div className="trace-modal-body">
        <p id="trace-modal-help" className="trace-modal-help">Convierte los píxeles en formas SVG editables. El procesamiento ocurre en este navegador; la imagen original se conserva.</p>
        <div className="trace-mode" role="group" aria-label="Estilo del trazado">
          <button type="button" className={mode === 'color' ? 'active' : ''} aria-pressed={mode === 'color'} onClick={() => setMode('color')}>A color</button>
          <button type="button" className={mode === 'silhouette' ? 'active' : ''} aria-pressed={mode === 'silhouette'} onClick={() => setMode('silhouette')}>Silueta</button>
        </div>
        <div className="trace-options">
          <label>Número de colores <select value={colors} disabled={mode === 'silhouette'} onChange={(event) => setColors(Number(event.target.value))}><option value={4}>4 colores</option><option value={8}>8 colores</option><option value={16}>16 colores</option><option value={32}>32 colores</option></select></label>
          <label>Detalle <span>{detail}/10</span><input type="range" min="1" max="10" value={detail} onChange={(event) => setDetail(Number(event.target.value))}/></label>
        </div>
        {mode === 'silhouette' && <p className="trace-hint">Los tonos claros se vuelven transparentes y los oscuros forman la silueta. Ideal para imágenes con fondo sencillo.</p>}
        <div className="trace-previews">
          <figure><figcaption>Original</figcaption>{sourcePreview ? <img src={sourcePreview} alt="Imagen original a vectorizar"/> : <div className="trace-placeholder">Preparando imagen…</div>}</figure>
          <figure><figcaption>Vector · vista previa</figcaption>{vectorPreview ? <img src={vectorPreview} alt="Previsualización del trazado vectorial"/> : <div className="trace-placeholder" role="status">{tracing ? 'Trazando formas…' : error || 'Ajusta el trazado para generar la vista previa.'}</div>}</figure>
        </div>
        {error && <p className="trace-error" role="alert">{error}</p>}
        <p className="trace-stats" aria-live="polite">{tracing ? 'Actualizando trazado…' : svg ? `${pathCount} formas · ${fileSize} · máximo 900 px para mantener el editor ágil` : 'La vista previa aparecerá aquí.'}</p>
        <footer><button type="button" className="button ghost" onClick={onClose} disabled={inserting}>Cancelar</button><button type="button" className="button primary" onClick={() => void insert()} disabled={!svg || tracing || inserting}><Shapes/>{inserting ? 'Insertando…' : 'Añadir vector al lienzo'}</button></footer>
      </div>
    </section>
  </div>;
}
