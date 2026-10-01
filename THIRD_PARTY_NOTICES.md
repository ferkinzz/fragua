# Avisos de terceros

La MPL-2.0 de Fragua cubre únicamente el código propio que lleva el identificador SPDX correspondiente. No reemplaza ni modifica las licencias de las dependencias, fuentes, iconos, fotografías u otros recursos de terceros.

## Dependencias directas de ejecución

Versiones y declaraciones de licencia según `package-lock.json` al preparar este aviso:

| Paquete | Versión | Licencia declarada |
| --- | --- | --- |
| `@shapesoup/core` | 0.2.3 | MIT |
| `fabric` | 7.4.0 | MIT |
| `imagetracerjs` | 1.2.6 | Unlicense |
| `jspdf` | 3.0.3 | MIT |
| `jszip` | 3.10.1 | MIT o GPL-3.0-or-later (licencia dual) |
| `lucide-react` | 0.544.0 | ISC |
| `next` | 15.5.26 | MIT |
| `react` | 19.3.0 | MIT |
| `react-dom` | 19.3.0 | MIT |
| `westures` | 1.1.1 | MIT |

Consulta los archivos de licencia y avisos distribuidos con cada paquete para sus términos completos. JSZip ofrece alternativas de licencia; esta tabla no hace una elección legal en nombre de quien redistribuya el paquete.

La tabla no es un inventario exhaustivo de dependencias transitivas, opcionales o de desarrollo. El árbol fijado está en `package-lock.json`; al redistribuir Fragua o un bundle, revisa también los avisos y licencias de los paquetes incluidos en esa distribución.

## Servicios y recursos incorporados por el usuario

Fragua puede consultar Pexels, Iconify y Google Fonts. Las fotos, iconos y tipografías que se elijan o incorporen conservan sus propios términos, atribuciones y restricciones; no quedan relicenciados bajo MPL-2.0 por usarse en Fragua. Quien publique un diseño debe verificar los derechos de cada recurso concreto.

El script `scripts/create-sibila-rollup.mjs` incluye contenido de un proyecto específico y una ruta a un logotipo externo. No lleva aviso MPL y no se incluye en la concesión de licencia de Fragua mientras no se confirme la autorización para redistribuir ese material.

## Modelo de eliminación de fondo

La función «Quitar fondo» carga [Transformers.js 4.3.0](https://github.com/huggingface/transformers) desde jsDelivr cuando se abre la herramienta y usa [BiRefNet Lite ONNX](https://huggingface.co/onnx-community/BiRefNet_lite-ONNX), publicado bajo MIT. El modelo se descarga desde Hugging Face la primera vez que se usa y queda en la caché del navegador. La inferencia se ejecuta en el dispositivo; las imágenes seleccionadas no se envían a esos servicios.
