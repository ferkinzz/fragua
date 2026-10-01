// SPDX-License-Identifier: MPL-2.0
import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const siteUrl = 'https://fragua.rtsi.site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
