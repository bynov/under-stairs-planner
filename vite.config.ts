import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { LANGS, PAGES, SLUG } from './site/content.mjs';

/** Every HTML entry: the app plus whatever site/generate.mjs produced (no glob — avoids Node's globSync ExperimentalWarning). */
export function htmlInputs(root = import.meta.dirname): Record<string, string> {
  const slug = SLUG as Record<string, string>;
  const candidates = LANGS.flatMap((lang) => PAGES.map((page) => `${lang === 'en' ? '' : lang + '/'}${slug[page]}index.html`));
  const files = ['app/index.html', ...candidates.filter((f) => existsSync(resolve(root, f)))];
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
