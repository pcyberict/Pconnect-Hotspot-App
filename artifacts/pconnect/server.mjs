import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? "20402");
const apiUrl = process.env.METADATA_API_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? "8080"}/api/settings`;
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "dist/public");
const indexPath = path.join(publicDir, "index.html");
const defaultSiteName = "PCYBER CONNECT";
const defaultDescription = "Fast, reliable WiFi vouchers";

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function settingValue(settings, keys, fallback) {
  for (const key of keys) {
    if (typeof settings?.[key] === "string" && settings[key].trim()) {
      return settings[key].trim();
    }
  }
  return fallback;
}

function replaceMetaContent(html, pattern, value) {
  return html.replace(pattern, (_match, prefix, suffix) =>
    `${prefix}${escapeHtml(value)}${suffix}`);
}

async function getSiteMetadata() {
  try {
    const response = await fetch(apiUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function renderIndex() {
  let html = await readFile(indexPath, "utf8");
  const settings = await getSiteMetadata();
  if (!settings) return html;

  const siteName = settingValue(settings, ["site_name", "site_title"], defaultSiteName);
  const description = settingValue(
    settings,
    ["site_tagline", "site_description"],
    defaultDescription,
  );

  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(siteName)}</title>`);
  html = replaceMetaContent(html, /(<meta name="description" content=")[^"]*(" \/>)/,
    description);
  html = replaceMetaContent(html, /(<meta name="author" content=")[^"]*(" \/>)/,
    siteName);
  html = replaceMetaContent(html, /(<meta property="og:title" content=")[^"]*(" \/>)/,
    siteName);
  html = replaceMetaContent(html, /(<meta property="og:description" content=")[^"]*(" \/>)/,
    description);
  html = replaceMetaContent(html, /(<meta name="twitter:title" content=")[^"]*(" \/>)/,
    siteName);
  html = replaceMetaContent(html, /(<meta name="twitter:description" content=")[^"]*(" \/>)/,
    description);
  return html;
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }[extension] ?? "application/octet-stream";
}

async function serve(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { allow: "GET, HEAD" });
    response.end();
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  if (pathname === "/" || !path.extname(pathname)) {
    const html = await renderIndex();
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else response.end(html);
    return;
  }

  const requestedFile = path.resolve(publicDir, `.${pathname}`);
  if (requestedFile !== publicDir && !requestedFile.startsWith(`${publicDir}${path.sep}`)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(requestedFile);
    response.writeHead(200, { "content-type": contentType(requestedFile) });
    if (request.method === "HEAD") response.end();
    else response.end(file);
  } catch {
    const html = await renderIndex();
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    if (request.method === "HEAD") response.end();
    else response.end(html);
  }
}

createServer((request, response) => {
  void serve(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end("Internal server error");
  });
}).listen(port, "0.0.0.0", () => {
  console.log(`Pconnect web server listening on port ${port}`);
});