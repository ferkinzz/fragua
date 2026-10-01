import InfoPage from '@/components/InfoPage';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Wiki',
  description: 'Aprende a crear, editar, guardar y exportar diseños con Fragua.',
  alternates: { canonical: '/wiki/' },
};

export default function WikiPage() {
  return <InfoPage eyebrow="Guía de uso" title="Tu lienzo, a tu manera." description="Una guía breve para crear piezas gráficas, organizar páginas y preparar tus archivos de salida.">
    <section>
      <h2>Empezar un diseño</h2>
      <p>Usa <strong>Agregar</strong> para insertar texto, formas, recursos generativos o imágenes. En <strong>Lienzo</strong> puedes elegir un formato o definir un tamaño personalizado en píxeles.</p>
      <p>Haz clic en un objeto para seleccionarlo y ajustar sus propiedades. Haz doble clic en un texto para editar su contenido; en una imagen, el doble clic activa el recorte.</p>
    </section>
    <section>
      <h2>Moverse y afinar</h2>
      <ul>
        <li>Usa el control de zoom o <kbd>Ctrl</kbd> + rueda sobre el área de trabajo para acercar o alejar el lienzo.</li>
        <li>Para desplazar la vista sin seleccionar objetos, mantén <kbd>Ctrl</kbd> + <kbd>Alt</kbd> y arrastra desde el fondo cuadriculado.</li>
        <li>Activa el imán para alinear objetos con el centro y entre sí; las guías aparecen mientras mueves una capa.</li>
        <li>El panel Capas permite seleccionar, renombrar, ordenar, ocultar y bloquear elementos. Para agrupar, selecciona varios objetos y usa la acción de agrupación.</li>
      </ul>
    </section>
    <section>
      <h2>Páginas y exportación</h2>
      <p>La tira inferior administra las páginas: puedes crear, duplicar, renombrar, reordenar o eliminar. Usa <strong>Guardar</strong> para conservar el proyecto y el menú <strong>Exportar</strong> para descargar PNG, JPEG, SVG, PDF o un ZIP de páginas.</p>
      <p>Las fotografías de Pexels y los iconos de Iconify se incorporan desde <strong>Biblioteca</strong>. Los archivos de terceros pueden tener sus propios términos de uso y requisitos de atribución.</p>
    </section>
    <section className="info-callout">
      <h2>Almacenamiento en esta versión</h2>
      <p>Proyectos, plantillas, kits e imágenes se guardan en IndexedDB en el navegador. Cada perfil y cada origen (por ejemplo, localhost y el dominio publicado) tiene su propio almacenamiento. Usa <strong>Abrir proyecto → Descargar respaldo ZIP</strong> para guardar proyectos JSON junto con sus imágenes y bibliotecas; impórtalo en otro navegador para restaurarlos.</p>
      <p>Este almacenamiento no se sincroniza y el navegador puede eliminarlo. Descarga respaldos periódicamente. La carpeta heredada <code>data/</code> se puede convertir con <code>npm run backup:legacy</code> e importar desde el editor.</p>
    </section>
    <section>
      <h2>Atajos</h2>
      <ul>
        <li><kbd>Ctrl</kbd> + <kbd>Z</kbd> deshacer; <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> rehacer.</li>
        <li><kbd>Ctrl</kbd> + <kbd>D</kbd> duplicar el objeto seleccionado.</li>
        <li><kbd>Ctrl</kbd> + <kbd>S</kbd> guardar el proyecto.</li>
        <li><kbd>Delete</kbd> o <kbd>Backspace</kbd> elimina la selección.</li>
      </ul>
      <p>En macOS, usa <kbd>⌘</kbd> en lugar de <kbd>Ctrl</kbd> para los atajos compatibles.</p>
    </section>
    <section>
      <h2>Proyecto en GitHub</h2>
      <p>Consulta el repositorio de Fragua en <a href="https://github.com/ferkinzz/fragua" target="_blank" rel="noreferrer">GitHub</a>.</p>
    </section>
  </InfoPage>;
}
