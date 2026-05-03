# SSO Security Implementation Checklist

**Owner:** Security + Engineering  
**Status:** Active — use for every WP implementation review  
**Versie:** 1.0 (2026-05-03)  
**ADR:** LADR-034

Dit document is de normative implementatie-review checklist voor alle SSO- en
auth-gerelateerde code. Elke werkpakket-PR moet aantoonbaar aan deze criteria
voldoen voordat merge is toegestaan.

---

## 1. Session hardening

- [ ] Sessiecookie is `HttpOnly` — niet leesbaar via JavaScript
- [ ] Sessiecookie is `Secure` in productie (automatisch via `shouldUseSecureCookie()`)
- [ ] Sessiecookie heeft `SameSite=Lax` of `Strict`
- [ ] Sessie-tokens worden opgeslagen als SHA-256 hash in Postgres (`token_hash`), nooit als plaintext
- [ ] Sessiestatus wordt server-side gevalideerd bij elk verzoek via `requireSession()`
- [ ] Verlopen sessies (`expires_at < NOW()`) worden geweigerd
- [ ] Ingetrokken sessies (`revoked_at IS NOT NULL`) worden geweigerd
- [ ] Logout revokes de sessie server-side én wist de cookie

## 2. OIDC flow integriteit (WP3)

- [ ] `state` parameter is aanwezig, random, en wordt server-side gevalideerd op callback
- [ ] `nonce` parameter is aanwezig, random, en wordt gevalideerd in de ID token claim
- [ ] `PKCE (S256)` is verplicht — geen Authorization Code Flow zonder PKCE
- [ ] Gebruikte nonce is na callback onmiddellijk ongeldig (single-use)
- [ ] State/nonce verlopen na maximaal **10 minuten** TTL
- [ ] State en nonce worden server-side opgeslagen (signed HttpOnly cookie of DB-tabel), nooit alleen client-side
- [ ] Issuer wordt gevalideerd tegen geconfigureerde `OIDC_ISSUER`
- [ ] Audience (`aud`) wordt gevalideerd
- [ ] Token expiry (`exp`) wordt gevalideerd
- [ ] JWKS endpoint wordt gebruikt voor handtekening-validatie; geen hardcoded public keys
- [ ] Browser ontvangt **nooit** het OIDC access token of refresh token
- [ ] IdP tokens worden **niet** opgeslagen in de applicatiedatabase

## 3. Rate limiting op auth-endpoints

**Norm: ≤ 5 pogingen per minuut per IP voor alle credential-verwerkende endpoints.**

- [ ] `POST /api/auth/login` — max 5/min per IP
- [ ] `POST /api/auth/sso/callback` — max 5/min per IP
- [ ] `POST /api/auth/password-reset` — max 5/min per IP
- [ ] `POST /api/auth/password-reset/confirm` — max 5/min per IP
- [ ] Overige auth-endpoints (session, switch) — max 30/min per IP is acceptabel
- [ ] Rate-limit overschrijding retourneert HTTP **429**
- [ ] Rate-limit identifiers bevatten **nooit** gevoelige data (alleen IP-afgeleide hash)

## 4. CSRF-bescherming op muterende sessie-endpoints

- [ ] `POST /api/auth/logout` heeft CSRF-bescherming (synchronizer token of origin-check)
- [ ] `POST /api/auth/switch-installation` heeft CSRF-bescherming
- [ ] Toekomstige auth-config mutatieEndpoints krijgen CSRF-bescherming vóór productie
- [ ] CSRF-check faalt met HTTP **403** bij mismatch

## 5. Secrets handling

- [ ] `OIDC_CLIENT_SECRET` staat **niet** in `.cache/settings.json`
- [ ] `OIDC_CLIENT_SECRET` staat **niet** hardcoded in de codebase
- [ ] Secrets worden geladen via `process.env.*` of Docker secrets mount
- [ ] Secrets worden **niet** geretourneerd aan de browser (ook niet via admin-API)
- [ ] Admin-API retourneert masked waarde (`****`) voor secret-velden
- [ ] `.env.example` bevat placeholder-waarden, nooit echte secrets

## 6. Tenant isolatie in auth-context

- [ ] Auth-policy lookup gebruikt `installation_id` uit server-side sessie, nooit uit user input
- [ ] SSO-configuratie lookup is scoped op `installation_id`
- [ ] Identity linking gebruikt `(issuer, subject)` als primaire key — email alleen is niet voldoende
- [ ] Provisioning is deny-by-default — geen toegang zonder expliciete installatie-policy
- [ ] Admin-escalatie is niet mogelijk via externe IdP-claims

## 7. Audit logging

- [ ] Login success wordt gelogd met `user_id`, `installation_id`, `auth_method`, timestamp
- [ ] Login failure wordt gelogd met `email_hint` (geen volledig e-mailadres), `reason`, timestamp
- [ ] OIDC callback failure wordt gelogd met `failure_reason` (geen token-inhoud)
- [ ] Logout wordt gelogd
- [ ] Tenant-switch wordt gelogd
- [ ] Auth-config wijziging wordt gelogd met `admin_user_id`, `installation_id`, `changed_fields`
- [ ] Logs bevatten **nooit**: raw access tokens, refresh tokens, volledige claim payloads, wachtwoorden
- [ ] Logs bevatten **nooit** PII buiten wat strikt noodzakelijk is voor forensisch gebruik

## 8. Regressie (WP9 gate)

- [ ] `local_only` installaties doorlopen de volledige auth-pijplijn als regressietest
- [ ] `sso_only` installaties blokkeren lokale login aantoonbaar
- [ ] State mismatch, nonce mismatch en verkeerde issuer falen aantoonbaar
- [ ] Cross-tenant access via auth-bugs faalt aantoonbaar
- [ ] CSRF-aanval op logout faalt aantoonbaar
- [ ] Rate-limit (>5/min login) retourneert HTTP 429 aantoonbaar

## 9. TOTP / lokale MFA (lokale accounts)

**Geïmplementeerd: 2026-05-03 — zie LADR-036**

- [x] TOTP 2FA beschikbaar voor lokale accounts (`two_factor_enabled` op `insights_users`)
- [x] TOTP secret wordt versleuteld opgeslagen (AES-256-GCM, sleutel via `TOTP_ENCRYPTION_KEY`)
- [x] Pending 2FA cookie (`insights_pending_2fa`) is HMAC-gesigned, 5 minuten TTL
- [x] Backup codes zijn gehashed (SHA-256), single-use, op te vragen na setup
- [x] Login-flow splitst na wachtwoordcheck: sessie direct (geen 2FA) of pending-cookie + TOTP-stap
- [x] Eigen 2FA uitschakelen vereist een geldig TOTP-token of backup code
- [x] Admin reset van gebruiker-TOTP vereist `is_break_glass` — niet `is_admin`
- [x] Break-glass accounts zijn expliciet gemarkeerd (`is_break_glass` kolom); scheiding van tenant-admin (`is_admin`)
- [x] TOTP audit event `2fa_verify` toegevoegd aan `AuditEventType`
- [x] TOTP self-enrollment UI beschikbaar voor gebruikers — `/account` pagina in `(dashboard)` groep, toegankelijk voor alle ingelogde gebruikers; sidebar-link toegevoegd
- [x] TOTP setup en verify vallen onder rate-limiting norm (≤5/min per IP) — rate limit toegevoegd op `POST /api/account/2fa/setup/initiate`, `POST /api/account/2fa/setup/confirm` en `DELETE /api/account/2fa`
