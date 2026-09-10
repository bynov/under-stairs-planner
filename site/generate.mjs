// Renders site/template.html × site/content.mjs into repo-root HTML for Vite's MPA build.
// Usage: node site/generate.mjs   (env: SITE_GSC_TOKEN, SITE_CF_BEACON)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { content, LANGS, PAGES, SLUG, SITE, OG_LOCALE, REPO } from './content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const TEMPLATE = readFileSync(join(here, 'template.html'), 'utf8');
const LANG_NAMES = { en: 'English', ru: 'Русский', de: 'Deutsch', pl: 'Polski', es: 'Español' };
const ALLOWED_PLACEHOLDERS = new Set(['measureUrl', 'issuesUrl']);

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const prefix = (lang) => (lang === 'en' ? '/' : `/${lang}/`);
const pageUrl = (lang, page) => `${SITE}${prefix(lang)}${SLUG[page]}`;
const pagePath = (lang, page) => `${lang === 'en' ? '' : lang + '/'}${SLUG[page]}index.html`;

/** Structural check: every lang mirrors en's keys/array lengths, no empty strings, only allowed placeholders. */
export function checkContent(c) {
  const problems = [];
  const walk = (ref, val, lang, path) => {
    if (typeof ref === 'string') {
      if (typeof val !== 'string') return problems.push(`${lang}: ${path} is not a string`);
      if (!val.trim()) return problems.push(`${lang}: ${path} is empty`);
      for (const m of val.matchAll(/\{(\w+)\}/g)) if (!ALLOWED_PLACEHOLDERS.has(m[1])) problems.push(`${lang}: ${path} has unknown placeholder {${m[1]}}`);
      return;
    }
    if (Array.isArray(ref)) {
      if (!Array.isArray(val) || val.length !== ref.length) return problems.push(`${lang}: ${path} must have ${ref.length} items`);
      return ref.forEach((r, i) => walk(r, val[i], lang, `${path}[${i}]`));
    }
    if (typeof val !== 'object' || val === null) return problems.push(`${lang}: ${path} missing`);
    for (const k of Object.keys(ref)) {
      if (!(k in val)) { problems.push(`${lang}: ${path ? path + '.' : ''}${k} missing`); continue; }
      walk(ref[k], val[k], lang, path ? `${path}.${k}` : k);
    }
  };
  for (const lang of LANGS) walk(c.en, c[lang], lang, '');
  return problems;
}

function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
}

/** Substitute the two URL placeholders allowed inside content strings. */
function links(s, lang) {
  return s.replace(/\{measureUrl\}/g, `${prefix(lang)}how-to-measure/`).replace(/\{issuesUrl\}/g, `${REPO}/issues`);
}

function jsonld(obj) {
  // Escape `<` so no translated string can close the <script> block early.
  const json = JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

function landingMain(c, lang) {
  const L = c.landing;
  return `
<section class="hero">
  <h1>${esc(L.h1)}</h1>
  <p class="lead">${esc(L.lead)}</p>
  <p><a class="cta big" href="/app/?lang=${lang}">${esc(L.cta)}</a></p>
</section>
<section class="shots">
${L.screenshots.map((s, i) => `  <img src="${esc(s.src)}" alt="${esc(s.alt)}" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} width="1600" height="1000">`).join('\n')}
</section>
<section>
  <div class="grid">
${L.features.map((f) => `    <div><h3>${esc(f.h)}</h3><p>${links(f.p, lang)}</p></div>`).join('\n')}
  </div>
</section>
<section>
  <div class="grid">
${L.how.map((f) => `    <div><h3>${esc(f.h)}</h3><p>${links(f.p, lang)}</p></div>`).join('\n')}
  </div>
</section>
<section><h2>${esc(L.outputs.h)}</h2><p>${links(L.outputs.p, lang)}</p></section>
<section><h2>${esc(L.privacy.h)}</h2><p>${links(L.privacy.p, lang)}</p></section>
<section><p><a class="cta big" href="/app/?lang=${lang}">${esc(L.cta)}</a></p></section>`;
}

function measureMain(c, lang) {
  const M = c.measure;
  return `
<section class="hero"><h1>${esc(M.h1)}</h1><p class="lead">${esc(M.lead)}</p></section>
<section><ol class="steps">
${M.steps.map((s) => `  <li><h3>${esc(s.h)}</h3><p>${links(s.p, lang)}</p></li>`).join('\n')}
</ol></section>
<section><ul>
${M.tips.map((t) => `  <li>${links(t, lang)}</li>`).join('\n')}
</ul></section>
<section><p><a class="cta big" href="/app/?lang=${lang}">${esc(c.nav.app)}</a></p></section>`;
}

function faqMain(c, lang) {
  const F = c.faq;
  return `
<section class="hero"><h1>${esc(F.h1)}</h1></section>
<section class="faq">
${F.items.map((i) => `  <details><summary>${esc(i.q)}</summary><p>${links(i.a, lang)}</p></details>`).join('\n')}
</section>
<section><p><a class="cta big" href="/app/?lang=${lang}">${esc(c.nav.app)}</a></p></section>`;
}

