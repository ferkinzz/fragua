// SPDX-License-Identifier: MPL-2.0
'use client';

import { useEffect, useRef, useState } from 'react';
import { Eraser, X } from 'lucide-react';

type Props = { source: HTMLCanvasElement; onClose: () => void; onInsert: (image: Blob) => Promise<void> };
type ProgressInfo = { status?: string; progress?: number };
type AlphaMask = { width: number; height: number; data: ArrayLike<number> };
type ModelRunner = (image: HTMLCanvasElement) => Promise<AlphaMask>;

let runnerPromise: Promise<ModelRunner> | null = null;

function getModelRunner(onProgress: (progress: ProgressInfo) => void): Promise<ModelRunner> {
  if (!runnerPromise) {
    runnerPromise = (async () => {
      // Keep Transformers.js and its ONNX WASM out of Next's static asset graph.
      // Pages rejects the 25.6 MiB threaded WASM; native import fetches the runtime
      // from jsDelivr only when the user opens this tool.
      const runtimeUrl = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/+esm';
      const { pipeline } = await import(/* webpackIgnore: true */ runtimeUrl);
      const device = 'gpu' in navigator ? 'webgpu' : 'wasm';
      const loadRunner = async (selectedDevice: 'webgpu' | 'wasm'): Promise<ModelRunner> => {
        const modelId = 'onnx-community/BiRefNet_lite-ONNX';
        const dtype = selectedDevice === 'webgpu' ? 'fp16' : 'fp32';
        const segmenter = await pipeline('image-segmentation', modelId, { device: selectedDevice, dtype, progress_callback: onProgress });
        return async (image: HTMLCanvasElement) => {
          const predictions = await segmenter(image, { mask_threshold: 0.35 });
          const segments = Array.isArray(predictions) ? predictions : [predictions];
          const subject = segments.find((segment: { mask?: AlphaMask }) => segment?.mask)?.mask;
          if (!subject || !subject.width || !subject.height || !subject.data || subject.data.length !== subject.width * subject.height) throw new Error('BiRefNet no devolvió una máscara de sujeto válida.');
          return subject;
        };
      };
      let runner: ModelRunner;
      try { runner = await loadRunner(device); }
      catch (error) {
        if (device !== 'webgpu') throw error;
        return loadRunner('wasm');
      }
      if (device === 'wasm') return runner;
      return async (image: HTMLCanvasElement) => {
        try { return await runner(image); }
        catch {
          try {
            const fallback = await loadRunner('wasm');
            runnerPromise = Promise.resolve(fallback);
            return fallback(image);
          } catch (error) { runnerPromise = null; throw error; }
        }
      };
    })().catch((error) => { runnerPromise = null; throw error; });
  }
  return runnerPromise;
}

function maskToPng(source: HTMLCanvasElement, mask: AlphaMask): Promise<Blob> {
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('No pude leer la imagen original.');
  const sourcePixels = sourceContext.getImageData(0, 0, source.width, source.height);
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mask.width;
  maskCanvas.height = mask.height;
  const maskContext = maskCanvas.getContext('2d');
  if (!maskContext) throw new Error('No pude preparar la máscara del recorte.');
  const maskPixels = maskContext.createImageData(mask.width, mask.height);
  for (let index = 0; index < mask.data.length; index += 1) {
    const pixel = index * 4;
    maskPixels.data[pixel] = 255;
    maskPixels.data[pixel + 1] = 255;
    maskPixels.data[pixel + 2] = 255;
    maskPixels.data[pixel + 3] = mask.data[index];
  }
  maskContext.putImageData(maskPixels, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('El navegador no pudo preparar el resultado.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(maskCanvas, 0, 0, source.width, source.height);
  const scaledMask = context.getImageData(0, 0, source.width, source.height);
  for (let index = 0; index < sourcePixels.data.length; index += 4) sourcePixels.data[index + 3] = scaledMask.data[index + 3];
  context.putImageData(sourcePixels, 0, 0);
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
          if (!cancelled && info.status === 'progress_total') setProgress(Math.round(info.progress ?? 0));
        });
        if (cancelled) return;
        setPhase('processing');
        const alphaMask = await runner(source);
        const blob = await maskToPng(source, alphaMask);
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
        <p id="bg-remove-help" className="trace-modal-help">BiRefNet Lite genera una máscara de recorte con bordes suaves. El modelo se descarga una vez (aprox. 115 MB con GPU; hasta 224 MB sin GPU); la imagen se procesa en tu dispositivo.</p>
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
