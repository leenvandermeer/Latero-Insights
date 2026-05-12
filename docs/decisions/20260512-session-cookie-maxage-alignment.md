# LADR-078 — Session cookie maxAge: browser-TTL uitgelijnd met server-TTL

**Datum:** 2026-05-12
**Status:** ACCEPTED
**Auteur:** Leen van der Meer

## Context

De `insights_session`-cookie werd ingesteld zonder `maxAge` of `expires`-attribuut,
waardoor het een "session cookie" werd. Op desktop-browsers verdwijnt een session cookie
bij het sluiten van het browservenster. Op mobiele browsers (iOS Safari, mobiel Chrome)
blijft een session cookie bestaan zolang de browser-app in de achtergrond draait — in
de praktijk tot meerdere dagen.

De server-side TTL (`INSIGHTS_SESSION_TTL_HOURS`, default 8 uur) beschermde correct tegen
langlevende sessies, maar pas nadat een request binnenkwam. Een gebruiker met een 48 uur
oude cookie op mobiel werd niet automatisch uitgelogd.

## Beslissing

`attachSessionCookie` in `lib/session-auth.ts` wordt uitgebreid met `maxAge`:

```typescript
maxAge: Math.floor(SESSION_TTL_MS / 1000),
```

`SESSION_TTL_MS` is afgeleid van `INSIGHTS_SESSION_TTL_HOURS` (env var, default 8 uur).
Browser en server hanteren nu dezelfde deadline.

## Afwegingen

| | Vóór | Na |
|---|---|---|
| Desktop | Cookie verdwijnt bij browsersluit | Cookie vervalt na TTL-uren |
| Mobiel | Cookie leeft onbeperkt in achtergrond | Cookie vervalt na TTL-uren |
| Server-side check | Aanwezig (`expires_at > NOW()`) | Aanwezig (ongewijzigd) |

De `maxAge`-aanpak heeft de voorkeur boven een rolling-TTL (waarbij `expires_at` bij
elk request wordt verlengd) omdat een vaste looptijd eenvoudiger te redeneren is voor
een data-operations tool en geen extra schrijfoperaties vereist per request.

## Gevolgen

- Bestaande sessies verlopen op het oorspronkelijke `expires_at`-moment in de database;
  de nieuwe `maxAge` geldt pas voor sessies die ná deze deployment worden aangemaakt.
- Operatoren kunnen de sessieduur aanpassen via `INSIGHTS_SESSION_TTL_HOURS` in `.env.prod`.
