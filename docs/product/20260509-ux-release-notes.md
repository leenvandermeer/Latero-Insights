# UX Release Notes — 2026-05-09

## Scope

Deze UX-slag brengt meerdere Latero Control-oppervlakken dichter bij één consistente operating experience:

- Monitor
- Lineage
- Catalog
- Products
- Admin

## Shipped

### Monitor

- Oude globale `time-travel` bar verwijderd
- `Overview`, `Runs` en `Data Quality` gebruiken nu één compact period/filter patroon
- Date picker sizing gelijkgetrokken met andere controls
- `Runs` en `Data Quality` headers compacter gemaakt

### Lineage

- `Trace` is de primaire graph-ervaring geworden
- `Map` uit de primaire flow gehaald
- Filters links zijn inklapbaar voor meer canvasruimte
- Graph-layout opgeschoond
- Losse layer labels op het canvas verwijderd
- Export naar image toegevoegd
- Nodes zijn draggable voor demo/export use cases

### Catalog

- Catalog heeft nu een echte landing/overview
- URL-backed browse state toegevoegd
- Datasets ondersteunen alle lagen
- `Open Trace` vanuit entities en datasets toegevoegd
- Copy en metric-cards compacter gemaakt

### Products

- Productdetail is member-centric gemaakt
- `Member entities` met directe trace-entrypoints toegevoegd
- Member management naar de detailpagina gehaald
- Product registry verrijkt met readiness-filters en summary cards
- Product UX-review en redesign vastgelegd

### Issues

- `Incidents` in tenant-UX herpositioneerd naar `Issues`
- Issue types en source filters toegevoegd
- Alerts als losse UI-bestemming verwijderd

### Admin

- Admin shell opnieuw in Latero-stijl gebracht
- Compactere page headers, forms en modals
- Tenant selection op users-pagina robuuster gemaakt
- Metrics en tenant catalog verbeterd

## Product Impact

- Minder UX-ruis in de monitorflow
- Sterkere scheiding tussen discovery, registry en operate-surfaces
- Minder legacy-achtige navigatiepatronen
- Consistentere Latero-huisstijl tussen tenant-app en admin

## Reference Docs

- [20260508-lineage-ux-study-and-redesign.md](/Users/leenvandermeer/Git/Latero%20Control/docs/product/20260508-lineage-ux-study-and-redesign.md)
- [20260508-catalog-ux-review-and-fixes.md](/Users/leenvandermeer/Git/Latero%20Control/docs/product/20260508-catalog-ux-review-and-fixes.md)
- [20260508-dashboard-ux-strategy.md](/Users/leenvandermeer/Git/Latero%20Control/docs/product/20260508-dashboard-ux-strategy.md)
- [20260508-admin-ux-redesign.md](/Users/leenvandermeer/Git/Latero%20Control/docs/product/20260508-admin-ux-redesign.md)
- [20260509-products-ux-review-and-redesign.md](/Users/leenvandermeer/Git/Latero%20Control/docs/product/20260509-products-ux-review-and-redesign.md)
- [20260509-issues-register-concept.md](/Users/leenvandermeer/Git/Latero%20Control/docs/product/20260509-issues-register-concept.md)
