# LADR-079 — Unified Entity Detail Hub

**Datum:** 2026-05-13  
**Status:** Accepted  
**Beslissers:** Tech Lead, UX Designer

---

## Context

### Probleem

Het huidige systeem heeft fragmentatie van entity/product detail views:

1. **Product detail pages** (`/products/[id]`): 4 tabs (Overview, Issues, Lineage, Evidence)
2. **Entity detail pages** (`/entities/[fqn]`): basic info + layer status + runs + quality summary
3. **Catalog drawers**: limited metadata + layer status + Open Trace button
4. **Quality detail pages**: separate pages voor DQ check details

**Gevolg:** Gebruikers moeten tussen 3-4 schermen switchen voor een compleet beeld van een entity. Dit leidt tot:
- Cognitieve overhead (mentaal model opbouwen over meerdere schermen)
- Veel navigatie (back/forward clicks)
- Context verlies tussen schermen
- Duplicatie van UI componenten

**Advisory input (LADR-020260512):**
> "Entity detail hub — product/entity page combines health, runs, incidents, downstream impact — alles in één scherm"

---

## Beslissing

We bouwen een **Unified Entity Detail Hub** dat alle entity-gerelateerde informatie consolideert in één pagina met tab-based navigation.

### Architectuur

**URL:** `/entities/[fqn]?tab=[overview|health|quality|lineage|issues]`

**Tab structuur:**
1. **Overview** — At-a-glance essentials
   - Context panel (owner, steward, SLA, classification, tags)
   - Quick stats cards (success rate, total runs, last run, open issues)
   - Recent activity timeline (laatste 10 runs)
   - Member entities (voor products)

2. **Health** — Operational status (TODO)
   - Layer status per entity
   - Recent runs timeline met trends
   - Duration charts
   - Error patterns

3. **Quality** — Data quality (TODO)
   - Pass rate trends (7/30 dagen)
   - Failed checks grouped by category
   - Quality dimensions overview
   - Links naar full check details

4. **Lineage** — Dependencies (TODO)
   - Embedded lineage graph
   - Upstream/downstream quick view
   - Impact radius indicator

5. **Issues** — Incidents & alerts (TODO)
   - Open incidents lijst
   - Policy exceptions
   - SLA breaches
   - Resolution timeline

### Design Patterns

**Consistent met bestaande UX:**
- Tabbed interface pattern (zoals Catalog Hub, Settings Hub)
- Design tokens uit `tokens.css`
- Card-based layout
- URL state management via query parameters
- Breadcrumb navigation (back button)

**Data fetching:**
- `useEntityDetail(fqn)` — entity metadata
- `useEntityRuns(fqn, limit)` — recent runs
- `useEntityQuality(fqn, days)` — quality checks
- `useDataProduct(id)` — linked product info (if applicable)

**API response shape:**
```typescript
{
  data: Entity | Product | Quality[]
  source: string
}
```

---

## Consequenties

### Positief

✅ **Eén bron van waarheid** — alle entity info op één plek  
✅ **Minder navigatie** — gebruikers hoeven niet tussen schermen te switchen  
✅ **Consistent UX** — zelfde tab pattern als Catalog/Settings  
✅ **Uitbreidbaar** — nieuwe tabs toevoegen is eenvoudig  
✅ **Performance** — data fetching geoptimaliseerd (alleen active tab laadt extra data)  
✅ **Mobile-friendly** — overflow-x-auto tabs, responsive grid  
✅ **Backward compatible** — oude URLs blijven werken (oude entity-detail.tsx kan blijven)

### Negatief

⚠️ **Initial load time** — Overview tab laadt meer data in één keer (mitigated door staleTime caching)  
⚠️ **Code migratie** — bestaande entity-detail.tsx moet deprecated worden  
⚠️ **Tab state** — URL query parameter management moet goed werken (volgt bestaand pattern)

### Risico's

🔴 **Breaking change risk** — bestaande links naar `/entities/[fqn]` tonen nu andere UI  
   **Mitigatie:** Oude component blijft beschikbaar, geleidelijke migratie

🟡 **Data fetch waterfall** — entity → product → quality (sequentieel)  
   **Mitigatie:** Product fetch heeft `enabled` flag, quality data is optional

---

## Implementatie

### Files Created

```
web/src/app/(tenant)/(dashboard)/entities/[fqn]/
  ├── entity-detail-hub.tsx         (Main hub component met tabs)
  ├── overview-tab.tsx               (Overview tab implementation)
  ├── page.tsx                       (Updated om hub te gebruiken)
  └── entity-detail.tsx              (Deprecated, kan verwijderd worden)
```

### Components

**EntityDetailHub** (main component)
- Tab management via `useSearchParams` + `useRouter`
- Data fetching voor entity, runs, quality, product
- Header met breadcrumb + quick stats chips
- Tab content switching

**OverviewTab**
- StatCard components (success rate, runs, last run, issues)
- ContextPanel (metadata grid met icons)
- RecentActivity (timeline van laatste runs)
- MemberEntitiesSection (placeholder voor products)

**Placeholder tabs** (Health, Quality, Lineage, Issues)
- Skeleton components voor toekomstige implementatie

### Design Tokens Used

```css
--color-card          /* Card backgrounds */
--color-border        /* Border colors */
--color-text          /* Primary text */
--color-text-muted    /* Secondary text */
--color-brand         /* Active tab underline */
--color-accent        /* Icon colors */
--color-surface       /* Nested card backgrounds */
--touch-target-min    /* 44px minimum tap area */
```

---

## Alternatieven Overwogen

### A. Sidebar navigatie (zoals Admin pages)
**Afgewezen:** Te heavy voor entity details, meer geschikt voor applicatie-niveau navigatie.

### B. Accordion-based (alles op één scrollable pagina)
**Afgewezen:** Moeilijk te navigeren bij veel data, geen URL state management.

### C. Modal/Drawer approach (zoals huidige Catalog)
**Afgewezen:** Beperkt schermruimte, niet geschikt voor complex data zoals lineage graphs.

### D. Separate pages per sectie (`/entities/[fqn]/health`)
**Afgewezen:** Meer navigatie overhead, geen quick switching tussen tabs.

---

## Volgende Stappen (TODO)

**P0 (Critical):**
- [x] Framework + Overview tab
- [ ] Health tab (layer status + runs timeline)
- [ ] Quality tab (DQ checks + trends)
- [ ] Lineage tab (embedded graph)
- [ ] Issues tab (incidents + exceptions)

**P1 (Nice-to-have):**
- [ ] Member entities grid (voor products)
- [ ] Export/share functionality
- [ ] Keyboard shortcuts (tab navigation)
- [ ] Deep linking naar specifieke tab sections

**P2 (Future):**
- [ ] Product Detail Hub (unified product page met zelfde pattern)
- [ ] Dataset Detail Hub (als datasets first-class citizens worden)
- [ ] Real-time updates (WebSocket voor run status)

---

## Validatie

**Build status:** ✅ TypeScript compiles zonder errors  
**Test coverage:** Unit tests for Overview tab components (TODO)  
**UX review:** Follows Latero design patterns ✅  
**Performance:** Lazy tab loading via conditional rendering ✅  
**Accessibility:** 44px touch targets, semantic HTML ✅

---

## Referenties

- LADR-077: Drift Detection Wiring (change events feed)
- LADR-020260512: Advisory Report (Entity detail hub recommendation)
- `/docs/product/20260512-werkpakket-changes-schema-lineage-drift.md`
- Catalog Hub implementation: `/web/src/app/(tenant)/(dashboard)/catalog/catalog-hub.tsx`
