# Domain, SEO and Multilingual Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the planner at `understairsplanner.com/app/` under the name "Under Stairs Storage Planner", surrounded by static landing / how-to-measure / FAQ pages in EN, RU, DE, PL, ES with full SEO plumbing, and extend the app UI to the same five languages.

**Architecture:** A dependency-free Node script (`site/generate.mjs`) renders `site/template.html` × `site/content.mjs` into multi-page HTML at repo-root paths that Vite's MPA build picks up 1:1 into `dist/`. The React app moves to `app/index.html`. App i18n grows from 2 to 5 dictionaries with the existing `Record<MessageKey,string>` parity pattern; language is bootstrapped from `?lang=` → localStorage → navigator.

**Tech Stack:** existing (Vite 8, React 18, TS strict, zustand, jsPDF 4, vitest 5, pnpm 11, Node 22). No new runtime or dev dependencies. Local tools for assets: headless Google Chrome, `rsvg-convert`, ImageMagick `magick` (all present on this Mac).

**Spec:** `docs/superpowers/specs/2026-09-10-domain-seo-landing-design.md`

## Global Constraints

- Product name everywhere: **Under Stairs Storage Planner**. Localised brand: RU «Конструктор шкафа под лестницей», DE „Treppenschrank-Planer“, PL „Planer zabudowy pod schodami”, ES «Planificador de armario bajo escalera».
- Domain: `understairsplanner.com`; canonical URLs are `https://understairsplanner.com/…` with trailing slash on directories.
- `Lang = 'en' | 'ru' | 'de' | 'pl' | 'es'`; EN is `x-default`; non-EN pages live under `/<lang>/`.
- App URL is `/app/`; content pages link to `/app/?lang=<lang>`.
- Vite `base` is `'/'`; the `BASE_PATH` env is removed everywhere.
- No new npm dependencies. `site/generate.mjs` runs with bare `node`.
- Generated files are gitignored: `/index.html`, `/faq/`, `/how-to-measure/`, `/ru/`, `/de/`, `/pl/`, `/es/`, `/public/sitemap.xml`, `/public/llms.txt`.
- Env-gated tags: `SITE_GSC_TOKEN` → `<meta name="google-site-verification">`; `SITE_CF_BEACON` → Cloudflare beacon script. Empty env ⇒ tag omitted, build still passes.
- Translations preserve `{placeholders}` verbatim; units: mm (EN/DE/PL/ES) / мм (RU); degrees `°`.
- After every task: `pnpm typecheck && pnpm test && pnpm build` pass. Commit per task with the attribution trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Existing geometry/drawing/PDF numbers must not change.

## File Structure

```
src/i18n/index.ts          Lang union, LANGS, isLang, detectLang, readLangFromUrl   (modify)
src/i18n/de.ts pl.ts es.ts new dictionaries, Record<MessageKey,string>              (create)
src/i18n/en.ts ru.ts       + 'ui.lang.de/pl/es', 'ui.appTitle'; native lang names  (modify)
src/i18n/i18n.test.ts      parity over LANGS, detectLang/readLangFromUrl cases       (modify)
src/store/store.ts         bootstrap lang from URL                                   (modify)
src/ui/TopBar.tsx          <select> language switcher, app title                    (modify)
src/styles.css             .lang-select style                                       (modify)
src/pdf/font.test.ts       cmap glyph coverage per dictionary                        (create)
app/index.html             app entry (moved from /index.html)                       (create)
vite.config.ts             base '/', MPA inputs                                      (modify)
package.json               name, scripts site/prebuild/predev                        (modify)
.gitignore                 generated paths                                           (modify)
.github/workflows/pages.yml  drop BASE_PATH, add SITE_* secrets                      (modify)
public/CNAME robots.txt site.webmanifest favicon.svg favicon.ico apple-touch-icon.png og.png img/*.png   (create)
site/content.mjs           page content × 5 languages                               (create)
site/template.html         page shell with {{slots}}                                (create)
site/site.css              content page styles                                      (create)
site/generate.mjs          renderer + sitemap + llms.txt                            (create)
site/generate.test.ts      vitest for generator                                     (create)
site/og.svg                source for og.png                                        (create)
scripts/screenshots.sh     headless Chrome captures                                 (create)
README.md CLAUDE.md        rename + new commands                                    (modify)
```

---

### Task 1: Five app languages — dictionaries and `Lang` union

**Files:**
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/ru.ts`
- Create: `src/i18n/de.ts`, `src/i18n/pl.ts`, `src/i18n/es.ts`
- Modify: `src/i18n/i18n.test.ts`

**Interfaces:**
- Produces: `type Lang = 'en'|'ru'|'de'|'pl'|'es'`, `LANGS: Lang[]` (in that order), `isLang(v): v is Lang`, `detectLang(navLang?: string): Lang` (prefix match `ru`/`de`/`pl`/`es`, else `en`), new keys `'ui.lang.de'`, `'ui.lang.pl'`, `'ui.lang.es'`, `'ui.appTitle'`.

- [ ] **Step 1: Extend the parity test to iterate all languages and add detectLang cases**

Replace `src/i18n/i18n.test.ts` `dictionaries` and `detectLang` blocks with:

```ts
import { describe, it, expect } from 'vitest';
import { en } from './en';
import { ru } from './ru';
import { de } from './de';
import { pl } from './pl';
import { es } from './es';
import { t, tm, msg, detectLang, isLang, LANGS, type Lang } from './index';

const dicts: Record<Lang, Record<string, string>> = { en, ru, de, pl, es };

