# LADR-036 — TOTP 2FA voor lokale accounts

**Datum:** 2026-05-03  
**Status:** ACCEPTED  
**Auteur:** Tech Lead  

---

## Context

Latero Control ondersteunt twee authenticatiemodellen: SSO (via een externe IdP zoals Keycloak) en
lokale email/wachtwoord login. SSO-gebruikers vallen onder het 2FA-beleid van hun IdP. Lokale
accounts (break-glass accounts, admin@latero.local) hadden nog geen second factor.

LINS-023 stelt dat break-glass accounts aanvullende verificatie moeten vereisen voordat een sessie
wordt aangemaakt. De `two_factor_enabled` kolom bestond al in `insights_users` maar was functioneel
niet actief (`two_factor_required: false` hardcoded).

## Beslissing

We implementeren TOTP (RFC 6238) als second factor voor lokale accounts. SSO-gebruikers zijn
expliciet uitgesloten — hun IdP beheert de 2FA policy.

### Technische keuzes

| Onderdeel | Keuze | Reden |
|-----------|-------|-------|
| TOTP implementatie | Native Node.js `crypto` (HMAC-SHA1, Base32) | Geen externe dependency; RFC 6238 is eenvoudig te implementeren met ~50 regels |
| QR code | `qrcode` npm package (server-side) | Genereert data URL in API route, geen client-side secrets |
| Secret opslag | AES-256-GCM encrypted in `totp_secret_enc` column | Zelfde patroon als `INSIGHTS_ENCRYPTION_KEY` in settings.ts |
| Backup codes | 5 single-use codes, SHA-256 hashed in `insights_totp_backup_codes` | Geen bcrypt dependency nodig voor hoge-entropie random codes |
| Pending 2FA state | HMAC-SHA256 gesigneerde cookie `insights_pending_2fa` (5 min TTL) | Zelfde patroon als OIDC state cookie, stateless, httpOnly |

### Login flow

```
Stap 1: e-mail invoer → policy check
Stap 2: wachtwoord invoer
  → verificatie OK + two_factor_enabled = FALSE → sessie aanmaken (huidig gedrag)
  → verificatie OK + two_factor_enabled = TRUE  → pending_2fa cookie + { pending_2fa: true }
Stap 3 (nieuw): TOTP-code invoer
  → POST /api/auth/2fa/verify → sessie aanmaken + pending cookie verwijderen
```

### TOTP setup flow

De gebruiker kan TOTP activeren via `GET /api/auth/totp/setup` (vereist een actieve sessie).
De API retourneert een `otpauth://` URI en een QR code als data URL. Na invoer van de eerste geldige
code confirmeert `POST /api/auth/totp/confirm` de setup en genereert backup codes.

### Admin reset

Een admin kan 2FA resetten voor een gebruiker via
`POST /api/v1/admin/users/[user_id]/reset-2fa`. Dit verwijdert het TOTP secret en alle backup codes
en zet `two_factor_enabled = FALSE`.

## Consequenties

- `TOTP_ENCRYPTION_KEY` env var vereist (64 hex chars = 32 bytes AES-256). Zonder deze key is TOTP
  setup geblokkeerd maar werkt het product voor accounts zonder 2FA ongewijzigd.
- Backup codes zijn SHA-256 gehashed. Aanvallers met database-toegang kunnen ze niet achterhalen
  zonder brute force — de codes hebben 72-bits entropie (12 random alphanumeric chars).
- De `two_factor_required: false` hardcode in session/route.ts en login/route.ts wordt vervangen door
  dynamische logica.
- SSO-gebruikers worden nooit naar de TOTP stap gestuurd — de pending cookie wordt alleen gezet na
  succesvolle lokale wachtwoord verificatie.
- Nieuwe SQL objecten: kolom `totp_secret_enc` op `insights_users`, tabel
  `insights_totp_backup_codes`. Aangemaakt via `ensureAuthSchema()` (idempotent ALTER/CREATE).

## Gerelateerde requirements

- LINS-023: Break-glass accounts vereisen extra verificatie
- LINS-025: Lokale accounts, wachtwoord lifecycle

## Gerelateerde ADRs

- LADR-034: SSO-first hybrid authentication (SSO-gebruikers buiten scope van deze wijziging)
- LADR-025: Insights SaaS ingest backend (Postgres bootstrap)
