// SPDX-License-Identifier: MPL-2.0
'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProgressInfo, RawImage } from '@huggingface/transformers';
import { Eraser, X } from 'lucide-react';

type Props = { source: HTMLCanvasElement; onClose: () => void; onInsert: (image: Blob) => Promise<void> };
type ModelRunner = (image: HTMLCanvasElement) => Promise<RawImage>;

let runnerPromise: Promise<ModelRunner> | null = null;

function getModelRunner(onProgress: (progress: ProgressInfo) => void): Promise<ModelRunner> {
  if (!runnerPromise) {
    runnerPromise = (async () => {
      const { pipeline } = await import('@huggingface/transformers');
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      try {
        const remover = await pipeline('background-removal', 'Xenova/modnet', { device, progress_callback: onProgress });
        return (image: HTMLCanvasElement) => remover(image);
      } catch (error) {
        if (device !== 'webgpu') throw error;
        const remover = await pipeline('background-removal', 'Xenova/modnet', { device: 'wasm', progress_callback: onProgress });
        return (image: HTMLCanvasElement) => remover(image);
      }
    })().catch((error) => { runnerPromise = null; throw error; });
  }
  return runnerPromise;
}

function rawImageToPng(image: RawImage): Promise<Blob> {
  if (image.channels !== 4) throw new Error('El modelo no devolvió una imagen con transparencia.');
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar el resultado.');
  const pixels = context.createImageData(image.width, image.height);
  pixels.data.set(image.data);
  context.putImageData(pixels, 0, 0);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('No pude generar el PNG transparente.')), 'image/png'));
}

function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function BackgroundRemovalModal({ source, onClose, onInsert }: Props) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const [phase, setPhase] = useState<'loading' | 'processing' | 'ready' | 'saving'>('loading');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<Blob | null>(null);
  const [preview, setPreview] = useState('');
  const [sourcePreview, setSourcePreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape' && phase !== 'saving') onClose(); };
    window.addEventListener('keydown', keydown);
    closeButton.current?.focus();
    void (async () => {
      try {
        setSourcePreview(source.toDataURL('image/png'));
        const runner = await getModelRunner((info) => {
          if (!cancelled && info.status === 'progress_total') setProgress(Math.round(info.progress));
        });
        if (cancelled) return;
        setPhase('processing');
        const transparentPng = await runner(source);
        const blob = await rawImageToPng(transparentPng);
        if (cancelled) return;
        setResult(blob);
        setPreview(URL.createObjectURL(blob));
        setPhase('ready');
      } catch (cause) {
        if (!cancelled) { setError(cause instanceof Error ? cause.message : 'No pude quitar el fondo.'); setPhase('ready'); }
      }
    })();
    return () => { cancelled = true; window.removeEventListener('keydown', keydown); };
  }, [source, onClose]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function apply() {
    if (!result || phase === 'saving') return;
    setPhase('saving'); setError('');
    try { await onInsert(result); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pude guardar el recorte en el lienzo.'); setPhase('ready'); }
  }

  const busy = phase === 'loading' || phase === 'processing' || phase === 'saving';
  const status = phase === 'loading' ? `Cargando el modelo${progress ? ` · ${progress}%` : '…'}` : phase === 'processing' ? 'Analizando la imagen en este dispositivo…' : phase === 'saving' ? 'Guardando PNG en este navegador…' : error ? 'No se pudo quitar el fondo' : 'Vista previa lista';

  return <div className="trace-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="trace-modal bg-remove-modal" role="dialog" aria-modal="true" aria-labelledby="bg-remove-title" aria-describedby="bg-remove-help" aria-busy={busy}>
      <header><div><span>Herramienta de imagen</span><h2 id="bg-remove-title">Quitar fondo</h2></div><button ref={closeButton} type="button" aria-label="Cerrar quitafondos" onClick={onClose} disabled={busy}><X/></button></header>
      <div className="trace-modal-body">
        <p id="bg-remove-help" className="trace-modal-help">MODNet detecta personas y crea un PNG transparente. La imagen se procesa en tu dispositivo; el modelo se descarga la primera vez y queda en la caché del navegador.</p>
        <div className="trace-previews">
          <figure><figcaption>Original</figcaption>{sourcePreview ? <img src={sourcePreview} alt="Imagen original"/> : <div className="trace-placeholder">Preparando imagen…</div>}</figure>
          <figure><figcaption>Fondo transparente</figcaption>{preview ? <img src={preview} alt="Resultado con el fondo eliminado"/> : <div className="trace-placeholder" role="status">{busy ? status : error || 'El resultado aparecerá aquí.'}</div>}</figure>
        </div>
        {phase === 'loading' && <progress className="bg-remove-progress" max="100" value={progress || undefined} aria-label="Descargando el modelo de eliminación de fondo"/>}
        {error && <p className="trace-error" role="alert">{error}</p>}
        <p className="trace-stats" aria-live="polite">{status}{result ? ` · PNG ${formatBytes(result.size)}` : ''}</p>
        <footer><button type="button" className="button ghost" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className="button primary" onClick={() => void apply()} disabled={!result || busy}><Eraser/>{phase === 'saving' ? 'Aplicando…' : 'Reemplazar imagen'}</button></footer>
      </div>
    </section>
  </div>;
}