describe('dictionaries', () => {
  it('LANGS lists every dictionary in display order', () => {
    expect(LANGS).toEqual(['en', 'ru', 'de', 'pl', 'es']);
  });
  it('have identical key sets, no empty strings and matching placeholders', () => {
    const ek = Object.keys(en).sort();
    for (const lang of LANGS) {
      const d = dicts[lang];
      expect(Object.keys(d).sort(), lang).toEqual(ek);
      for (const k of ek) {
        expect(d[k].length, `${lang}:${k}`).toBeGreaterThan(0);
        const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
        expect(ph(d[k]), `${lang}:${k} placeholders`).toEqual(ph((en as Record<string, string>)[k]));
      }
    }
  });
  it('non-English dictionaries are actually translated', () => {
    expect(ru['part.sideL']).toMatch(/[А-Яа-я]/);
    expect(ru['view.front']).toBe('Фасад');
    expect(de['ui.tab.cutlist']).not.toBe(en['ui.tab.cutlist']);
    expect(pl['ui.tab.cutlist']).not.toBe(en['ui.tab.cutlist']);
    expect(es['ui.tab.cutlist']).not.toBe(en['ui.tab.cutlist']);
  });
  it('language names are native', () => {
    expect(en['ui.lang.en']).toBe('English');
    expect(en['ui.lang.ru']).toBe('Русский');
    expect(en['ui.lang.de']).toBe('Deutsch');
    expect(en['ui.lang.pl']).toBe('Polski');
    expect(en['ui.lang.es']).toBe('Español');
    for (const lang of LANGS) for (const l of LANGS) expect(dicts[lang][`ui.lang.${l}`]).toBe(en[`ui.lang.${l}` as keyof typeof en]);
  });
});
```

Keep the existing `t` tests. Replace the `detectLang`/`isLang` block with:

```ts
describe('detectLang / isLang', () => {
  it('maps locale prefixes to supported languages, everything else to en', () => {
    expect(detectLang('ru')).toBe('ru');
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang('de-AT')).toBe('de');
    expect(detectLang('pl')).toBe('pl');
    expect(detectLang('es-MX')).toBe('es');
    expect(detectLang('en-GB')).toBe('en');
    expect(detectLang('fr')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
  });
  it('isLang accepts only supported codes', () => {
    for (const l of LANGS) expect(isLang(l)).toBe(true);
    expect(isLang('fr')).toBe(false);
    expect(isLang(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test; expect failure**

Run: `pnpm vitest run src/i18n/i18n.test.ts`
Expected: FAIL — cannot resolve `./de`, `./pl`, `./es`.

- [ ] **Step 3: Extend `src/i18n/index.ts`**

```ts
import { en, type MessageKey } from './en';
import { ru } from './ru';
import { de } from './de';
import { pl } from './pl';
import { es } from './es';

export type Lang = 'en' | 'ru' | 'de' | 'pl' | 'es';
export const LANGS: Lang[] = ['en', 'ru', 'de', 'pl', 'es'];
export type { MessageKey };
export type Params = Record<string, string | number>;
export interface Msg { key: MessageKey; params?: Params }

const dicts: Record<Lang, Record<MessageKey, string>> = { en, ru, de, pl, es };

export const msg = (key: MessageKey, params?: Params): Msg => (params ? { key, params } : { key });

export function t(lang: Lang, key: MessageKey, params?: Params): string {
  const s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

export const tm = (lang: Lang, m: Msg): string => t(lang, m.key, m.params);

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as string[]).includes(v);
}

export function detectLang(navLang: string | undefined): Lang {
  const p = navLang?.toLowerCase().slice(0, 2);
  return isLang(p) ? p : 'en';
}
```

- [ ] **Step 4: Add the new keys to `en.ts` and `ru.ts`**

In `en.ts`, replace the two `ui.lang.*` lines with:

```ts
  'ui.lang.en': 'English',
  'ui.lang.ru': 'Русский',
  'ui.lang.de': 'Deutsch',
  'ui.lang.pl': 'Polski',
  'ui.lang.es': 'Español',
  'ui.appTitle': 'Under Stairs Storage Planner',
```

In `ru.ts` the same five `ui.lang.*` lines (identical native names) and `'ui.appTitle': 'Конструктор шкафа под лестницей',`. Change `'pdf.defaultTitle'` to stay as is (it is the default *project* title, not branding).

- [ ] **Step 5: Create `de.ts`, `pl.ts`, `es.ts`**

Each file has the shape:

```ts
import type { MessageKey } from './en';

export const de: Record<MessageKey, string> = {
  // every key of en.ts, translated
};
```

Translate **every** key of `en.ts` (there are 156 + 4 new). Rules:
- Keep `{placeholders}` exactly; keep `°`, `Ø`, `>=`, `>`, `x{n}`, `1:{n}` symbols.
- Units: `mm` in DE/PL/ES.
- `ui.lang.*` values identical to EN (native names).
- `ui.appTitle`: DE `Treppenschrank-Planer`, PL `Planer zabudowy pod schodami`, ES `Planificador de armario bajo escalera`.
- `pdf.defaultTitle`: DE `Treppenschrank`, PL `Zabudowa pod schodami`, ES `Armario bajo escalera`.

Domain glossary (use consistently):

| EN | DE | PL | ES |
|---|---|---|---|
| Envelope (the niche) | Nische | Wnęka | Hueco |
| Cabinet | Schrank | Szafka | Armario |
| Column | Sektion | Sekcja | Módulo |
| Cut list | Zuschnittliste | Lista formatek | Lista de corte |
| Front elevation | Ansicht Front | Widok z przodu | Alzado frontal |
| Plan | Grundriss | Rzut | Planta |
| Side section | Seitenschnitt | Przekrój boczny | Sección lateral |
| Tall side | Hohe Seite | Wysoka strona | Lado alto |
| Top clearance | Abstand zur Treppe | Prześwit górny | Holgura superior |
| Panel thickness | Plattenstärke | Grubość płyty | Grosor del tablero |
| Back (panel) | Rückwand | Plecy | Trasera |
| Plinth | Sockel | Cokół | Zócalo |
| Sloped / Stepped (top) | Schräg / Gestuft | Skośny / Schodkowy | Inclinado / Escalonado |
| Shelf / Shelves | Boden / Böden | Półka / Półki | Estante / Estantes |
| Drawer / Drawer front | Schublade / Schubladenfront | Szuflada / Front szuflady | Cajón / Frente de cajón |
| Door | Tür | Drzwi | Puerta |
| Hanging rod | Kleiderstange | Drążek | Barra de colgar |
| Side L / Side R | Seite L / Seite R | Bok L / Bok P | Lateral I / Lateral D |
| Top / Bottom | Deckel / Boden | Wieniec górny / Wieniec dolny | Techo / Base |
| thin panel (material) | Dünnplatte | płyta cienka | tablero fino |
| tube (rod material) | Rohr | rura | tubo |
| bevel | Gehrung | fazowanie | bisel |
| trapezoid | Trapez | trapez | trapecio |
| internal (drawer) | innenliegend | wewnętrzna | interior |
| Explode (3D) | Auseinanderziehen | Rozsuń | Explosionar |
| Dims (3D toggle) | Maße | Wymiary | Cotas |
| slope | Neigung | nachylenie | pendiente |
| pitch (shelf spacing) | Abstand | rozstaw | paso |
| clear (clear height) | lichte Höhe | prześwit | luz |
| Scale 1:{n} (mm) | Maßstab 1:{n} (mm) | Skala 1:{n} (mm) | Escala 1:{n} (mm) |

- [ ] **Step 6: Run tests and typecheck; expect pass**

Run: `pnpm typecheck && pnpm vitest run src/i18n/i18n.test.ts`
Expected: PASS. If TypeScript reports a missing key in a dictionary, add it.

- [ ] **Step 7: Commit**

```bash
git add src/i18n
git commit -m "feat(i18n): add German, Polish and Spanish dictionaries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Language bootstrap from `?lang=` and `<select>` switcher

**Files:**
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/i18n.test.ts`
- Modify: `src/store/store.ts:96-101`
- Modify: `src/ui/TopBar.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `isLang`, `LANGS`, `detectLang` from Task 1.
- Produces: `readLangFromUrl(search: string): Lang | null` in `src/i18n/index.ts`.

- [ ] **Step 1: Write the failing test**

Append to `src/i18n/i18n.test.ts`:

```ts
import { readLangFromUrl } from './index';

describe('readLangFromUrl', () => {
  it('returns a supported lang from ?lang=', () => {
    expect(readLangFromUrl('?lang=de')).toBe('de');
    expect(readLangFromUrl('?foo=1&lang=pl')).toBe('pl');
  });
  it('returns null for missing or unsupported values', () => {
    expect(readLangFromUrl('')).toBeNull();
    expect(readLangFromUrl('?lang=fr')).toBeNull();
    expect(readLangFromUrl('?lang=')).toBeNull();
  });
});
```

(Merge the import into the existing `./index` import line.)

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run src/i18n/i18n.test.ts -t readLangFromUrl`
Expected: FAIL — `readLangFromUrl` is not exported.

- [ ] **Step 3: Implement `readLangFromUrl`**

Append to `src/i18n/index.ts`:

```ts
/** `?lang=xx` from a location.search string, or null when absent/unsupported. */
export function readLangFromUrl(search: string): Lang | null {
  const v = new URLSearchParams(search).get('lang');
  return isLang(v) ? v : null;
}
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run src/i18n/i18n.test.ts`
Expected: PASS.

- [ ] **Step 5: Bootstrap the store from the URL**

In `src/store/store.ts`, replace the bottom block (from `const browserStorage` to the end) with:

```ts
const browserStorage: StorageLike | null = typeof localStorage !== 'undefined' ? localStorage : null;

function initialLanguage(): Lang {
  const fromUrl = typeof location !== 'undefined' ? readLangFromUrl(location.search) : null;
  if (fromUrl) {
    if (browserStorage) saveLang(browserStorage, fromUrl);
    if (typeof history !== 'undefined') {
      const url = new URL(location.href);
      url.searchParams.delete('lang');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    return fromUrl;
  }
  return (browserStorage && loadLang(browserStorage)) ?? detectLang(typeof navigator !== 'undefined' ? navigator.language : undefined);
}

export const useStore = createPlannerStore((browserStorage && loadFromStorage(browserStorage)) ?? defaultProject(), initialLanguage());
if (browserStorage) startAutosave(useStore, browserStorage);
```

Update the import line: `import { detectLang, msg, readLangFromUrl, type Lang, type Msg } from '../i18n';`.

- [ ] **Step 6: Replace the language buttons with a `<select>` and show the app title**

In `src/ui/TopBar.tsx` replace the `<nav className="tabs lang">…</nav>` block with:

```tsx
      <select className="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label="Language">
        {LANGS.map((l) => (
          <option key={l} value={l}>{t(`ui.lang.${l}` as MessageKey)}</option>
        ))}
      </select>
```

Change the i18n import to `import { LANGS, type Lang, type MessageKey } from '../i18n';`. Add a brand link as the first child of `<header>`:

```tsx
      <a className="brand" href="/" title={t('ui.appTitle')}>⌂</a>
```

In `src/styles.css` replace the two `.tabs.lang` rules with:

```css
.lang-select { font: inherit; font-size: 12px; padding: 4px 6px; border: 1px solid #bbb; border-radius: 3px; background: #fff; }
.brand { text-decoration: none; color: #2b6cb0; font-size: 18px; line-height: 1; padding: 0 2px; }
```

- [ ] **Step 7: Verify**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all pass. Then `pnpm dev`, open `http://localhost:5173/?lang=es`; the UI must be Spanish and the URL must lose `?lang=es`; reload keeps Spanish.

- [ ] **Step 8: Commit**

```bash
git add src/i18n src/store/store.ts src/ui/TopBar.tsx src/styles.css
git commit -m "feat(i18n): pick language from ?lang=, select-based switcher

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: PDF font glyph coverage test

**Files:**
- Create: `src/pdf/font.test.ts`

**Interfaces:**
- Consumes: `src/pdf/fonts/PT_Sans-Web-Regular.ttf` (binary, committed) and the five dictionaries.

- [ ] **Step 1: Write the test with a minimal cmap reader**

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { en } from '../i18n/en';
import { ru } from '../i18n/ru';
import { de } from '../i18n/de';
import { pl } from '../i18n/pl';
import { es } from '../i18n/es';

/** Code points mapped by the font's cmap (format 4 and 12 subtables). */
function cmapCodepoints(ttf: Buffer): Set<number> {
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const numTables = dv.getUint16(4);
  let cmapOff = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(ttf[rec], ttf[rec + 1], ttf[rec + 2], ttf[rec + 3]);
    if (tag === 'cmap') cmapOff = dv.getUint32(rec + 8);
  }
  if (cmapOff < 0) throw new Error('no cmap table');
  const out = new Set<number>();
  const n = dv.getUint16(cmapOff + 2);
  for (let i = 0; i < n; i++) {
    const sub = cmapOff + dv.getUint32(cmapOff + 4 + i * 8 + 4);
    const format = dv.getUint16(sub);
    if (format === 4) {
      const segX2 = dv.getUint16(sub + 6);
      const ends = sub + 14, starts = ends + segX2 + 2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = dv.getUint16(ends + s * 2), start = dv.getUint16(starts + s * 2);
        if (start === 0xffff) continue;
        for (let c = start; c <= end; c++) out.add(c);
      }
    } else if (format === 12) {
      const groups = dv.getUint32(sub + 12);
      for (let g = 0; g < groups; g++) {
        const p = sub + 16 + g * 12;
        const start = dv.getUint32(p), end = dv.getUint32(p + 4);
        for (let c = start; c <= end; c++) out.add(c);
      }
    }
  }
  return out;
}

describe('PDF font covers every dictionary', () => {
  const ttf = readFileSync(fileURLToPath(new URL('./fonts/PT_Sans-Web-Regular.ttf', import.meta.url)));
  const cps = cmapCodepoints(ttf);
  it('has a populated cmap', () => {
    expect(cps.has('A'.codePointAt(0)!)).toBe(true);
    expect(cps.has('Я'.codePointAt(0)!)).toBe(true);
  });
  for (const [name, dict] of Object.entries({ en, ru, de, pl, es })) {
    it(`${name}: no missing glyphs`, () => {
      const missing = new Set<string>();
      for (const s of Object.values(dict)) {
        for (const ch of s) {
          const cp = ch.codePointAt(0)!;
          if (cp >= 0x20 && !cps.has(cp)) missing.add(ch);
        }
      }
      expect([...missing], `characters missing from PT Sans in ${name}`).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run**

Run: `pnpm vitest run src/pdf/font.test.ts`
Expected: PASS for all five. If a language fails, the assertion message lists the missing characters: replace them in that dictionary with covered equivalents (e.g. straight quotes) — do not swap the font.

- [ ] **Step 3: Commit**

```bash
git add src/pdf/font.test.ts src/i18n
git commit -m "test(pdf): assert PT Sans covers every dictionary

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Move the app to `/app/`, base `/`, CNAME, CI, rename

**Files:**
- Create: `app/index.html`
- Delete: `index.html` (root)
- Modify: `vite.config.ts`, `package.json`, `.gitignore`, `.github/workflows/pages.yml`
- Create: `public/CNAME`
- Modify: `README.md`, `CLAUDE.md`

**Interfaces:**
- Produces: Vite MPA config that reads inputs from a `htmlInputs()` helper (Task 5 relies on the glob list).

- [ ] **Step 1: Move the app entry**

```bash
git mv index.html app/index.html
```

Edit `app/index.html` to:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta name="theme-color" content="#2b6cb0" />
    <title>Under Stairs Storage Planner</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

(`noindex` on the app: the landing pages are the indexable surface; the app has no crawlable text.)

- [ ] **Step 2: Vite config**

Replace `vite.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { globSync } from 'node:fs';
import { resolve } from 'node:path';

/** Every HTML entry: the app plus whatever site/generate.mjs produced. */
export function htmlInputs(root = __dirname): Record<string, string> {
  const files = ['app/index.html', ...globSync(['index.html', 'faq/index.html', 'how-to-measure/index.html', '{ru,de,pl,es}/**/index.html'], { cwd: root })];
  return Object.fromEntries(files.map((f) => [f.replace(/\/?index\.html$/, '') || 'root', resolve(root, f)]));
}

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: { rollupOptions: { input: htmlInputs() } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'site/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

`node:fs` `globSync` exists in Node 22 (CI) and 23 (local).

- [ ] **Step 3: package.json, gitignore, CNAME**

`package.json`: `"name": "understairs-storage-planner"`. Scripts stay for now (Task 5 adds `site`/`prebuild`/`predev`).

`.gitignore`:

```
node_modules
dist
# generated by site/generate.mjs
/index.html
/faq/
/how-to-measure/
/ru/
/de/
/pl/
/es/
/public/sitemap.xml
/public/llms.txt
```

`public/CNAME` (no newline needed):

```
understairsplanner.com
```

- [ ] **Step 4: Workflow**

In `.github/workflows/pages.yml` replace the build step:

```yaml
      - run: pnpm build
        env:
          SITE_GSC_TOKEN: ${{ secrets.SITE_GSC_TOKEN }}
          SITE_CF_BEACON: ${{ secrets.SITE_CF_BEACON }}
```

- [ ] **Step 5: Rename in docs**

`README.md`: title `# Under Stairs Storage Planner`, first line `**Live: https://understairsplanner.com/** (app at `/app/`)`, add after the intro: `Formerly "Under-stairs Closet Planner"; the GitHub repo keeps its old name.` Replace "English and Russian UI" with "UI, drawings and PDF in English, Russian, German, Polish and Spanish." In the Develop block add `pnpm site       # regenerate landing pages (runs automatically before dev/build)` and the `site/` tree line: `site/          static landing / guide / FAQ pages, 5 languages, generated at build`. In Deploy: `Custom domain via public/CNAME; Pages source: GitHub Actions.`

`CLAUDE.md`: in Commands add `pnpm site` line; in Architecture add a short section:

```
## Static site

`site/generate.mjs` renders `site/template.html` × `site/content.mjs` into repo-root HTML (`index.html`, `faq/`, `how-to-measure/`, `<lang>/…`) that Vite's MPA build copies 1:1 to `dist/`. Those paths are gitignored; edit `site/content.mjs`, never the output. The app lives at `app/index.html` → `/app/`. Env `SITE_GSC_TOKEN` / `SITE_CF_BEACON` gate the Search Console meta and Cloudflare beacon.
```

and change "Tests run in a `node` environment" sentence to also mention `site/**/*.test.ts`.

- [ ] **Step 6: Verify**

Run: `pnpm typecheck && pnpm test && pnpm build && ls dist/app/index.html dist/CNAME`
Expected: pass; both files exist. `pnpm dev` then `http://localhost:5173/app/` shows the app.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: move app to /app, base /, custom domain, rename to Under Stairs Storage Planner

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Site generator with English content

**Files:**
- Create: `site/content.mjs`, `site/template.html`, `site/site.css`, `site/generate.mjs`, `site/generate.test.ts`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `site/generate.mjs` exports `renderAll({ env, now }) → Map<string,string>` (path → file text, paths relative to repo root, e.g. `index.html`, `de/faq/index.html`, `public/sitemap.xml`, `public/llms.txt`) and `checkContent(content) → string[]` (list of problems, empty when ok); `main()` writes the map to disk when run as a script. `site/content.mjs` exports `LANGS`, `PAGES = ['landing','measure','faq']`, `SITE = 'https://understairsplanner.com'`, `content`.

- [ ] **Step 1: Write `site/content.mjs` with EN content and RU/DE/PL/ES as copies of EN (translated in Task 7)**

```js
export const SITE = 'https://understairsplanner.com';
export const LANGS = ['en', 'ru', 'de', 'pl', 'es'];
export const PAGES = ['landing', 'measure', 'faq'];
export const SLUG = { landing: '', measure: 'how-to-measure/', faq: 'faq/' };
export const OG_LOCALE = { en: 'en_US', ru: 'ru_RU', de: 'de_DE', pl: 'pl_PL', es: 'es_ES' };
export const REPO = 'https://github.com/bynov/under-stairs-planner';

const en = {
  brand: 'Under Stairs Storage Planner',
  nav: { home: 'Home', measure: 'How to measure', faq: 'FAQ', app: 'Open the planner' },
  landing: {
    title: 'Under Stairs Storage Planner – free 3D design tool with cut list',
    description: 'Design a fitted under stairs storage cabinet in your browser: 3D model, dimensioned drawings, PDF plan and cut list. Free, no sign-up, works on your phone.',
    h1: 'Plan your under stairs storage in minutes',
    lead: 'Type in the size of the space under your staircase, choose drawers, shelves, doors and a hanging rod for each section, and get a 3D model, dimensioned drawings and a printable plan with a cut list you can hand to a joiner or build yourself.',
    cta: 'Open the planner',
    features: [
      { h: 'Fits the slope', p: 'Every section follows the stair underside. Sloped or stepped top, bevel angles and trapezoid panels are worked out for you.' },
      { h: 'Drawers, shelves, doors, rod', p: 'Mix per section: a wardrobe with a hanging rod, open shelves, a bank of drawers, or drawers hidden behind a door.' },
      { h: '3D you can orbit', p: 'Spin the model, toggle dimensions, pull the drawers out with the explode slider to check clearances.' },
      { h: 'Dimensioned drawings', p: 'Front elevation, plan and side section with dimensions, plus a detail sheet for every section.' },
      { h: 'PDF with cut list', p: 'A multi-page A4 plan at standard scales with every panel sized, grouped and annotated. Ready for a workshop.' },
      { h: 'Nothing leaves your browser', p: 'No account, no upload. Your project autosaves locally and exports as a JSON file.' },
    ],
    how: [
      { h: '1. Measure', p: 'Length along the wall, height at the tall end, height at the low end and depth. Our guide shows where to put the tape.' },
      { h: '2. Design', p: 'Add sections, set widths, pick what goes inside. Live checks tell you when something will not fit.' },
      { h: '3. Export', p: 'Download the PDF plan and cut list, or save the project as JSON to continue later.' },
    ],
    screenshots: [
      { src: '/img/3d.png', alt: 'Under stairs cabinet in the 3D view with drawers, shelves and a wardrobe section' },
      { src: '/img/front.png', alt: 'Dimensioned front elevation drawing of an under stairs cabinet' },
    ],
    outputs: { h: 'What you get', p: 'An interactive 3D model, front / plan / side drawings, one detail drawing per section, and a PDF that bundles all of it with a cut list: part name, quantity, length, width, thickness, material and notes such as bevel angles.' },
    privacy: { h: 'Free and private', p: 'The planner is open source (MIT) and runs entirely in your browser. There is no server, no tracking of your design, and nothing to install.' },
  },
  measure: {
    title: 'How to measure the space under your stairs',
    description: 'The four measurements you need to plan under stairs storage: length, tall-end height, low-end height and depth, plus clearance and obstacles.',
    h1: 'How to measure under your stairs',
    lead: 'You need four numbers. Measure in millimetres if you can; the planner works in mm.',
    steps: [
      { h: 'Length', p: 'Along the wall at floor level, from the tall end of the triangle to where the ceiling meets the floor (or to the knee wall). This is the total width your cabinet can occupy.' },
      { h: 'Height at the tall end', p: 'Floor to the underside of the stairs (or the plasterboard) at the tall end. If there is a vertical wall at the tall end, measure right against it.' },
      { h: 'Height at the low end', p: 'The same at the far end. If the slope runs all the way to the floor, enter 0. If there is a knee wall, enter its height.' },
      { h: 'Depth', p: 'From the front opening to the back wall. Cabinet depth is set separately; 600 mm is a common choice for drawers and hanging.' },
      { h: 'Clearance', p: 'Leave 15–30 mm between the cabinet top and the stair underside so the cabinet can be tilted into place. The planner defaults to 20 mm.' },
      { h: 'Obstacles', p: 'Note fuse boxes, radiators, pipes, sockets and light switches. Keep them outside a section or plan a removable panel.' },
    ],
    tips: [
      'Measure the slope in two places (tall end and low end) rather than trusting a single angle: plastered stair soffits are rarely straight.',
      'Check the floor is level along the length. Out-of-level floors are absorbed by the plinth.',
      'Photograph the space with a tape in frame; it helps when you come back to the plan later.',
    ],
  },
  faq: {
    title: 'FAQ – Under Stairs Storage Planner',
    description: 'Answers about the free under stairs storage planner: what it does, which staircases work, materials, minimum drawer height, what the PDF contains.',
    h1: 'Frequently asked questions',
    items: [
      { q: 'What does the planner do?', a: 'It turns four measurements of the space under your stairs into a fitted cabinet design: a 3D model, dimensioned drawings, and a PDF plan with a cut list.' },
      { q: 'Is it free?', a: 'Yes. It is open source under the MIT licence and there is no paid tier.' },
      { q: 'Does it upload my design anywhere?', a: 'No. Everything runs in your browser. The project autosaves to your browser\'s local storage and you can export it as a JSON file.' },
      { q: 'Which staircases does it support?', a: 'Straight flights with a triangular space below, opened from the long sloped side. Winders, landings and end-access cupboards are not modelled yet.' },
      { q: 'What do I need to measure?', a: 'Length, height at the tall end, height at the low end and depth. See <a href="{measureUrl}">how to measure</a>.' },
      { q: 'What panel thickness and material should I use?', a: 'The default is 18 mm panel with a 4 mm back, which suits melamine-faced chipboard, MDF or plywood. Both thicknesses are editable.' },
      { q: 'Why does it say a drawer is too short?', a: 'Drawer fronts under a slope get shorter towards the low end. The planner enforces a minimum front height so the drawer box still fits; use fewer drawers or a wider section.' },
      { q: 'Sloped or stepped top?', a: 'Sloped follows the stair underside with one bevelled top panel per section. Stepped gives each section a flat top at its low-end height, which is easier to build but wastes some space.' },
      { q: 'What is in the PDF?', a: 'A summary page with a 3D snapshot, front / plan / side drawings at standard scales, one detail page per section, and a paginated cut list.' },
      { q: 'Can a joiner build from the cut list?', a: 'Yes. Each row lists quantity, length, width, thickness and material, with notes for bevel angles and trapezoid panels. Hardware (hinges, runners) is not listed yet.' },
      { q: 'Does it work in inches?', a: 'Not yet. Enter millimetres for now; imperial units are on the roadmap.' },
      { q: 'Does it work on a phone?', a: 'Yes. On small screens the editor opens as a panel over the 3D view.' },
      { q: 'How do I report a bug or ask for a feature?', a: 'Open an issue on <a href="{issuesUrl}">GitHub</a>.' },
    ],
  },
  footer: { source: 'Source on GitHub', issue: 'Report an issue', license: 'MIT licence', langs: 'Language' },
};

export const content = { en, ru: en, de: en, pl: en, es: en };
```

`{measureUrl}` and `{issuesUrl}` are the only placeholders the generator substitutes inside content (per page language). `content.ru/de/pl/es` aliasing `en` is temporary; Task 7 replaces them.

- [ ] **Step 2: Write `site/template.html`**

```html
<!doctype html>
<html lang="{{lang}}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{title}}</title>
<meta name="description" content="{{description}}">
<link rel="canonical" href="{{url}}">
{{alternates}}
<meta property="og:type" content="website">
<meta property="og:site_name" content="{{brand}}">
<meta property="og:title" content="{{title}}">
<meta property="og:description" content="{{description}}">
<meta property="og:url" content="{{url}}">
<meta property="og:image" content="{{site}}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{{ogLocale}}">
{{ogAlternates}}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{{title}}">
<meta name="twitter:description" content="{{description}}">
<meta name="twitter:image" content="{{site}}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#2b6cb0">
{{verification}}
<link rel="stylesheet" href="/site/site.css">
{{jsonld}}
{{analytics}}
</head>
<body>
<header class="top">
  <a class="brand" href="{{homeUrl}}">{{brand}}</a>
  <nav aria-label="Main">
    <a href="{{homeUrl}}"{{navHomeCurrent}}>{{navHome}}</a>
    <a href="{{measureUrl}}"{{navMeasureCurrent}}>{{navMeasure}}</a>
    <a href="{{faqUrl}}"{{navFaqCurrent}}>{{navFaq}}</a>
  </nav>
  <a class="cta" href="{{appUrl}}">{{navApp}}</a>
</header>
<main>
{{main}}
</main>
<footer>
  <nav class="langs" aria-label="{{footerLangs}}">{{langLinks}}</nav>
  <p><a href="{{repo}}">{{footerSource}}</a> · <a href="{{repo}}/issues">{{footerIssue}}</a> · <a href="{{repo}}/blob/main/LICENSE">{{footerLicense}}</a></p>
</footer>
</body>
</html>
```

- [ ] **Step 3: Write `site/site.css`**

```css
:root { font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; font-size: 16px; line-height: 1.5; color: #1f2937; background: #fff; }
body { margin: 0; }
a { color: #2b6cb0; }
header.top, main, footer { max-width: 960px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
header.top { display: flex; align-items: center; gap: 20px; padding-block: 14px; flex-wrap: wrap; }
header.top .brand { font-weight: 700; text-decoration: none; color: #111; }
header.top nav { display: flex; gap: 14px; flex: 1; }
header.top nav a { text-decoration: none; color: #374151; }
header.top nav a[aria-current] { color: #2b6cb0; font-weight: 600; }
.cta { display: inline-block; background: #2b6cb0; color: #fff !important; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; }
.cta.big { font-size: 1.15rem; padding: 14px 26px; }
.hero { padding-block: 40px 24px; }
.hero h1 { font-size: 2.2rem; line-height: 1.15; margin: 0 0 12px; }
.hero .lead { font-size: 1.15rem; max-width: 720px; color: #374151; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; margin-block: 24px; }
.grid h3 { margin: 0 0 6px; font-size: 1.05rem; }
.grid p { margin: 0; color: #4b5563; }
.shots { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-block: 24px; }
.shots img { width: 100%; height: auto; border: 1px solid #e5e7eb; border-radius: 6px; }
section { margin-block: 36px; }
h2 { font-size: 1.5rem; margin: 0 0 12px; }
ol.steps { padding-left: 22px; } ol.steps li { margin-bottom: 12px; } ol.steps h3 { margin: 0 0 4px; font-size: 1.05rem; }
.faq details { border-top: 1px solid #e5e7eb; padding: 10px 0; }
.faq summary { cursor: pointer; font-weight: 600; }
.faq details p { margin: 8px 0 0; color: #374151; }
footer { padding-block: 32px; border-top: 1px solid #e5e7eb; margin-top: 48px; color: #6b7280; font-size: 0.95rem; }
footer .langs { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
footer .langs a[aria-current] { font-weight: 600; color: #111; text-decoration: none; }
@media (max-width: 600px) { .hero h1 { font-size: 1.7rem; } header.top nav { order: 3; width: 100%; } }
```

- [ ] **Step 4: Write the failing generator test**

`site/generate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderAll, checkContent } from './generate.mjs';
import { content, LANGS, PAGES } from './content.mjs';

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
    expect(files.size).toBe(LANGS.length * PAGES.length + 2);
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
    expect(xml).toContain('<loc>https://understairsplanner.com/app/</loc>');
    expect(xml).toContain('hreflang="x-default" href="https://understairsplanner.com/faq/"');
    expect(xml).toContain('<lastmod>2026-09-10</lastmod>');
  });
  it('omits verification and analytics when env is empty, includes them when set', () => {
    const off = renderAll({ env: {}, now }).get('index.html')!;
    expect(off).not.toContain('google-site-verification');
    expect(off).not.toContain('cloudflareinsights');
    const on = renderAll({ env: { SITE_GSC_TOKEN: 'abc', SITE_CF_BEACON: 'tok' }, now }).get('index.html')!;
    expect(on).toContain('<meta name="google-site-verification" content="abc">');
    expect(on).toContain('data-cf-beacon=\'{"token": "tok"}\'');
  });
});
```

- [ ] **Step 5: Run; expect failure**

Run: `pnpm vitest run site/generate.test.ts`
Expected: FAIL — `./generate.mjs` not found.

- [ ] **Step 6: Write `site/generate.mjs`**

```js
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

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
  return `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n</script>`;
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
${L.screenshots.map((s) => `  <img src="${esc(s.src)}" alt="${esc(s.alt)}" loading="lazy" width="1600" height="1000">`).join('\n')}
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
  urls.push(`  <url>\n    <loc>${SITE}/app/</loc>\n    <lastmod>${date}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

function llmsTxt() {
  const c = content.en;
  const lines = [`# ${c.brand}`, '', `> ${c.landing.description}`, '', c.landing.lead, '', '## Pages', ''];
  for (const page of PAGES) lines.push(`- [${c[page].title}](${pageUrl('en', page)}): ${c[page].description}`);
  lines.push(`- [Planner app](${SITE}/app/): the tool itself (English, Russian, German, Polish, Spanish)`);
  lines.push(`- [Source code](${REPO}): MIT licensed`, '', '## FAQ', '');
  for (const i of c.faq.items) lines.push(`### ${i.q}`, '', stripTags(links(i.a, 'en')), '');
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
```

- [ ] **Step 7: Scripts**

In `package.json` scripts add/modify:

```json
    "site": "node site/generate.mjs",
    "predev": "pnpm site",
    "prebuild": "pnpm site",
    "dev": "vite",
```

- [ ] **Step 8: Run tests, then a real build**

Run: `pnpm vitest run site/generate.test.ts && pnpm typecheck && pnpm test && pnpm build`
Expected: PASS; `dist/index.html`, `dist/es/faq/index.html`, `dist/sitemap.xml`, `dist/llms.txt`, `dist/app/index.html` exist and `dist/index.html` references a hashed `site.css` under `dist/assets/`. Run `git status --short` and confirm none of the generated files show up (gitignore from Task 4).

If TypeScript complains that `./generate.mjs` has no types in the test, add `// @ts-expect-error untyped ESM` above that import line **only if** `pnpm typecheck` fails; vitest itself does not typecheck.

- [ ] **Step 9: Commit**

```bash
git add site package.json
git commit -m "feat(site): static landing, how-to-measure and FAQ generator with SEO metadata

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Static assets — robots, manifest, favicons, OG image, screenshots

**Files:**
- Create: `public/robots.txt`, `public/site.webmanifest`, `public/favicon.svg`, `public/favicon.ico`, `public/apple-touch-icon.png`, `public/og.png`, `public/img/3d.png`, `public/img/front.png`
- Create: `site/og.svg`, `scripts/screenshots.sh`
- Modify: `package.json` (script `assets`)

**Interfaces:**
- Consumes: the running dev server from Task 4/5 (`/app/`).

- [ ] **Step 1: robots.txt and manifest**

`public/robots.txt`:

```
User-agent: *
Allow: /

Sitemap: https://understairsplanner.com/sitemap.xml
```

`public/site.webmanifest`:

```json
{
  "name": "Under Stairs Storage Planner",
  "short_name": "Stairs Planner",
  "start_url": "/app/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#2b6cb0",
  "icons": [
    { "src": "/apple-touch-icon.png", "sizes": "180x180", "type": "image/png" },
    { "src": "/favicon.svg", "sizes": "any", "type": "image/svg+xml" }
  ]
}
```

- [ ] **Step 2: favicon.svg (a stair triangle with a drawer)**

`public/favicon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#2b6cb0"/>
  <path d="M8 56 L8 10 L56 46 L56 56 Z" fill="#fff"/>
  <path d="M14 50 L14 26 L34 41 L34 50 Z" fill="#2b6cb0" opacity=".85"/>
  <path d="M38 50 L38 44 L50 53 L50 50 Z" fill="#2b6cb0" opacity=".85"/>
</svg>
```

- [ ] **Step 3: og.svg source and the conversion script**

`site/og.svg` (1200×630):

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f8fafc"/>
  <path d="M700 560 L700 120 L1140 460 L1140 560 Z" fill="#2b6cb0"/>
  <path d="M730 530 L730 200 L900 330 L900 530 Z" fill="#fff" opacity=".9"/>
  <path d="M920 530 L920 350 L1110 495 L1110 530 Z" fill="#fff" opacity=".9"/>
  <text x="70" y="250" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#111827">Under Stairs</text>
  <text x="70" y="325" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#111827">Storage Planner</text>
  <text x="70" y="400" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="30" fill="#374151">Free 3D design tool · drawings · PDF · cut list</text>
  <text x="70" y="560" font-family="system-ui, Helvetica, Arial, sans-serif" font-size="28" fill="#2b6cb0">understairsplanner.com</text>
</svg>
```

`scripts/screenshots.sh` (executable):

```bash
#!/usr/bin/env bash
# Regenerates raster assets: icons from SVG, OG image, and app screenshots via headless Chrome.
# Needs: rsvg-convert, magick, Google Chrome, and `pnpm dev` running on :5173.
set -euo pipefail
cd "$(dirname "$0")/.."
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
rsvg-convert -w 180 -h 180 public/favicon.svg -o public/apple-touch-icon.png
rsvg-convert -w 32 -h 32 public/favicon.svg -o /tmp/favicon-32.png
magick /tmp/favicon-32.png public/favicon.ico
rsvg-convert -w 1200 -h 630 site/og.svg -o public/og.png
mkdir -p public/img
shot() { # $1 = url, $2 = out file
  "$CHROME" --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader --hide-scrollbars \
    --window-size=1600,1000 --virtual-time-budget=8000 --screenshot="$2" "$1" 2>/dev/null
  magick "$2" -strip "$2"
}
shot "http://localhost:5173/app/?lang=en&shot=3d" public/img/3d.png
shot "http://localhost:5173/app/?lang=en&shot=front" public/img/front.png
echo "assets written"
```

The `shot` query parameter must select the tab before first paint. Add to `src/store/store.ts` `initialLanguage()`'s sibling: in `createPlannerStore` call site, read `new URLSearchParams(location.search).get('shot')` and, when it is one of `'3d'|'front'|'plan'|'side'|'cutlist'`, call `useStore.setState((s) => ({ ui: { ...s.ui, tab } }))` right after the store is created (guarded by `typeof location !== 'undefined'`). Also strip `shot` in the same `replaceState` as `lang`.

`package.json`: `"assets": "bash scripts/screenshots.sh"`.

- [ ] **Step 4: Generate**

Run in one terminal: `pnpm dev`. In another: `chmod +x scripts/screenshots.sh && pnpm assets`.
Expected: eight PNG/ICO files exist; open `public/img/3d.png` and confirm the 3D cabinet (not a blank canvas). If the canvas is blank, raise `--virtual-time-budget` to 15000 and retry; if still blank, capture manually at 1600×1000 in Chrome and save to the same paths.

- [ ] **Step 5: Verify build**

Run: `pnpm build && ls dist/og.png dist/img/3d.png dist/robots.txt dist/site.webmanifest dist/favicon.ico`
Expected: all present.

- [ ] **Step 6: Commit**

```bash
git add public scripts/screenshots.sh site/og.svg package.json src/store/store.ts
git commit -m "feat(site): favicons, manifest, robots, OG image and screenshots

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Translate site content to RU, DE, PL, ES

**Files:**
- Modify: `site/content.mjs`

**Interfaces:**
- Consumes: `checkContent` (Task 5) enforces structure.

- [ ] **Step 1: Add a test that translations are not aliases of EN**

Append to `site/generate.test.ts`:

```ts
describe('translations', () => {
  it('every non-EN language has its own text', () => {
    for (const l of LANGS.filter((x) => x !== 'en')) {
      expect(content[l], l).not.toBe(content.en);
      expect(content[l].landing.h1, l).not.toBe(content.en.landing.h1);
      expect(content[l].faq.items[0].a, l).not.toBe(content.en.faq.items[0].a);
    }
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run site/generate.test.ts -t translations`
Expected: FAIL (aliases).

- [ ] **Step 3: Write the four translations**

In `site/content.mjs` replace `export const content = { en, ru: en, … }` with full `const ru = {…}`, `const de = {…}`, `const pl = {…}`, `const es = {…}` objects mirroring `en` key-for-key (same array lengths), then `export const content = { en, ru, de, pl, es };`. Rules:
- Brand per language from Global Constraints; `title` pattern `<page title> – <brand>`; `description` ≤ 155 characters.
- Keep `{measureUrl}` / `{issuesUrl}` and the two `<a href="…">` wrappers. Screenshot `src` unchanged; translate `alt`.
- Head-term phrasing to reuse: RU «шкаф под лестницей», «пространство под лестницей»; DE „Stauraum unter der Treppe“, „Treppenschrank“; PL „zabudowa pod schodami“, „szafa pod schodami“; ES „armario bajo escalera“, „hueco de la escalera“.
- Use the app glossary from Task 1 for cabinet terms; mm everywhere except RU «мм».

- [ ] **Step 4: Run all site tests and build**

Run: `pnpm vitest run site && pnpm build`
Expected: PASS; `dist/pl/how-to-measure/index.html` contains Polish text.

- [ ] **Step 5: Commit**

```bash
git add site/content.mjs site/generate.test.ts
git commit -m "feat(site): Russian, German, Polish and Spanish page content

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: End-to-end verification and handoff notes

**Files:**
- Modify: `README.md` (rollout section)

- [ ] **Step 1: Full local check**

```bash
pnpm typecheck && pnpm test && pnpm build
pnpm preview &
sleep 2
curl -s http://localhost:4173/ | grep -c 'hreflang'        # expect 11 (6 link alternates + 5 footer links)
curl -s http://localhost:4173/de/faq/ | grep -o '<html lang="de">'
curl -s http://localhost:4173/app/ | grep -o '<title>[^<]*'
curl -s http://localhost:4173/sitemap.xml | grep -c '<loc>' # expect 16
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4173/robots.txt   # 200
kill %1
```

- [ ] **Step 2: Lighthouse SEO**

In Chrome open `http://localhost:4173/` → DevTools → Lighthouse → SEO only. Expected ≥ 95. Fix any flagged item (usually missing `alt`, tap targets, or description length) in `site/content.mjs`/`site/site.css`.

- [ ] **Step 3: Add the rollout checklist to README under Deploy**

```markdown
### Custom domain rollout (one-time)

1. Register `understairsplanner.com`; DNS: `A` 185.199.108.153 / 185.199.109.153 / 185.199.110.153 / 185.199.111.153, `CNAME www → bynov.github.io`.
2. GitHub → Settings → Pages → Custom domain `understairsplanner.com`, tick Enforce HTTPS once DNS resolves.
3. Cloudflare Web Analytics → add site → copy token → repo secret `SITE_CF_BEACON`.
4. Google Search Console → domain property → HTML-tag token → repo secret `SITE_GSC_TOKEN`; submit `https://understairsplanner.com/sitemap.xml`.
5. Push to `main`; verify `https://understairsplanner.com/` and `/app/`.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: custom domain rollout checklist

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review against the spec

- §2 Naming: Task 1 (`ui.appTitle`), Task 4 (title, package, README, CLAUDE.md), Task 5 (`brand`). ✔
- §3 URLs, `?lang=` resolution, `/app/`, trailing slashes: Tasks 2, 4, 5. ✔ `noindex` on `/app/` is an addition beyond the spec (app has no crawlable text; sitemap still lists it so the URL is known) — acceptable, noted here.
- §4.1–4.5 generator, template, content model, outputs, gitignore, Vite MPA, scripts, CNAME: Tasks 4, 5. ✔
- §4.6 CI secrets: Task 4. ✔
- §5.1 languages, detectLang, readLangFromUrl, select switcher: Tasks 1, 2. ✔
- §5.2 glyph coverage test: Task 3. ✔
- §5.3 rename: Task 4. ✔
- §5.4 screenshots + og.png: Task 6 (scripted instead of manual; manual fallback stated). ✔
- §6 content: Task 5 (EN), Task 7 (translations). ✔
- §7 testing incl. Lighthouse: Tasks 5, 8. ✔
- §8 rollout: Task 8 README. ✔
- Type/name consistency: `readLangFromUrl` (Tasks 2, 6), `renderAll`/`checkContent` (Tasks 5, 7), `htmlInputs` (Task 4), `SLUG`/`PAGES`/`LANGS`/`SITE`/`REPO`/`OG_LOCALE` exported from `content.mjs` and imported in `generate.mjs`. ✔
