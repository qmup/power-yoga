import type { APIRoute } from 'astro';
import { SITE } from '../data/cms';

export const prerender = true;

export const GET: APIRoute = () => {
  const siteUrl = (process.env.SITE_URL || SITE.url || 'https://power-yoga.vercel.app').replace(/\/+$/, '');
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: ${siteUrl}/sitemap-index.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
