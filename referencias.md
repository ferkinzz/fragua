# Referencias del editor Fabric.js

Este proyecto es un taller visual completamente local. Los proyectos, imágenes y exportaciones se guardan en carpetas del propio repositorio; no depende de nube, bancos de imágenes ni APIs externas.

## Referencia principal — Xolomak

- Página: `/home/ferkinzz/Documentos/xolomakers_front_2026/xolomak/src/app/admin/carteles/page.tsx`
- Editor: `/home/ferkinzz/Documentos/xolomakers_front_2026/xolomak/src/components/admin/poster/PosterBuilder.tsx`
- UI auxiliar: `/home/ferkinzz/Documentos/xolomakers_front_2026/xolomak/src/components/admin/poster/ui/`
- Layout: `/home/ferkinzz/Documentos/xolomakers_front_2026/xolomak/src/components/admin/AdminLayout.tsx`
- Hooks usados: `@/hooks/use-toast` y `@/hooks/use-mobile`

Es la implementación más avanzada y la fuente principal para decisiones de interacción. Incluye Fabric.js 7.4, recorte nativo, undo/redo, capas, agrupación, alineación, snapping, plantillas, carruseles, exportación ZIP/PPTX, autoguardado y adaptación móvil. Sus integraciones remotas (IA, Pexels, Iconify y nube) no deben trasladarse a este proyecto local.

## Referencia secundaria — Sibila

- Página: `/home/ferkinzz/Documentos/pagina-sibila/sibila-red/src/app/herramientas-colaborador/herramientas/carteles/page.tsx`
- Editor: `/home/ferkinzz/Documentos/pagina-sibila/sibila-red/src/components/shared/PosterBuilder.tsx`
- UI auxiliar: `/home/ferkinzz/Documentos/pagina-sibila/sibila-red/src/components/ui/`
- Hooks usados: `@/hooks/use-toast` y `@/hooks/use-mobile`

Es el antecedente directo del editor de Xolomak. Sirve para comparar la arquitectura original, pero no es la referencia canónica.

## Criterio para este proyecto

- Fabric.js local como motor del lienzo.
- Next.js local para que la interfaz pueda leer y escribir archivos del proyecto.
- Proyectos editables en `data/projects/`.
- Recursos importados en `data/assets/`.
- Imágenes exportadas en `data/exports/`.
- Sin autenticación, servicios de nube ni dependencia funcional de URLs externas.
- Git local, sin remoto configurado.
