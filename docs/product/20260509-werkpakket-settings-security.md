# Werkpakket: Settings security hardening

**Datum:** 2026-05-09  
**Prioriteit:** Medium (geen acuut risico bij goede filesysteem-beveiliging)  
**Context:** Voortgekomen uit code review van `src/lib/settings.ts` en `src/app/api/settings/route.ts`

---

## 1. Databricks token encryptie activeren

**Probleem:** De Databricks token staat momenteel in plaintext in `.cache/settings.json`. De code ondersteunt AES-256-GCM encryptie, maar alleen als `INSIGHTS_ENCRYPTION_KEY` geconfigureerd is — dat is nu niet het geval.

**Stappen:**
1. Genereer een 32-byte key als 64 hex-chars:
   ```bash
   openssl rand -hex 32
   ```
2. Stel in als environment variable (`.env.local` of deployment config):
   ```
   INSIGHTS_ENCRYPTION_KEY=<output van stap 1>
   ```
3. Herstart de server en sla de settings opnieuw op via `/settings` — de code versleutelt de token automatisch bij de volgende `PUT`.
4. Verifieer dat `settings.json` nu `enc:v1:...` bevat in plaats van de plaintext token.

**Let op:** Als de key verloren gaat, moeten alle tokens opnieuw ingevoerd worden. Bewaar de key in een wachtwoordmanager of secrets store.

---

## 2. Global write side-effect in `saveSettings` verwijderen

**Probleem:** `saveSettings(settings, installationId)` schrijft de settings zowel scoped (correct) als naar de root van `settings.json` (ongewenst). Dit was de directe oorzaak van de `cacheOnly`-bug van 2026-05-09 en maakt de globale root onbetrouwbaar.

**Locatie:** [web/src/lib/settings.ts](../web/src/lib/settings.ts) — `saveSettings`, regel ~177

**Aanpak:**
- Verwijder de `...encoded` spread naar de root bij scoped saves
- Routes zonder sessie (bijv. `/api/health`) mogen dan enkel de DEFAULTS + env-vars gebruiken als er geen session is — dat is het veiligste gedrag
- Controleer alle callers van `loadSettings()` zonder `installationId` en geef ze een expliciete fallback

**Reden voor aparte taak:** Vereist testen van alle no-session routes (`/api/health`, `/api/v1/health`, auto-sync triggers). Niet doen samen met de encryptie-stap.

---

## 3. Key rotation ondersteuning (nice-to-have)

**Probleem:** Als `INSIGHTS_ENCRYPTION_KEY` verandert, worden bestaande versleutelde tokens onleesbaar (`decryptToken` returnt `""`). Er is geen migratiepad.

**Aanpak (optioneel, bij echte SaaS deployment):**
- Voeg `INSIGHTS_ENCRYPTION_KEY_OLD` toe als fallback voor decryptie
- Bij succesvolle decrypt met de old key: herversleutel direct met de nieuwe key en schrijf terug
- Of: voeg een CLI-commando toe `npm run rotate-key` dat alle tokens in `settings.json` herversleutelt

---

## Niet in scope

- Overstap naar een externe secrets store (Vault, AWS Secrets Manager) — dat is een architectuurkeuze buiten de single-tenant opzet van dit product
