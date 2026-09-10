import { describe, it, expect } from 'vitest';
import { renderAll, checkContent } from './generate.mjs';
import { content, LANGS, PAGES } from './content.mjs';
import { htmlInputs } from '../vite.config';

const now = new Date('2026-09-10T00:00:00Z');

describe('checkContent', () => {
  it('accepts the shipped content', () => {
    expect(checkContent(content)).toEqual([]);
  });
  it('reports a missing key and a leftover placeholder', () => {
    const bad = structuredClone(content) as typeof content;
    delete (bad.de.landing as Record<string, unknown>).cta;
    bad.pl.faq.items[0].a = 'see {measureUrl} and {oops}';
    const problems = checkContent(bad);
    expect(problems.some((p) => p.includes('de') && p.includes('landing.cta'))).toBe(true);
    expect(problems.some((p) => p.includes('pl') && p.includes('{oops}'))).toBe(true);
  });
});

describe('renderAll', () => {
  const files = renderAll({ env: {}, now });
  it('emits every page for every language plus sitemap and llms.txt', () => {
    expect(files.get('index.html')).toBeDefined();
    expect(files.get('faq/index.html')).toBeDefined();
    expect(files.get('how-to-measure/index.html')).toBeDefined();
    for (const l of LANGS.filter((x) => x !== 'en')) {
      expect(files.get(`${l}/index.html`), l).toBeDefined();
      expect(files.get(`${l}/faq/index.html`), l).toBeDefined();
      expect(files.get(`${l}/how-to-measure/index.html`), l).toBeDefined();
    }
    expect(files.get('public/sitemap.xml')).toBeDefined();
    expect(files.get('public/llms.txt')).toBeDefined();
    expect(files.get('public/llms.txt')).toContain('https://understairsplanner.com/how-to-measure/');
    expect(files.size).toBe(LANGS.length * PAGES.length + 2);
  });
  it('llms.txt keeps FAQ link targets as absolute URLs', () => {
    const txt = files.get('public/llms.txt')!;
    expect(txt).toContain('how to measure (https://understairsplanner.com/how-to-measure/)');
    expect(txt).toContain('GitHub (https://github.com/bynov/under-stairs-planner/issues)');
    expect(txt).not.toContain('<a href');
  });
  it('every page has canonical, hreflang set, og:image, one h1, no leftovers', () => {
    for (const [path, html] of files) {
      if (!path.endsWith('.html')) continue;
      expect(html, path).toContain('<link rel="canonical" href="https://understairsplanner.com/');
      for (const l of LANGS) expect(html, `${path} hreflang ${l}`).toContain(`hreflang="${l}"`);
      expect(html, path).toContain('hreflang="x-default"');
      expect(html, path).toContain('og:image" content="https://understairsplanner.com/og.png"');
      expect(html.match(/<h1[\s>]/g)?.length, path).toBe(1);
      expect(html, path).not.toMatch(/\{\{|\{[a-zA-Z]+Url\}/);
    }
  });
  it('de faq canonical and app link carry the language', () => {
    const html = files.get('de/faq/index.html')!;
    expect(html).toContain('href="https://understairsplanner.com/de/faq/"');
    expect(html).toContain('href="/app/?lang=de"');
    expect(html).toContain('<html lang="de">');
    expect(html).toContain('"@type": "FAQPage"');
  });
  it('landing has WebApplication JSON-LD, measure page has HowTo', () => {
    expect(files.get('index.html')).toContain('"@type": "WebApplication"');
    expect(files.get('how-to-measure/index.html')).toContain('"@type": "HowTo"');
  });
  it('sitemap lists every page with alternates and the app', () => {
    const xml = files.get('public/sitemap.xml')!;
    expect(xml).toContain('<loc>https://understairsplanner.com/</loc>');
    expect(xml).toContain('<loc>https://understairsplanner.com/es/how-to-measure/</loc>');
    expect(xml).not.toContain('/app/');
    expect(xml).toContain('hreflang="x-default" href="https://understairsplanner.com/faq/"');
    expect(xml).toContain('<lastmod>2026-09-10</lastmod>');
  });
  it('vite picks up every generated page', () => {
    // generate.mjs must have run (predev/prebuild); when it has, every page has a Vite input
    const inputs = htmlInputs();
    expect(Object.keys(inputs).length).toBe(LANGS.length * PAGES.length + 1);
  });
  it('omits verification and analytics when env is empty, includes them when set', () => {
    const off = renderAll({ env: {}, now }).get('index.html')!;
    expect(off).not.toContain('google-site-verification');
    expect(off).not.toContain('cloudflareinsights');
    const on = renderAll({ env: { SITE_GSC_TOKEN: 'abc', SITE_CF_BEACON: 'tok' }, now }).get('index.html')!;
    expect(on).toContain('<meta name="google-site-verification" content="abc">');
    expect(on).toContain('data-cf-beacon=\'{"token": "tok"}\'');
    const quoted = renderAll({ env: { SITE_CF_BEACON: "a'b" }, now }).get('index.html')!;
    expect(quoted).toContain('data-cf-beacon=\'{"token": "a&#39;b"}\'');
  });
});

describe('translations', () => {
  it('every non-EN language has its own text', () => {
    for (const l of LANGS.filter((x) => x !== 'en')) {
      expect(content[l], l).not.toBe(content.en);
      expect(content[l].landing.h1, l).not.toBe(content.en.landing.h1);
      expect(content[l].faq.items[0].a, l).not.toBe(content.en.faq.items[0].a);
    }
  });
  it('every page description is at most 155 characters', () => {
    for (const l of LANGS) for (const p of PAGES) expect(content[l][p].description.length, `${l}.${p}`).toBeLessThanOrEqual(155);
  });
});
