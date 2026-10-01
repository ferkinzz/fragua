'use client';

// SPDX-License-Identifier: MPL-2.0
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export default function InfoPage({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedTheme = document.cookie.split('; ').find((cookie) => cookie.startsWith('fragua-theme='))?.split('=')[1];
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
  }, []);

  return <main className="info-page" data-theme={theme}>
    <header className="info-header">
      <Link className="info-brand" href="/" aria-label="Fragua, volver al editor"><span>F</span><strong>Fragua</strong></Link>
      <nav aria-label="Navegación de información">
        <Link href="/wiki">Wiki</Link>
        <Link href="/legal">Créditos</Link>
        <a href="https://rtsi.site" target="_blank" rel="noreferrer">.Site de RTSI <ExternalLink aria-hidden="true"/></a>
      </nav>
    </header>
    <div className="info-content">
      <Link className="info-back" href="/"><ArrowLeft aria-hidden="true"/> Volver al editor</Link>
      <p className="info-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="info-description">{description}</p>
      <div className="info-body">{children}</div>
    </div>
    <footer className="info-footer">
      <span>Fragua · Editor gráfico abierto, local y sin cuentas.</span>
      <span>Un proyecto de <a href="https://rtsi.site" target="_blank" rel="noreferrer">.Site de RTSI</a>, parte de <a href="https://rtsi.mx" target="_blank" rel="noreferrer">RTSI.mx</a></span>
    </footer>
  </main>;
}
