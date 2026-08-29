import { readFile, rename, writeFile } from "node:fs/promises";

const htmlPath = process.env.METADATA_HTML_PATH ?? "/usr/share/nginx/html/index.html";
const apiUrl = process.env.METADATA_API_URL ??
  `http://127.0.0.1:${process.env.API_PORT ?? "8080"}/api/settings`;
const defaultSiteName = "PCYBER CONNECT";
const defaultSiteDescription = "Fast, reliable WiFi vouchers";

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
    if (typeof settings[key] === "string" && settings[key].trim()) {
      return settings[key].trim();
    }
  }
  return fallback;
}

function replaceMetaContent(html, pattern, value) {
  return html.replace(pattern, (_match, prefix, suffix) =>
    `${prefix}${escapeHtml(value)}${suffix}`);
}

async function sleep(milliseconds) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadSettings() {
  for (let attempt = 1; attempt <= 60; attempt += 1) {
    try {
      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return await response.json();
      }
    } catch {
      // The API may still be bootstrapping its database. Retry before nginx starts.
    }
    await sleep(1000);
  }
  return null;
}

const settings = await loadSettings();
if (!settings) {
  console.error("Could not load site metadata from the API; keeping fallback HTML metadata.");
  process.exit(0);
}

const siteName = settingValue(
  settings,
  ["site_name", "site_title"],
  defaultSiteName,
);
const description = settingValue(
  settings,
  ["site_tagline", "site_description"],
  defaultSiteDescription,
);

let html = await readFile(htmlPath, "utf8");
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
const temporaryHtmlPath = `${htmlPath}.tmp`;
await writeFile(temporaryHtmlPath, html);
await rename(temporaryHtmlPath, htmlPath);
console.log(`Injected site metadata for "${siteName}".`);