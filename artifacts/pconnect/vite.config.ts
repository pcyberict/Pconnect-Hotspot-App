import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    'PORT environment variable is required but was not provided.',
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH;

if (!basePath) {
  throw new Error(
    'BASE_PATH environment variable is required but was not provided.',
  );
}

const defaultSiteName = "PCYBER CONNECT";
const defaultSiteTagline = "Fast, reliable WiFi vouchers";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

async function getSiteMetadata() {
  try {
    const apiPort = process.env.API_PORT ?? "8080";
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/settings`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { siteName: defaultSiteName, tagline: defaultSiteTagline };
    const settings = await response.json() as Record<string, unknown>;
    return {
      siteName: typeof (settings.site_name ?? settings.site_title) === "string" &&
        String(settings.site_name ?? settings.site_title).trim()
        ? String(settings.site_name ?? settings.site_title).trim()
        : defaultSiteName,
      tagline: typeof (settings.site_tagline ?? settings.site_description) === "string" &&
        String(settings.site_tagline ?? settings.site_description).trim()
        ? String(settings.site_tagline ?? settings.site_description).trim()
        : defaultSiteTagline,
    };
  } catch {
    return { siteName: defaultSiteName, tagline: defaultSiteTagline };
  }
}

function siteMetadataPlugin() {
  return {
    name: "pconnect-site-metadata",
    async transformIndexHtml(html: string) {
      const { siteName, tagline } = await getSiteMetadata();
      return html
        .replace(/<title>.*?<\/title>/, `<title>${escapeHtml(siteName)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(" \/>)/,
          (_match, prefix: string, suffix: string) =>
            `${prefix}${escapeHtml(tagline)}${suffix}`)
        .replace(/(<meta name="author" content=")[^"]*(" \/>)/,
          (_match, prefix: string, suffix: string) =>
            `${prefix}${escapeHtml(siteName)}${suffix}`)
        .replace(/(<meta property="og:title" content=")[^"]*(" \/>)/,
          (_match, prefix: string, suffix: string) =>
            `${prefix}${escapeHtml(siteName)}${suffix}`)
        .replace(/(<meta property="og:description" content=")[^"]*(" \/>)/,
          (_match, prefix: string, suffix: string) =>
            `${prefix}${escapeHtml(tagline)}${suffix}`)
        .replace(/(<meta name="twitter:title" content=")[^"]*(" \/>)/,
          (_match, prefix: string, suffix: string) =>
            `${prefix}${escapeHtml(siteName)}${suffix}`)
        .replace(/(<meta name="twitter:description" content=")[^"]*(" \/>)/,
          (_match, prefix: string, suffix: string) =>
            `${prefix}${escapeHtml(tagline)}${suffix}`);
    },
  };
}

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    siteMetadataPlugin(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
