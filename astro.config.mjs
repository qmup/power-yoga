import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

const SITE_URL = process.env.SITE_URL || 'https://power-yoga.vercel.app';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    service: {
      entrypoint: 'astro/assets/services/sharp',
    },
  },
});
