import type { Metadata } from 'next';
import './globals.css';
import './custom.css';
export const metadata: Metadata = { title: 'Fragua', description: 'Editor gráfico abierto, local y sin cuentas.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="es"><body>{children}</body></html>; }
