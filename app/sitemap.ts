// SPDX-License-Identifier: MPL-2.0
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const siteUrl = 'https://fragua.rtsi.site';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: 'monthly', priority: 1 },
    { url: `${siteUrl}/wiki/`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${siteUrl}/legal/`, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
