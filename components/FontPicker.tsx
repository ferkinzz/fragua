// SPDX-License-Identifier: MPL-2.0
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type Props = { value: string; onChange: (font: string) => void; loadFont: (font: string) => Promise<boolean> };
export const LOCAL_FONTS = ['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Courier New', 'Times New Roman'];
export const GOOGLE_FONTS = ['Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Lato', 'Poppins', 'Nunito', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather', 'Lora', 'DM Sans', 'Manrope', 'Rubik', 'Work Sans', 'Source Sans 3', 'Ubuntu', 'Libre Baskerville', 'Cormorant Garamond', 'Bebas Neue', 'Archivo Black', 'Barlow', 'Outfit', 'Space Grotesk', 'Plus Jakarta Sans', 'Figtree', 'DM Serif Display', 'Josefin Sans', 'Quicksand', 'Karla', 'Cabin', 'Anton', 'Abril Fatface', 'EB Garamond', 'Great Vibes'];
const ALL_FONTS = [...LOCAL_FONTS, ...GOOGLE_FONTS];

export default function FontPicker({ value, onChange, loadFont }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef(new Map<string, HTMLButtonElement>());
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const fonts = useMemo(() => ALL_FONTS.filter((font) => font.toLowerCase().includes(query.trim().toLowerCase())), [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    if (!('IntersectionObserver' in window)) { fonts.slice(0, 8).forEach((font) => { if (GOOGLE_FONTS.includes(font)) void loadFont(font); }); return; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const font = (entry.target as HTMLElement).dataset.font;
      if (font && GOOGLE_FONTS.includes(font)) void loadFont(font);
    }), { root: listRef.current, rootMargin: '60px' });
    fonts.forEach((font) => { const option = optionRefs.current.get(font); if (option) observer.observe(option); });
    return () => observer.disconnect();
  }, [fonts, loadFont, open]);

  useEffect(() => {
    const outside = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside); return () => document.removeEventListener('mousedown', outside);
  }, []);

  function choose(font: string) { onChange(font); setOpen(false); setQuery(''); }
  function keyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(fonts.length - 1, index + 1)); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(0, index - 1)); }
    if (event.key === 'Enter' && open && fonts[activeIndex]) { event.preventDefault(); choose(fonts[activeIndex]); }
  }

  return <div className="font-picker" ref={rootRef}>
    <input role="combobox" aria-label="Buscar tipografía" aria-autocomplete="list" aria-expanded={open} aria-controls="font-picker-options" value={open ? query : value} style={{ fontFamily: value }} placeholder="Buscar tipografía…" onFocus={() => { setOpen(true); setQuery(''); setActiveIndex(0); }} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }} onKeyDown={keyDown}/>
    {open && <div className="font-picker-list" id="font-picker-options" ref={listRef} role="listbox" aria-label="Tipografías disponibles">{fonts.length ? fonts.map((font, index) => <button type="button" role="option" aria-selected={font === value} data-font={font} key={font} ref={(element) => { if (element) optionRefs.current.set(font, element); else optionRefs.current.delete(font); }} className={index === activeIndex ? 'active' : ''} style={{ fontFamily: font }} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(font)}>{font}{GOOGLE_FONTS.includes(font) && <small>Google Fonts</small>}</button>) : <p>No encontré esa tipografía.</p>}</div>}
  </div>;
}
