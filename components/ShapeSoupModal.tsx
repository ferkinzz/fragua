'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { generatePattern, type GeneratorType } from '@shapesoup/core';
import { Dice5, X } from 'lucide-react';

type ShapeType = Extract<GeneratorType, 'wave' | 'layeredWaves' | 'stackedWaves' | 'blob' | 'layeredPeaks' | 'dotMatrix' | 'bauhausPattern'>;
type Props = { onClose: () => void; onInsert: (svg: string, label: string) => Promise<boolean> };
const SHAPES: { value: ShapeType; label: string }[] = [
  { value: 'wave', label: 'Onda' },
  { value: 'layeredWaves', label: 'Ondas suaves' },
  { value: 'stackedWaves', label: 'Ondas geométricas' },
  { value: 'blob', label: 'Forma orgánica' },
  { value: 'layeredPeaks', label: 'Picos / montañas' },
  { value: 'dotMatrix', label: 'Puntos' },
  { value: 'bauhausPattern', label: 'Geométrica' },
];

export default function ShapeSoupModal({ onClose, onInsert }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [type, setType] = useState<ShapeType>('layeredWaves');
  const [seed, setSeed] = useState('ola-1');
  const [detail, setDetail] = useState(12);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(500);
  const [colors, setColors] = useState(['#ff4d6d', '#ffb703', '#3a86ff', '#8338ec']);
  const [inserting, setInserting] = useState(false);
  const selected = SHAPES.find((shape) => shape.value === type)?.label ?? 'Forma';
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); previousFocus?.focus(); };
  }, [onClose]);
  const result = useMemo(() => {
    const config: Record<string, unknown> = { width, height, seed, colors: colors.filter(Boolean), backgroundColor: 'transparent' };
    if (type === 'wave') Object.assign(config, { amplitude: detail * 6, points: detail });
    if (type === 'layeredWaves' || type === 'stackedWaves') Object.assign(config, { amplitude: detail * 6, layerCount: Math.max(2, Math.round(detail / 3)) });
    if (type === 'blob') Object.assign(config, { complexity: detail, contrast: 0.35 });
    if (type === 'layeredPeaks') Object.assign(config, { peakCount: detail, layerCount: Math.max(2, Math.round(detail / 3)), roughness: 0.35 });
    if (type === 'dotMatrix') Object.assign(config, { columns: detail, rows: Math.max(4, Math.round(detail * height / width)), density: 0.85, backgroundColor: 'transparent' });
    if (type === 'bauhausPattern') Object.assign(config, { shapeCount: detail + 4, backgroundColor: 'transparent' });
    return generatePattern({ type, config });
  }, [type, seed, detail, width, height, colors]);

  async function insert() {
    setInserting(true);
    try { if (await onInsert(result.svg, `ShapeSoup · ${selected}`)) onClose(); }
    finally { setInserting(false); }
  }

  return <div className="modal-backdrop shapesoup-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !inserting) onClose(); }}>
    <section ref={dialogRef} className="shapesoup-modal" role="dialog" aria-modal="true" aria-labelledby="shapesoup-title" tabIndex={-1} onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <header><div><span>Generador vectorial</span><h2 id="shapesoup-title">Formas y ondas</h2></div><button type="button" aria-label="Cerrar" onClick={onClose}><X/></button></header>
      <div className="shapesoup-content">
        <div className="shapesoup-controls">
          <label>Tipo de forma<select value={type} onChange={(event) => setType(event.target.value as ShapeType)}>{SHAPES.map((shape) => <option key={shape.value} value={shape.value}>{shape.label}</option>)}</select></label>
          <label>Semilla <span>Repite el mismo resultado con la misma semilla</span><div className="shapesoup-seed"><input value={seed} onChange={(event) => setSeed(event.target.value)} maxLength={50}/><button type="button" title="Crear una variación" aria-label="Crear variación aleatoria" onClick={() => setSeed(`forma-${Math.random().toString(36).slice(2, 8)}`)}><Dice5/></button></div></label>
          <div className="shapesoup-dimensions"><label>Ancho<input type="number" min="64" max="4000" value={width} onChange={(event) => setWidth(Math.max(64, Number(event.target.value) || 64))}/></label><span>×</span><label>Alto<input type="number" min="64" max="4000" value={height} onChange={(event) => setHeight(Math.max(64, Number(event.target.value) || 64))}/></label></div>
          <label className="shapesoup-detail">Detalle <span>{detail}</span><input type="range" min="4" max="24" value={detail} onChange={(event) => setDetail(Number(event.target.value))}/></label>
          <fieldset className="shapesoup-colors"><legend>Colores</legend><div>{colors.map((color, index) => <label key={index} aria-label={`Color ${index + 1}`}><input type="color" value={color} onChange={(event) => setColors((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}/></label>)}</div></fieldset>
        </div>
        <div className="shapesoup-preview-wrap"><div className="shapesoup-preview"><img src={result.dataUri} alt={`Vista previa: ${selected}`}/></div><p>{result.metadata.elements} elementos · SVG vectorial · fondo transparente</p></div>
      </div>
      <footer><span>Se insertará como grupo editable. Puedes desagruparlo para cambiar partes.</span><button type="button" className="button ghost" onClick={onClose}>Cancelar</button><button type="button" className="button primary" onClick={() => void insert()} disabled={inserting}>{inserting ? 'Insertando…' : 'Insertar en lienzo'}</button></footer>
    </section>
  </div>;
}
