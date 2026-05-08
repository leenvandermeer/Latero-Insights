# Dashboard UX Strategy

## Problem

De huidige `/dashboard`-ervaring maakt het productmodel onvoldoende zichtbaar. In code bestaan er al duidelijke scopes:

- system dashboards
- shared organization widgets
- personal dashboards
- personal widgets

Maar in de UX voelt dit nog te veel als één vlakke gallery met losse widget-mechanics. Daardoor missen gebruikers antwoord op drie basisvragen:

1. Waar begin ik als operator?
2. Wat is van de organisatie en wat is van mij?
3. Welke widgets zijn standaard, gedeeld of persoonlijk?

## Best-practice direction

Voor metadata- en observability-producten hoort de dashboard-home drie dingen tegelijk te doen:

- `Orient`: laat zien welke standaard operationele dashboards de tenant gebruikt
- `Differentiate`: maak ownership en audience expliciet
- `Launch`: geef een snelle route naar persoonlijk werk zonder het organisatie-model te vertroebelen

Daarom gebruiken we op `/dashboard` nu dit model:

- `Organization Dashboards`
  - default operating surfaces
  - bedoeld voor gedeelde workflows
  - mogen als template dienen voor persoonlijke kopieën
- `Personal Workspace`
  - privé dashboards voor rol-specifieke analyse en saved working sets
- `Widget ownership model`
  - `Out-of-the-box`
  - `Organization`
  - `Personal`

## UX decisions

### 1. Dashboard home is no longer "My Dashboards"

De landing heet nu simpelweg `Dashboards` en splitst de pagina in:

- organization dashboards
- personal workspace

Dit sluit beter aan op het echte productmodel en voorkomt dat system dashboards "verstopt" blijven achter losse routes zoals `/pipelines` of `/quality`.

### 2. Organization dashboards are first-class

De organisatie-dashboards worden bovenaan getoond als primaire startpunten. Voor `Vdmeer Consulting` betekent dit de standaard Latero operating views:

- Pipelines
- Data Quality
- BCBS 239

Elke kaart ondersteunt:

- `Open dashboard`
- `Create my copy`

Zo blijft de standaard UX stabiel, terwijl gebruikers wel een veilige route hebben naar personalisatie.

### 3. Widget ownership is explicit

De widget UX volgt nu expliciet drie lagen:

- `Out-of-the-box widgets`
- `Organization widgets`
- `My widgets`

Dit model moet zowel op de dashboard-home als in de widget library herkenbaar zijn.

### 4. Personal dashboards are framed as workspaces

Persoonlijke dashboards worden niet meer gepresenteerd als de enige dashboardsoort, maar als privé werkruimtes voor:

- investigations
- temporary monitoring boards
- role-specific slices
- experiments

## Implementation notes

Code changes in this iteration:

- `/dashboard` landing rewritten around organization vs personal scope
- widget counts surfaced for built-in, organization, and personal layers
- organization dashboards support `Create my copy`
- widget library wording updated to clarify ownership model

## Next recommended step

De volgende UX-slag zou moeten zijn:

- in de widget library ook visueel secties introduceren voor `Out-of-the-box widgets`
- organization widgets verrijken met publisher/usage context
- persoonlijke dashboards voorzien van optional tags zoals `Private`, `Draft`, `Shared later`
