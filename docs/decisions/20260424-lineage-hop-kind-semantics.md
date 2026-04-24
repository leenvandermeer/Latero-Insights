# LADR-025 — Lineage hop kind semantics en filterlogica

Datum: 2026-04-24
Status: ACCEPTED
Owner: Latero product

---

## Context

De `meta.data_lineage` tabel registreert edges tussen datasets. Niet elke edge
vertegenwoordigt een echte databewegingen. Producers kunnen ook contextuele
relaties vastleggen — zoals een lookup-tabel die als verrijkingsbron dient, of
een technische koppeling die niet tot de materiele lineage behoort.

Zonder onderscheid telt elke edge mee als echte lineage. Dat leidt tot:

- te brede impact-analyse (ook niet-materiele relaties tellen mee als input/output)
- ruis in de lineage graaf (contextuele edges verstoren het beeld van datastromen)
- onjuiste depth-berekeningen in chain views

Het MDCF contract introduceert daarvoor het veld `hop_kind` (LMETA-012 in
`docs/requirements/meta-table-contract.md`).

---

## Besluit

### Hop kind waarden

Twee semantische rollen zijn gedefinieerd:

| Waarde | Betekenis |
|--------|-----------|
| `data_flow` | Echte bron-naar-doel datatransfer; telt voor lineage-inputs, outputs, sources, targets en depth |
| `context` | Contextuele of technische relatie; kan als bewijs worden getoond maar telt niet als materiele lineage edge |
| `NULL` of lege string | Behandeld als `data_flow` voor backwards-compatibiliteit met historische rijen |

### Implementatiepatroon

Een centrale utility in `src/lib/lineage-hop-kind.ts` is de enige plek die
`hop_kind` interpreteert:

```typescript
export function isDataFlowHop(hop: Pick<LineageHop, "hop_kind">): boolean {
  const kind = normalizeHopKind(hop.hop_kind);
  return kind === "" || kind === "data_flow";
}

export function isContextHop(hop: Pick<LineageHop, "hop_kind">): boolean {
  return normalizeHopKind(hop.hop_kind) === "context";
}
```

Alle views en queries die lineage verwerken importeren uitsluitend deze
functies. Directe string-vergelijkingen op `hop_kind` in componenten of adapters
zijn niet toegestaan.

### Filterscope

De lineage graaf, chain views en kolom views filteren standaard op
`data_flow` hops via `filterDataFlowHops()`. Context hops worden niet meegenomen
in:

- het berekenen van upstream/downstream scope
- het tonen van lineage edges in de graaf
- de bepaling van lineage depth

Context hops kunnen in toekomstige views als informatieve annotatie worden
getoond, maar worden nooit als structurele edge behandeld.

### NULL-behandeling

Historische rijen zonder `hop_kind` hebben de waarde `NULL` of een lege string.
Deze worden behandeld als `data_flow`. Dit garandeert dat bestaande installaties
zonder migratie correct blijven werken na introductie van het veld.

---

## Consequenties

- Nieuwe producers moeten `hop_kind` expliciet zetten bij contextuele relaties.
- Adapters die `hop_kind` lezen normaliseren via `normalizeHopKind()` uit de
  centrale utility; nooit ad-hoc in component code.
- Het MDCF veld `widget_field_values` bevat statische hints voor `hop_kind`
  waarden, zodat de widget builder een dropdown toont bij filterconfiguratie.
- Toekomstige versies kunnen extra hop kinds introduceren (bv. `derived`,
  `aggregated`) zonder aanpassing van de bestaande filterlogica, zolang de
  utility wordt uitgebreid.

---

## Alternatieven overwogen

**Geen onderscheid** — alle edges tellen als data_flow. Verworpen: leidt tot
onjuiste impact-analyse en ruis in lineage grafen.

**Boolean vlag `is_context`** — simpeler maar minder uitbreidbaar dan een
string enum. Verworpen ten gunste van een waardenveld dat toekomstige typen
ondersteunt.

**Filtering in de adapter** — context hops filteren bij de SQL-query.
Verworpen: de API levert alle hops; views bepalen zelf de scope.
