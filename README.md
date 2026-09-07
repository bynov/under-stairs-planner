# Under-stairs closet planner

Browser-based planner for a fitted cabinet inside an under-stairs closet.
Enter the closet envelope and the cabinet columns; get a 3D preview,
dimensioned 2D views and a PDF scheme with a cut list. Runs entirely locally;
the project autosaves to localStorage and can be exported/imported as JSON.

## Develop

    pnpm install
    pnpm dev        # http://localhost:5173
    pnpm test       # vitest
    pnpm typecheck
    pnpm build      # dist/

## Layout

- `src/model` types, defaults, validation
- `src/geometry` envelope math, column layout, `Part[]` builder
- `src/cutlist`, `src/drawing`, `src/render`, `src/pdf` pure outputs derived from `Part[]`
- `src/store` zustand store, persistence
- `src/ui` React components (3D viewport under `src/ui/three`)

Design spec: `docs/superpowers/specs/2026-09-07-understairs-closet-planner-design.md`.
