'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clipboard, Copy, ImagePlus, X } from 'lucide-react';

type ColorValue = { hex: string; rgb: string; hsl: string };
type Props = { onClose: () => void; canApplyFill: boolean; canApplyStroke: boolean; onApplyFill: (color: string) => void; onApplyStroke: (color: string) => void; onAddPalette: (color: string) => void };

function formatColor(r: number, g: number, b: number): ColorValue {
  const hex = `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  const rn = r / 255; const gn = g / 255; const bn = b / 255;
  const max = Math.max(rn, gn, bn); const min = Math.min(rn, gn, bn); const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0; let saturation = 0;
  if (delta) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hex, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${Math.round(hue)}, ${Math.round(saturation * 100)}%, ${Math.round(lightness * 100)}%)` };
}

export default function ColorExtractorModal({ onClose, canApplyFill, canApplyStroke, onApplyFill, onApplyStroke, onAddPalette }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const magnifierRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasImage, setHasImage] = useState(false);
  const [picked, setPicked] = useState<ColorValue | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [hint, setHint] = useState('Pega una imagen, arrástrala aquí o elige un archivo.');
  const [copied, setCopied] = useState('');

  const loadImage = useCallback((blob: Blob) => {
    if (!blob.type.startsWith('image/')) { setHint('Elige un archivo de imagen.'); return; }
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!canvas || !ctx) { URL.revokeObjectURL(url); setHint('No pude abrir la imagen.'); return; }
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0);
      URL.revokeObjectURL(url); setHasImage(true); setPicked(null); setHint(`${image.naturalWidth} × ${image.naturalHeight} px · haz clic en la imagen para tomar un color.`);
    };
    image.onerror = () => { URL.revokeObjectURL(url); setHint('No pude abrir esa imagen.'); };
    image.src = url;
  }, []);

  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items || [])].find((item) => item.type.startsWith('image/'))?.getAsFile();
      if (file) { event.preventDefault(); loadImage(file); }
    };
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('paste', paste); window.addEventListener('keydown', keydown);
    return () => { document.removeEventListener('paste', paste); window.removeEventListener('keydown', keydown); };
  }, [loadImage, onClose]);

  function pickColor(clientX: number, clientY: number) {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !ctx || !hasImage) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) * canvas.width / rect.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) * canvas.height / rect.height)));
    const [r, g, b] = ctx.getImageData(x, y, 1, 1).data; const value = formatColor(r, g, b);
    setPicked(value); setRecent((current) => [value.hex, ...current.filter((color) => color !== value.hex)].slice(0, 12));
  }

  function showMagnifier(clientX: number, clientY: number) {
    const canvas = canvasRef.current; const lens = magnifierRef.current;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true }); const lensCtx = lens?.getContext('2d');
    if (!canvas || !lens || !ctx || !lensCtx || !hasImage) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, Math.floor((clientX - rect.left) * canvas.width / rect.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, Math.floor((clientY - rect.top) * canvas.height / rect.height)));
    const size = 11; const half = Math.floor(size / 2); lensCtx.imageSmoothingEnabled = false; lensCtx.clearRect(0, 0, lens.width, lens.height);
    lensCtx.drawImage(canvas, Math.max(0, x - half), Math.max(0, y - half), size, size, 0, 0, lens.width, lens.height);
    const cell = lens.width / size; lensCtx.strokeStyle = '#fff'; lensCtx.lineWidth = 3; lensCtx.strokeRect(half * cell, half * cell, cell, cell);
    lensCtx.strokeStyle = '#18181b'; lensCtx.lineWidth = 1; lensCtx.strokeRect(half * cell + 1, half * cell + 1, cell - 2, cell - 2);
    lens.style.left = `${Math.max(8, Math.min(clientX + 18, window.innerWidth - 148))}px`;
    lens.style.top = `${Math.max(8, Math.min(clientY + 18, window.innerHeight - 148))}px`;
    lens.style.display = 'block';
  }

  async function copy(label: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(''), 1200); }
    catch { setHint('No se pudo copiar automáticamente; selecciona el valor y cópialo.'); }
  }

  async function pasteFromClipboard() {
    try {
      if (!navigator.clipboard?.read) throw new Error('unsupported');
      const items = await navigator.clipboard.read();
      for (const item of items) { const type = item.types.find((entry) => entry.startsWith('image/')); if (type) { loadImage(await item.getType(type)); return; } }
      setHint('El portapapeles no contiene una imagen. También puedes pegarla con Ctrl+V.');
    } catch { setHint('No pude leer el portapapeles; prueba Ctrl+V o elige un archivo.'); }
  }

  const useRecent = (hex: string) => { const match = /^#([\da-f]{6})$/i.exec(hex); if (match) { const number = Number.parseInt(match[1], 16); setPicked(formatColor(number >> 16, number >> 8 & 255, number & 255)); } };

  return <div className="color-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="color-modal" role="dialog" aria-modal="true" aria-labelledby="color-modal-title">
      <header><div><span>Herramienta de imagen</span><h2 id="color-modal-title">Extractor de color</h2></div><button type="button" aria-label="Cerrar extractor de color" onClick={onClose}><X/></button></header>
      <div className="color-modal-body">
        <p className="color-modal-help">Carga o pega una imagen y haz clic en cualquier píxel para leer su color exacto.</p>
        <div className="color-extractor-actions"><button type="button" onClick={() => void pasteFromClipboard()}><Clipboard/> Pegar imagen</button><button type="button" onClick={() => fileRef.current?.click()}><ImagePlus/> Elegir archivo</button>{hasImage && <button type="button" onClick={() => { setHasImage(false); setPicked(null); setHint('Pega una imagen, arrástrala aquí o elige un archivo.'); }}><X/> Limpiar</button>}<input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) loadImage(file); event.target.value = ''; }}/></div>
        <div className={`color-drop-zone ${hasImage ? 'has-image' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) loadImage(file); }}>
          {!hasImage && <div className="color-drop-hint"><ImagePlus/><strong>{hint}</strong><small>También puedes soltar una imagen aquí o usar Ctrl+V.</small></div>}
          <canvas ref={canvasRef} className={hasImage ? '' : 'hidden'} onMouseMove={(event) => showMagnifier(event.clientX, event.clientY)} onMouseLeave={() => { if (magnifierRef.current) magnifierRef.current.style.display = 'none'; }} onClick={(event) => pickColor(event.clientX, event.clientY)}/>
        </div>
        <canvas ref={magnifierRef} className="color-magnifier" width="132" height="132" aria-hidden="true"/>
        {hasImage && <p className="color-modal-hint">{hint}</p>}
        {picked && <div className="color-result"><button type="button" className="color-result-swatch" style={{ backgroundColor: picked.hex }} title="Copiar HEX" onClick={() => void copy('HEX', picked.hex)}/><div className="color-values">{([['HEX', picked.hex], ['RGB', picked.rgb], ['HSL', picked.hsl]] as const).map(([label, value]) => <div className="color-value" key={label}><span>{label}</span><code>{value}</code><button type="button" aria-label={`Copiar ${label}`} onClick={() => void copy(label, value)}><Copy/>{copied === label ? 'Copiado' : 'Copiar'}</button></div>)}</div></div>}
        {recent.length > 0 && <div className="color-recent"><strong>Colores recientes</strong><div>{recent.map((color) => <button type="button" key={color} aria-label={`Usar ${color}`} title={`${color} · clic para reutilizar`} style={{ background: color }} onClick={() => useRecent(color)}/>)}</div></div>}
        {picked && <footer className="color-modal-footer"><button type="button" className="button ghost" onClick={() => onAddPalette(picked.hex)}>Añadir a paleta rápida</button><span/>{canApplyFill && <button type="button" className="button ghost" onClick={() => onApplyFill(picked.hex)}>Aplicar relleno</button>}{canApplyStroke && <button type="button" className="button primary" onClick={() => onApplyStroke(picked.hex)}>Aplicar trazo</button>}</footer>}
      </div>
    </section>
  </div>;
}
