# LADR-014 — Grid container width: custom ResizeObserver in plaats van useContainerWidth

- **Status:** ACCEPTED
- **Datum:** 2026-04-20
- **Auteurs:** Tech Lead / Developer

---

## Context

`DashboardCanvas` gebruikt `react-grid-layout` v2 voor het dashboard-raster.
De library biedt de `useContainerWidth()` hook om de breedte van het grid-element
te meten via een `ResizeObserver`.

`DashboardCanvas` returned `null` totdat een `mounted` state-flag `true` is
(standaard SSR-patroon om hydration-mismatches te voorkomen).

De `useContainerWidth()` hook initialiseert met `initialWidth = 1280` (hardcoded
default in de library) en registreert zijn `ResizeObserver` in een `useEffect([])`
met een lege dependency array. Op het moment dat dit effect draait, is
`containerRef.current` nog `null` omdat de container pas na de `mounted` check
in de DOM verschijnt. De observer registreert nooit het echte element.

**Gevolg:** `width` blijft permanent `1280px`, ongeacht de echte viewport of
sidebar-breedte. Op een MacBook Pro M5 (1512px viewport, sidebar 256px) is de
beschikbare breedte ~1208px. Het grid rendert echter op 1280px — een overflow van
~72px rechts. De `overflow-x-hidden` op `<main>` clipt de rechtse widgets.
Dit was visueel zichtbaar als de "Dataset Health" widget die aan de rechterkant
werd afgeknipt op de `/pipelines` pagina.

Statische pagina's als `/datasets` gebruiken geen `react-grid-layout` en toonden
het probleem niet, wat de fout maskeerde.

---

## Beslissing

Vervang `useContainerWidth()` door een eigen `ResizeObserver` die in een
`useEffect([mounted])` draait — met `mounted` als dependency. Hierdoor start
de observer pas ná `mounted = true`, op het moment dat `containerRef.current`
daadwerkelijk in de DOM staat.

```tsx
// Eigen ResizeObserver — start pas na mounted=true
const containerRef = useRef<HTMLDivElement>(null);
const [gridWidth, setGridWidth] = useState<number | null>(null);

useEffect(() => {
  const node = containerRef.current;
  if (!node) return;
  const measure = () => setGridWidth(node.getBoundingClientRect().width);
  measure();
  const ro = new ResizeObserver((entries) => {
    setGridWidth(entries[0]?.contentRect.width ?? node.getBoundingClientRect().width);
  });
  ro.observe(node);
  return () => ro.disconnect();
}, [mounted]); // re-run wanneer mounted flips naar true
```

In `<ResponsiveGridLayout>`:

```tsx
width={gridWidth ?? 1280}
```

---

## Gevolgen

**Positief:**
- Grid meet de werkelijke container-breedte op alle viewport-groottes
- Sidebar expand/collapse triggert automatisch een re-meting via de ResizeObserver
  (container stretcht via `flex-1 min-w-0 / width: 100%`)
- Geen afhankelijkheid meer van een library-internal die breekt bij lazy-mount patronen

**Negatief / Trade-off:**
- We importeren `useContainerWidth` niet meer uit de library — toekomstige updates
  aan die hook worden niet automatisch meegenomen. Risico is klein: de hook doet
  slechts één ding.

**Aanvullende fixes in dezelfde sessie (LADR-013 follow-up):**
- `useBreakpoint` krijgt een lazy `useState` initializer die `window.innerWidth`
  leest op eerste client render, zodat de sidebar nooit een verkeerde initiële
  collapsed-state heeft
- `transition-all` op `<main>` vervangen door `transition-[padding-left]` om
  onbedoelde CSS-transities te voorkomen
- Sidebar dispatcht `window.dispatchEvent(new Event("resize"))` na collapse/expand
  als failsafe voor grid re-meting

---

## Alternatieven overwogen

| Optie | Afgewezen omdat |
|-------|----------------|
| `useContainerWidth({ measureBeforeMount: true })` | Optie bestaat niet in v2 API; `measureBeforeMount` heeft een andere semantiek |
| De `mounted` check verwijderen | Veroorzaakt hydration-mismatches in Next.js SSR |
| `key={mounted}` op de grid wrapper | Forceert volledige grid remount bij elke page load — slechte UX |
| `initialWidth` doorgeven aan `useContainerWidth` | De observer wordt nog steeds nooit geregistreerd; breedte verandert niet bij resize |
