# Changelog

All notable changes to `@jo51yon/claudia-rte` are recorded here. Semantic versioning: a MAJOR
bump means a prop, exported type, or default behaviour changed in a way that could break an
existing consumer without any code change on their side. A MINOR bump is additive only — new
exports, new optional props, new default styling that doesn't change existing layout. Consuming
projects should pin to a tag (`#v1.0.0`), never `#main` — `main` can and will contain
in-progress work between releases.

## v1.0.0 — 2026-08-17

First tagged release. Backfilled honestly against real commit history, not written from
memory: this tag covers everything that existed before tagging began, not a curated subset.

- `RichText`, `RichTextView`, `BlockEditor`, `BlockCompletion` — ported from SafeSpaces,
  storage made project-agnostic via `onUpload`/`onResolve` dependency injection.
- `style.css` (opt-in) — ported from Lintel's own real, working stylesheet, generalised to
  `--claudia-rte-*` custom properties. A consumer that already has its own `.rte-*` rules
  (petgi) is unaffected unless it explicitly imports this file.

**Known consumers at this tag:** `petgi` (git dependency since 2026-08-14), `lintel` (migrated
2026-08-17, same commit that shipped `style.css`).
