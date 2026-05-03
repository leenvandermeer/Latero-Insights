# LADR-033 — Globale form-element baseline styling

**Datum:** 2026-05-03  
**Status:** ACCEPTED  
**Auteur:** Latero product

---

## Context

Formuliervelden in de Settings-pagina toonden twee zichtbare inconsistenties:

1. **Ander lettertype in inputs**: browsers gebruiken standaard `system-ui` of
   `monospace` voor `<input>`, `<select>` en `<textarea>`, tenzij expliciet
   overschreven. De body-font is Inter; zonder reset gebruikt elk invoerveld een
   afwijkend lettertype.

2. **Ontbrekende ruimte tussen label en invoerveld**: het `Field`-component
   gebruikte `space-y-1.5` (Tailwind utility) voor de verticale stapeling, maar
   `space-y-*` werkt via margin op directe children. Door de `<label>` wrapper
   en de `<span>`-label was de visuele ruimte onvoldoende consistent.

Tailwind CSS v4 levert geen volledige preflight-reset voor formulierelementen;
font-inheritance moet expliciet worden aangegeven.

## Beslissing

### 1. Globale form-element reset in `globals.css`

```css
input, select, textarea {
  font-family: inherit;
  font-size: 0.875rem;
  color: var(--color-text);
}

input[type="text"], input[type="password"], input[type="number"],
input[type="email"], input[type="search"], select, textarea {
  width: 100%;
  border-radius: var(--radius-md, 0.75rem);
  border: 1px solid var(--color-input, var(--color-border));
  background: var(--color-bg);
  padding: 0.5rem 0.75rem;
  outline: none;
  transition: border-color 150ms ease, box-shadow 150ms ease;
}

:focus {
  border-color: var(--color-brand, #1B3B6B);
  box-shadow: 0 0 0 3px rgba(27, 59, 107, 0.10);
}
```

Dit geldt app-breed. Alle formuliervelden erven automatisch Inter, krijgen
consistente padding, border-radius en focus-state — zonder per-component
className te herhalen.

### 2. Field-component: `flex flex-col gap-2`

Het `Field`-component in Settings gebruikt voortaan `flex flex-col gap-2` in
plaats van `space-y-1.5`. `gap` werkt direct op flex-children en geeft stabielere
8px ruimte tussen label-span en invoerveld, ongeacht de nesting.

## Gevolgen

- Alle `<input>`, `<select>` en `<textarea>` in de applicatie erven automatisch
  de juiste font, grootte en basisborder — ook in toekomstige formulieren
- Specifieke overrides (bv. `w-28` voor het TTL-veld) blijven werken; de reset
  is een minimum, geen maximum
- Checkboxes en radio's zijn bewust uitgesloten van de `width: 100%` reset
- Nieuwe formuliercomponenten hoeven geen font-klasse meer op te geven
