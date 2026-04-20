# LADR-006 — Insights theme architecture: data-theme as single source of truth

**Datum:** 2026-04-18
**Status:** ACCEPTED

## Context

Layer2 Meta Insights (LINS-072) must support light and dark theme modes. The
application uses Tailwind CSS v4, which introduces an `@theme` block that
emits CSS custom properties as part of the design system. Tailwind v4 allows
`@theme` to be placed inside a `@media` block, making it tempting to declare
dark mode overrides as:

```css
@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: #0F0D08;
    /* ... */
  }
}
```

During initial implementation this pattern was used. It caused a defect: the
OS dark mode preference unconditionally overrode all CSS custom properties at
the Tailwind theme level, making it impossible for the `data-theme` attribute
set by the user-facing toggle to take effect. Users on a dark-mode OS could not
switch to light mode.

The root cause is that Tailwind v4's `@theme` inside `@media` generates
`:root { --var: value }` wrapped in that media query at global scope, which has
higher effective priority than any attribute selector applied after the fact.

## Decision

1. **The Tailwind `@theme` block in `globals.css` MUST define light-mode values
   only.** It is never placed inside a `@media` query.

2. **Dark mode overrides MUST be expressed as a `[data-theme="dark"]` CSS
   selector block** in `globals.css`, not as a `@media @theme` block.

3. **`tokens.css` remains the single source of truth for design token values.**
   It defines `:root` (light), `[data-theme="dark"]` (explicit dark), and
   `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`
   (OS preference fallback when no explicit choice has been stored).

4. **Default theme is light.** On first load, `localStorage.theme` is set to
   `"light"` if absent, and `data-theme="light"` is written to `<html>`. This
   means the OS preference fallback in `tokens.css` never activates after first
   load — `data-theme` is always set.

5. **An inline `<script>` in the root layout reads `localStorage.theme` and
   sets `data-theme` before first paint**, preventing a flash of wrong-theme
   content on reload. The `<html>` element carries `suppressHydrationWarning`
   because this attribute is written by client script before React hydrates.

6. **The theme toggle writes both `localStorage` and `data-theme`** synchronously
   in the same event handler. No full-page reload is required for theme changes.

## Consequences

- OS dark mode preference is never applied automatically after the first page
  load. Users who want dark mode must activate it explicitly via the toggle.
  This is a deliberate product choice: the default experience is always light.
- Tailwind utility classes that depend on dark-mode variants (e.g.
  `dark:text-white`) will not work because Tailwind's dark mode strategy is not
  configured. All dark mode styling MUST use CSS custom properties via
  `var(--token)` references, not Tailwind dark variants.
- The `@theme` block and `[data-theme="dark"]` block in `globals.css` must be
  kept in sync when new tokens are added. Adding a token to `@theme` without a
  corresponding override in `[data-theme="dark"]` will cause it to use the light
  value in dark mode.
- The `tokens.css` OS preference fallback
  (`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`) is
  retained as a theoretical fallback for contexts where JS is disabled and no
  `data-theme` is set. In normal operation it does not activate.
- Requirements: LINS-072 has been updated to reflect this architecture.
  LINS-086–LINS-089 document the sidebar tokens, PageHeader, Card, and logo
  assets that were implemented as part of the same design system overhaul.
