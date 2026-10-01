import InfoPage from '@/components/InfoPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Créditos y avisos',
  description: 'Licencias de software, créditos y notas de privacidad de Fragua.',
  alternates: { canonical: '/legal/' },
};

const projects = [
  { name: 'Fabric.js', detail: 'Lienzo interactivo y objetos editables · MIT', href: 'https://github.com/fabricjs/fabric.js' },
  { name: 'React', detail: 'Biblioteca de interfaz · MIT', href: 'https://github.com/facebook/react' },
  { name: 'Next.js', detail: 'Framework web · MIT', href: 'https://github.com/vercel/next.js' },
  { name: 'ShapeSoup', detail: 'Generación de formas y patrones SVG · MIT', href: 'https://github.com/benedicti0n/shapesoup' },
  { name: 'Lucide', detail: 'Iconos de interfaz · ISC', href: 'https://github.com/lucide-icons/lucide' },
  { name: 'jsPDF', detail: 'Generación de documentos PDF · MIT', href: 'https://github.com/parallax/jsPDF' },
  { name: 'JSZip', detail: 'Creación de paquetes ZIP · MIT o GPL-3.0-or-later', href: 'https://github.com/Stuk/jszip' },
  { name: 'Westures', detail: 'Gestos multitáctiles · MIT', href: 'https://github.com/mvanderkamp/westures' },
];

export default function LegalPage() {
  return <InfoPage eyebrow="Avisos y agradecimientos" title="Hecho sobre el trabajo de muchas personas." description="Fragua agradece a los proyectos de software libre y servicios que hacen posible este editor. Consulta cada licencia y sus avisos completos en sus repositorios oficiales.">
    <section>
      <h2>Software utilizado</h2>
      <ul className="credit-list">{projects.map((project) => <li key={project.name}><div><a href={project.href} target="_blank" rel="noreferrer">{project.name}</a><span>{project.detail}</span></div></li>)}</ul>
      <p>Las dependencias pueden traer otras licencias transitivas. La lista completa de versiones está en <code>package-lock.json</code>; los avisos de cada proyecto prevalecen sobre este resumen.</p>
    </section>
    <section>
      <h2>Servicios y recursos externos</h2>
      <p>La biblioteca puede consultar <a href="https://www.pexels.com/api/" target="_blank" rel="noreferrer">Pexels</a> para fotografías y <a href="https://iconify.design/" target="_blank" rel="noreferrer">Iconify</a> para iconos. Las tipografías bajo demanda pueden conectarse a <a href="https://fonts.google.com/" target="_blank" rel="noreferrer">Google Fonts</a>. Cada proveedor opera bajo sus propios términos; revisa también la licencia de cada fuente, icono o fotografía incorporada a tus diseños.</p>
    </section>
    <section className="info-callout">
      <h2>Privacidad y despliegues</h2>
      <p>Los proyectos, kits, plantillas e imágenes se conservan en IndexedDB dentro del navegador y no se envían al servidor que aloja Fragua. El almacenamiento es independiente para cada perfil y dominio, no se sincroniza y puede ser eliminado por el navegador. Usa el respaldo ZIP para conservar o transferir tus datos.</p>
      <p>La clave personal de Pexels se guarda en el almacenamiento local del navegador y se envía a Pexels al buscar fotos; no se incluye en los respaldos. Consultas de fotos e iconos y cargas de Google Fonts se conectan directamente con esos proveedores. No introduzcas una clave propia en un equipo o perfil compartido. Esto describe el comportamiento técnico de la aplicación, no constituye una política legal completa.</p>
    </section>
    <section>
      <h2>Marcas</h2>
      <p>Fragua es una herramienta de <a href="https://rtsi.site" target="_blank" rel="noreferrer">.Site de RTSI</a>, proyecto web de <a href="https://rtsi.mx" target="_blank" rel="noreferrer">RTSI.mx</a>. Fabric.js y las demás marcas mencionadas pertenecen a sus respectivos titulares; su mención no implica patrocinio ni afiliación con esos proyectos.</p>
      <p>Este espacio reúne créditos de terceros y notas técnicas; no sustituye las licencias distribuidas con las dependencias ni asesoría legal para quienes publiquen forks.</p>
    </section>
  </InfoPage>;
}
