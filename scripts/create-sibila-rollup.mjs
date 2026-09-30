import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Rect, Textbox, Circle } from 'fabric/node';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetName = 'sibila-logo-completo.svg';
const assetPath = path.join(root, 'data', 'assets', assetName);
const projectPath = path.join(root, 'data', 'projects', 'sibila-roll-up-80x200.json');
const sourceLogo = '/home/ferkinzz/Documentos/pagina-sibila/sibila-red/public/sibila_logo_completo.svg';
const W = 800;
const H = 2000;
const magenta = '#B9188B';
const orange = '#F4A261';
const beige = '#B69A8E';
const white = '#FFFFFF';

const objects = [];
const text = (value, options) => objects.push(new Textbox(value, {
  originX: 'center', originY: 'center', fontFamily: 'Arial', fill: magenta,
  textAlign: 'center', lineHeight: 1.15, splitByGrapheme: false, ...options,
}).toObject());
const rect = (options) => objects.push(new Rect({ originX: 'center', originY: 'center', ...options }).toObject());

objects.push({
  type: 'Image', version: '7.4.0', originX: 'center', originY: 'center', left: 400, top: 185,
  width: 1500, height: 608, fill: 'rgb(0,0,0)', stroke: null, strokeWidth: 0, strokeDashArray: null,
  strokeLineCap: 'butt', strokeDashOffset: 0, strokeLineJoin: 'miter', strokeUniform: false,
  strokeMiterLimit: 4, scaleX: 0.44, scaleY: 0.44, angle: 0, flipX: false, flipY: false,
  opacity: 1, shadow: null, visible: true, backgroundColor: '', fillRule: 'nonzero',
  paintFirst: 'fill', globalCompositeOperation: 'source-over', skewX: 0, skewY: 0,
  cropX: 0, cropY: 0, src: `/api/assets/${assetName}`, crossOrigin: null, filters: [],
});

text('Quiénes somos', { left: 400, top: 390, width: 650, fontSize: 54, fontWeight: 700 });
text('Sibila es una red multidisciplinaria de profesionales con más de 15 años de experiencia en las áreas de capacitación y formación de Recursos Humanos, así como en la Consultoría Institucional y Organizacional, para optimizar el Recurso Humano, mejorar el clima laboral y elevar los estándares de calidad en los grupos de trabajo.', { left: 400, top: 535, width: 690, fontSize: 28, fill: '#9B6C78' });
text('Servicios', { left: 400, top: 700, width: 650, fontSize: 64, fontWeight: 700 });

rect({ left: 400, top: 785, width: 700, height: 74, rx: 8, ry: 8, fill: orange });
text('Capacitación y formación', { left: 400, top: 785, width: 660, fontSize: 32, fill: white, textAlign: 'left' });
rect({ left: 400, top: 885, width: 700, height: 108, rx: 8, ry: 8, fill: magenta });
text('Consultoría, diagnóstico e intervención\ninstitucional, organizacional y comunitaria', { left: 400, top: 885, width: 660, fontSize: 31, fill: white, textAlign: 'left' });
rect({ left: 400, top: 1000, width: 700, height: 96, rx: 8, ry: 8, fill: orange });
text('Atención clínica\n(consulta psicológica/médica)', { left: 400, top: 1000, width: 660, fontSize: 32, fill: white, textAlign: 'left' });

const services = ['Conferencias', 'Talleres', 'Cursos', 'Entrenamiento\nEspecializado'];
const serviceY = [1125, 1215, 1305, 1420];
services.forEach((label, index) => {
  objects.push(new Circle({ left: 145, top: serviceY[index] - (index === 3 ? 18 : 0), radius: 7, originX: 'center', originY: 'center', fill: magenta }).toObject());
  text(label, { left: 435, top: serviceY[index], width: 540, fontSize: 50, fill: beige, textAlign: 'left' });
});

text('Privada de Chimalistac No. 42,\nInterior A-4, Col. Barrio Oxtopulco Universidad,\nDelegación Coyoacán, C.P. 04318, CDMX.\nTel.: (55) 5659 9918  /  Cel.: 044 55 3717 9074', { left: 400, top: 1635, width: 700, fontSize: 25, fontWeight: 600, fill: '#8D5570' });
text('✉  rededesaludmentalygenero@gmail.com', { left: 400, top: 1768, width: 700, fontSize: 25, fill: '#8D5570' });
text('f   Sibila Red de Salud Mental y Género SC', { left: 400, top: 1825, width: 700, fontSize: 26, fill: beige });
rect({ left: 400, top: 1950, width: 800, height: 100, fill: magenta });

const json = { version: '7.4.0', objects, background: white };
const page = { id: 'page-rollup-sibila', name: 'Roll-up 80 × 200 cm', w: W, h: H, bg: white, json };
const project = {
  id: 'sibila-roll-up-80x200', name: 'Sibila Roll Up 80x200', width: W, height: H,
  background: white, canvas: json, pages: [page], activePageId: page.id,
  updatedAt: new Date().toISOString(), physicalSize: { width: 80, height: 200, unit: 'cm' },
};

await mkdir(path.dirname(assetPath), { recursive: true });
await mkdir(path.dirname(projectPath), { recursive: true });
await copyFile(sourceLogo, assetPath);
await writeFile(projectPath, JSON.stringify(project, null, 2));
console.log(`Creado: ${projectPath}`);
