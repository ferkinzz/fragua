import { NextResponse } from 'next/server';
export async function GET(request: Request) {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return NextResponse.json({ error: 'PEXELS_API_KEY no configurada' }, { status: 501 });
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const page = searchParams.get('page') || '1';
  if (!query) return NextResponse.json({ photos: [], total_results: 0 });
  const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&page=${page}&per_page=18`, { headers: { Authorization: key }, cache: 'no-store' });
  if (!response.ok) return NextResponse.json({ error: 'Pexels no respondió' }, { status: response.status });
  const data = await response.json();
  return NextResponse.json({ photos: data.photos.map((photo: { id: number; alt: string; photographer: string; src: Record<string, string> }) => ({ id: photo.id, alt: photo.alt, photographer: photo.photographer, thumb: photo.src.medium, full: photo.src.large2x || photo.src.large })), total_results: data.total_results });
}
