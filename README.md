# Fragua

**Editor gráfico abierto, local y sin cuentas.**

Editor gráfico de carteles y composiciones, construido con Fabric.js y Next.js. Es local-first: proyectos, plantillas, kits de marca e imágenes se guardan en IndexedDB dentro del navegador. No requiere cuentas ni un servidor con base de datos; también puede compilarse como sitio estático.

La interfaz incluye documentos de varias páginas, texto y formas editables, imágenes, recorte, capas, agrupación, alineación, snapping, kits de marca, plantillas, una biblioteca de fotos e iconos y generación de formas SVG con ShapeSoup. Permite exportar PNG, JPEG, SVG, PDF y ZIP.

<p align="center">
  <img src="docs/screenshots/fragua-editor.png" alt="Captura del editor gráfico Fragua con lienzo central, herramientas laterales y navegación de ayuda" width="1100">
</p>

## Requisitos

- Node.js compatible con Next.js 15 (se recomienda Node.js 20 o posterior).
- npm.
- Una clave de API de Pexels es opcional y solo se necesita para buscar fotografías en esa biblioteca.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Para detenerlo, usa `Ctrl+C` en la terminal donde está corriendo.

Para habilitar las fotos, abre **Biblioteca → Fotos → Configurar clave de Pexels** y pega tu propia clave. Se conserva en el almacenamiento de ese navegador, no se añade a proyectos ni respaldos y no se publica en el repositorio. Al buscar, el navegador envía la clave directamente a Pexels.

Los otros comandos disponibles son `npm run lint`, `npx tsc --noEmit` y `npm run build`. El build está configurado como exportación estática: genera el sitio en `out/`, listo para Cloudflare Pages. Ese artefacto está excluido de Git.

## Guardados y archivos

Los datos de trabajo viven en IndexedDB para el origen que estés usando (por ejemplo, `localhost:3000` o `fragua.rtsi.site`). El navegador separa esos almacenes: para moverlos entre equipos, perfiles o dominios usa **Abrir proyecto → Descargar respaldo ZIP** e **Importar respaldo**. El paquete incluye los proyectos en JSON, assets, plantillas y kits de marca. Descárgalo periódicamente: borrar los datos del sitio o usar un perfil distinto puede hacer que el navegador ya no vea ese almacenamiento.

Los diseños y recursos personales no se guardan en el repositorio ni se suben al sitio publicado. La carpeta `data/` conserva archivos de la versión anterior y se excluye de Git. Para migrarlos una sola vez al navegador:

```bash
npm run backup:legacy
```

El comando crea un ZIP de migración dentro de `data/exports/`; impórtalo en el editor con **Importar respaldo**. No borra ni modifica los archivos originales. Las exportaciones PNG/JPEG/PDF se descargan directamente al dispositivo.

| Carpeta heredada | Contenido |
| --- | --- |
| `data/projects/` | Documentos editables en JSON y versiones anteriores de los proyectos. |
| `data/assets/` | Imágenes importadas y recursos descargados para incorporarlos al lienzo. |
| `data/exports/` | Exportaciones y respaldos heredados de versiones anteriores; el editor actual descarga las exportaciones al dispositivo. |
| `data/templates/` | Plantillas guardadas. |
| `data/brands/` | Kits de marca. |

El botón **Guardar** y `Ctrl+S` escriben en el navegador; los proyectos guardados también tienen guardado periódico. Cambiar el nombre de un proyecto guardado crea una copia nueva. IndexedDB mejora la capacidad frente a `localStorage` y permite almacenar imágenes como archivos, pero sigue sujeto a las cuotas y políticas de cada navegador: el ZIP es el respaldo portable, no Git.

## Recursos de terceros

- **Pexels:** búsqueda opcional de fotografías con una clave que cada persona configura en su navegador.
- **Iconify:** búsqueda e inserción de iconos.
- **Google Fonts:** carga de tipografías web cuando se solicita desde el editor.
- **ShapeSoup:** generación de formas y patrones SVG.

Cada recurso puede tener sus propios términos, atribución o licencia. Revisa los avisos y enlaces de la página [Créditos y avisos](/legal) y las condiciones del proveedor antes de publicar diseños que los incluyan.

## Wiki

La guía de uso está disponible en la ruta `/wiki` al iniciar la aplicación. Incluye los gestos básicos, atajos, organización de páginas, guardado y exportación. La versión publicada está en [fragua.rtsi.site](https://fragua.rtsi.site) y su guía en [fragua.rtsi.site/wiki](https://fragua.rtsi.site/wiki).

## Proyecto y contribuciones

La aplicación muestra una atribución discreta a **.Site de RTSI**, proyecto web de **RTSI.mx**. La estructura y el editor se pueden explorar y ejecutar localmente.

Este repositorio todavía no declara una licencia propia. Las licencias de las dependencias no determinan los permisos sobre el código de Fragua; antes de invitar a reutilizarlo o distribuir forks, el mantenedor debe elegir y añadir una licencia raíz. La página [Créditos y avisos](/legal) resume las dependencias y servicios utilizados.

## Autoría y agradecimientos

<p align="center">
  <a href="https://github.com/ferkinzz">
    <img src="https://raw.githubusercontent.com/ferkinzz/skills/main/assets/fernando.png" alt="Fernando Rojas — ferkinzz" width="150">
  </a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/ferkinzz/skills/main/assets/ferkinzz-signature-dark.png#gh-dark-mode-only" alt="ferkinzz" width="280">
  <img src="https://raw.githubusercontent.com/ferkinzz/skills/main/assets/ferkinzz-signature.png#gh-light-mode-only" alt="ferkinzz" width="280">
</p>

<p align="center">
  <a href="https://github.com/ferkinzz">Fernando Rojas · ferkinzz</a> ·
  <a href="https://rtsi.site">.Site de RTSI</a> ·
  <a href="https://rtsi.mx">RTSI.mx</a>
</p>

El flujo de exploración y planeación también se apoyó en la colección personal de [skills de ferkinzz](https://github.com/ferkinzz/skills), en particular [reuse-finder](https://github.com/ferkinzz/skills/tree/main/skills/engineering/reuse-finder) para localizar antecedentes reutilizables y [platicador-de-proyecto](https://github.com/ferkinzz/skills/tree/main/skills/planeacion/platicador-de-proyecto) para ordenar decisiones del producto. Son herramientas auxiliares del proceso; no forman parte de las dependencias necesarias para ejecutar el editor.

## Tecnología

- Next.js 15, React 19 y TypeScript
- Fabric.js 7
- ShapeSoup, Lucide, jsPDF y JSZip
