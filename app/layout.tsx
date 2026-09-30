import type { Metadata } from 'next';
import './globals.css';
import './custom.css';
export const metadata: Metadata = { title: 'Taller Fabric', description: 'Editor visual local con Fabric.js' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
