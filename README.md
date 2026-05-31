# Keluargaku

Keluargaku is a small family-tree web application built with React, TypeScript and Vite. It provides a visual family-tree canvas, person detail/edit panels, export functionality, and basic offline support (service worker + offline page).

**Table of contents**
- Features
- Tech stack
- Quick start
- Available scripts
- Project structure
- Data flow & key components
- PWA / Offline
- Development notes
- Troubleshooting
- Contributing

## Features
- Visual family tree canvas for browsing relationships
- Add / edit person records via a form
- Export family data (JSON/CSV) from the app
- Basic offline fallback using `public/offline.html` and `public/sw.js`

## Tech stack
- React 19 + TypeScript
- Vite for dev server and build
- React Router for page routing
- Tailwind CSS (present as dependency)

## Quick start
Prerequisites: Node.js (18+ recommended) and npm (or compatible package manager).

1. Install dependencies

```bash
npm install
```

2. Run the dev server

```bash
npm run dev
# open http://localhost:5173 in your browser
```

3. Build for production

```bash
npm run build
```

4. Preview the production build locally

```bash
npm run preview
```

Tip: to run TypeScript-only checks without emitting files:

```bash
npx tsc --noEmit
```

## Available scripts (from `package.json`)
- `dev` — start Vite dev server
- `build` — run `tsc` then `vite build` (type-check + build)
- `preview` — preview the production build locally

## Project structure
Top-level files and folders:

- [index.html](index.html) — app HTML shell
- [package.json](package.json) — scripts & dependencies
- [tsconfig.json](tsconfig.json) — TypeScript config
- [vite.config.ts](vite.config.ts) — Vite configuration
- [public/](public/) — static assets, PWA files, `sw.js`, `offline.html`
- [src/](src/) — application source

Important source files (inside `src/`):

- [src/main.tsx](src/main.tsx) — application entry; mounts the app
- [src/App.tsx](src/App.tsx) — top-level app & router
- [src/pages/HomePage.tsx](src/pages/HomePage.tsx) — main app page
- [src/pages/PersonFormPage.tsx](src/pages/PersonFormPage.tsx) — add/edit person form
- [src/pages/ExportPage.tsx](src/pages/ExportPage.tsx) — export functionality
- [src/components/AppShell.tsx](src/components/AppShell.tsx) — layout wrapper
- [src/components/FamilyTreeCanvas.tsx](src/components/FamilyTreeCanvas.tsx) — renders the family tree
- [src/components/PersonDetailPanel.tsx](src/components/PersonDetailPanel.tsx) — person detail UI
- [src/context/FamilyContext.tsx](src/context/FamilyContext.tsx) — React Context holding family data and actions
- [src/lib/familyData.ts](src/lib/familyData.ts) — helper functions / sample data
- [src/types/family.ts](src/types/family.ts) — TypeScript types for family data

## Data flow & key components
- State: the app centralizes family data in `FamilyContext`. The context exposes the family tree, CRUD actions, and any persistence hooks.
- Rendering: `FamilyTreeCanvas` consumes the context to render nodes and relationships. Selecting a node typically opens `PersonDetailPanel`.
- Forms: `PersonFormPage` is used to create or edit persons; it calls context actions to persist changes.
- Export: `ExportPage` reads the context data and offers download/export options.

## PWA / Offline
Files under `public/` include `manifest.json`, `sw.js`, and `offline.html` to provide a basic offline fallback and PWA metadata. Service worker registration (if present) is typically handled in `src/main.tsx` or a similar bootstrap file.

## Development notes
- The build script runs `tsc` before `vite build` so TypeScript errors will fail a production build.
- Tailwind CSS is installed; if you rely on Tailwind utility classes, ensure `tailwind.config.cjs` (or `.js`) is present and configured. If missing, initialize it with `npx tailwindcss init`.
- Add new pages under `src/pages/` and new UI pieces in `src/components/`.

## Troubleshooting
- If `npm run dev` fails, ensure Node.js version is >= 18 and reinstall dependencies (`rm -rf node_modules && npm install`).
- If `npm run build` fails, run `npx tsc --noEmit` to see TypeScript errors and fix accordingly.
- Port conflicts: Vite defaults to `5173`. If the port is in use, pass a different port via `--port` or set it in `vite.config.ts`.

## Contributing
- Open issues for bugs or feature requests. Create pull requests for fixes and features — keep changes focused and include a short description of intent.
- Add a `LICENSE` file if you want to change the project's license.

---
If you'd like, I can also:
- Add more targeted docs for specific components (e.g., `FamilyContext` API)
- Create a CONTRIBUTING.md or code snippets for common tasks