const stripTags = (s) => s.replace(/<[^>]+>/g, '');
/** For plain-text output: turn `<a href="X">T</a>` into `T (X)`, absolutising site-relative hrefs. */
const inlineLinks = (s) => s.replace(/<a href="([^"]+)"[^>]*>(.*?)<\/a>/g, (_m, href, text) => `${stripTags(text)} (${href.startsWith('/') ? SITE + href : href})`);

function structuredData(c, lang, page) {
  if (page === 'landing') {
    return jsonld({
      '@context': 'https://schema.org', '@type': 'WebApplication',
      name: c.brand, url: `${SITE}/app/`, applicationCategory: 'DesignApplication', operatingSystem: 'Web',
      browserRequirements: 'Requires WebGL', isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      inLanguage: LANGS, description: c.landing.description, license: `${REPO}/blob/main/LICENSE`,
    });
  }
  if (page === 'faq') {
    return jsonld({
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: c.faq.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: stripTags(links(i.a, lang)) } })),
    });
  }
  return jsonld({
    '@context': 'https://schema.org', '@type': 'HowTo', name: c.measure.h1, description: c.measure.description, inLanguage: lang,
    step: c.measure.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.h, text: stripTags(links(s.p, lang)) })),
  });
}

function renderPage(lang, page, env) {
  const c = content[lang];
  const P = c[page];
  const alternates = [...LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${pageUrl(l, page)}">`), `<link rel="alternate" hreflang="x-default" href="${pageUrl('en', page)}">`].join('\n');
  const ogAlternates = LANGS.filter((l) => l !== lang).map((l) => `<meta property="og:locale:alternate" content="${OG_LOCALE[l]}">`).join('\n');
  const langLinks = LANGS.map((l) => `<a href="${pageUrl(l, page).slice(SITE.length)}" hreflang="${l}" lang="${l}"${l === lang ? ' aria-current="page"' : ''}>${LANG_NAMES[l]}</a>`).join('\n');
  const main = page === 'landing' ? landingMain(c, lang) : page === 'measure' ? measureMain(c, lang) : faqMain(c, lang);
  const cur = (p) => (p === page ? ' aria-current="page"' : '');
  return fill(TEMPLATE, {
    lang, site: SITE, repo: REPO, brand: esc(c.brand), title: esc(P.title), description: esc(P.description), url: pageUrl(lang, page),
    alternates, ogLocale: OG_LOCALE[lang], ogAlternates, langLinks, main,
    homeUrl: prefix(lang), measureUrl: `${prefix(lang)}how-to-measure/`, faqUrl: `${prefix(lang)}faq/`, appUrl: `/app/?lang=${lang}`,
    navHome: esc(c.nav.home), navMeasure: esc(c.nav.measure), navFaq: esc(c.nav.faq), navApp: esc(c.nav.app),
    navHomeCurrent: cur('landing'), navMeasureCurrent: cur('measure'), navFaqCurrent: cur('faq'),
    footerSource: esc(c.footer.source), footerIssue: esc(c.footer.issue), footerLicense: esc(c.footer.license), footerLangs: esc(c.footer.langs),
    verification: env.SITE_GSC_TOKEN ? `<meta name="google-site-verification" content="${esc(env.SITE_GSC_TOKEN)}">` : '',
    analytics: env.SITE_CF_BEACON ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${esc(env.SITE_CF_BEACON)}"}'></script>` : '',
    jsonld: structuredData(c, lang, page),
  });
}

function sitemap(now) {
  const date = now.toISOString().slice(0, 10);
  const urls = [];
  for (const page of PAGES) for (const lang of LANGS) {
    const alts = [...LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${pageUrl(l, page)}"/>`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl('en', page)}"/>`].join('\n');
    urls.push(`  <url>\n    <loc>${pageUrl(lang, page)}</loc>\n    <lastmod>${date}</lastmod>\n${alts}\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

function llmsTxt() {
  const c = content.en;
  const lines = [`# ${c.brand}`, '', `> ${c.landing.description}`, '', c.landing.lead, '', '## Pages', ''];
  for (const page of PAGES) lines.push(`- [${c[page].title}](${pageUrl('en', page)}): ${c[page].description}`);
  lines.push(`- [Planner app](${SITE}/app/): the tool itself (English, Russian, German, Polish, Spanish)`);
  lines.push(`- [Source code](${REPO}): MIT licensed`, '', '## FAQ', '');
  for (const i of c.faq.items) lines.push(`### ${i.q}`, '', stripTags(inlineLinks(links(i.a, 'en'))), '');
  return lines.join('\n');
}

/** @returns {Map<string,string>} repo-relative path → file contents */
export function renderAll({ env = process.env, now = new Date() } = {}) {
  const problems = checkContent(content);
  if (problems.length) throw new Error('site/content.mjs problems:\n' + problems.join('\n'));
  const out = new Map();
  for (const lang of LANGS) for (const page of PAGES) out.set(pagePath(lang, page), renderPage(lang, page, env));
  out.set('public/sitemap.xml', sitemap(now));
  out.set('public/llms.txt', llmsTxt());
  return out;
}

export function main() {
  const files = renderAll();
  for (const [rel, text] of files) {
    const abs = join(ROOT, rel);
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
  console.log(`site: wrote ${files.size} files`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
