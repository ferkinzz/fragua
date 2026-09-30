import type { Metadata } from 'next';
import './globals.css';
import './custom.css';
const siteUrl = 'https://fragua.rtsi.site';
const siteTitle = 'Fragua — Editor gráfico abierto, local y sin cuentas';
const siteDescription = 'Diseña carteles y composiciones con un editor gráfico abierto. Trabaja localmente, sin cuentas y con tus proyectos bajo tu control.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Fragua', template: '%s · Fragua' },
  description: siteDescription,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_MX',
    siteName: 'Fragua',
    title: siteTitle,
    description: siteDescription,
    images: [{ url: '/fragua-og.png', width: 1200, height: 630, alt: 'Fragua: editor gráfico abierto, local y sin cuentas' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [{ url: '/fragua-og.png', width: 1200, height: 630, alt: 'Fragua: editor gráfico abierto, local y sin cuentas' }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
  },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
