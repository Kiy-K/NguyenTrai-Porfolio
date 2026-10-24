import type { MetadataRoute } from 'next';
import { getProducts } from '@/lib/data';
import { buildSitemap } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Propagate source failures as 5xx; never publish a success-shaped partial sitemap during an outage.
  return buildSitemap(await getProducts());
}
