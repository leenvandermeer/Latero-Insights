# WP10 — Auth UX: Journey Map, Wireframes, Copy Deck en Architectuurspec

**Status:** Completed  
**Owner:** UX + Engineering  
**Date:** 2026-05-03  
**ADR:** LADR-034, LADR-035  
**Vereiste vóór:** WP3 implementatie

---

## 1. Auth Journey Map

### 1.1 Actoren

| Actor | Omschrijving |
|---|---|
| **Tenant user** | Eindgebruiker van een organisatie die via SSO of lokaal inlogt |
| **Break-glass admin** | Lokale admin-account dat altijd lokaal mag inloggen ongeacht policy |
| **Operator** | Persoon die de installatie beheert; configureert auth-policy via admin-UI |

### 1.2 Journey: Tenant user — `sso_only` installatie

```
Gebruiker bezoekt /pipelines
        ↓
InstallationGate detecteert: geen sessie
        ↓
Login-scherm getoond
        ↓
Gebruiker voert e-mailadres in
        ↓
GET /api/auth/policy?hint=<email-domein>
        ↓ auth_mode = sso_only
Lokale wachtwoord-invoer verborgen
"Continue with SSO" CTA zichtbaar
        ↓
Gebruiker klikt "Continue with SSO"
        ↓
POST /api/auth/sso/initiate → redirect naar IdP
        ↓
Gebruiker authenticeert bij IdP
        ↓
IdP redirect naar GET /api/auth/sso/callback
        ↓
Server valideert state/nonce/PKCE/issuer/audience/expiry
        ↓
[Succes] Latero-sessie aangemaakt → redirect naar /pipelines
[Fout]   Redirect naar /login?error=<code> met uitleg
```

### 1.3 Journey: Tenant user — `sso_with_break_glass` installatie

```
Login-scherm getoond
        ↓
Gebruiker voert e-mailadres in
        ↓
GET /api/auth/policy?hint=<email-domein>
        ↓ auth_mode = sso_with_break_glass
Primaire CTA: "Continue with SSO"
Secundaire optie zichtbaar maar subdued: "Use local login"
        ↓
[SSO pad] → zelfde als sso_only hierboven
[Lokaal pad] → wachtwoord-invoer verschijnt → standaard login
```

### 1.4 Journey: Break-glass admin

```
Login-scherm getoond
        ↓
Gebruiker voert e-mailadres in (break-glass account)
        ↓
GET /api/auth/policy?hint=<email-domein>
        ↓ auth_mode = sso_only | sso_with_break_glass
Server herkent is_break_glass = TRUE na wachtwoord-check
        ↓
Wachtwoord-invoer beschikbaar ondanks SSO-policy
Gebruiker logt in met lokale credentials
        ↓
Sessie aangemaakt → redirect naar bestemming
```

*Note: de login-UI toont break-glass accounts hetzelfde als sso_with_break_glass —
de "Use local login" optie is zichtbaar. Het onderscheid zit server-side.*

### 1.5 Journey: Operator — auth-mode wijzigen

```
Operator navigeert naar Admin → Installaties → [installatie] → Auth
        ↓
Huidig auth-mode getoond met uitleg van impact
        ↓
Operator selecteert nieuwe auth-mode
        ↓
Impact-waarschuwing getoond (zie §3 Copy Deck — Admin)
        ↓
Operator bevestigt → PUT /api/admin/installations/[id]/auth-policy
        ↓
Bevestiging getoond met samenvatting van de wijziging
```

---

## 2. Wireframes

### 2.1 Login-scherm — `local_only` (huidig gedrag, geen wijziging)

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│  Sign in with your email and         │
│  password.                           │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✉  you@organisation.com       │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │ 🔒  Your password          👁  │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  🏢  Sign in                  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 2.2 Login-scherm — Stap 1: e-mailinvoer (voor policy-detectie)

Getoond bij eerste load, vóórdat de auth-mode bekend is.

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│  Enter your work email to continue.  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ ✉  you@organisation.com       │  │
│  └────────────────────────────────┘  │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Continue →                   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

*Na "Continue": `GET /api/auth/policy?hint=<domein>` → UI past zich aan.*

### 2.3 Login-scherm — Stap 2a: SSO only

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│  you@organisation.com                │
│  [change]                            │
│                                      │
│  Your organisation uses single       │
│  sign-on (SSO).                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Continue with SSO →          │  │  ← primary, --brand
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 2.4 Login-scherm — Stap 2b: SSO with break-glass / local fallback

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│  you@organisation.com  [change]      │
│                                      │
│  Your organisation uses single       │
│  sign-on (SSO).                      │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Continue with SSO →          │  │  ← primary
│  └────────────────────────────────┘  │
│                                      │
│  ─────────── or ───────────          │
│                                      │
│  ┌────────────────────────────────┐  │
│  │ 🔒  Your password          👁  │  │  ← secondary, subdued
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Sign in with password        │  │  ← ghost button
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 2.5 SSO Callback — verwerking (loading state)

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│                                      │
│         ⟳  Completing sign-in…      │
│                                      │
│  Please wait while we verify your   │
│  identity.                           │
└──────────────────────────────────────┘
```

### 2.6 Auth Error-schermen

**Variante A: callback mislukt (state/nonce/issuer mismatch)**

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│                                      │
│  ⚠  Sign-in failed                  │
│                                      │
│  We couldn't complete your sign-in.  │
│  This may happen if the link         │
│  expired or was used before.         │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Try again                    │  │
│  └────────────────────────────────┘  │
│  Contact your administrator if       │
│  this keeps happening.               │
└──────────────────────────────────────┘
```

**Variante B: unauthorized-after-login (geen toegang tot installatie)**

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│                                      │
│  🔒  Access not granted              │
│                                      │
│  Your identity was verified, but     │
│  you don't have access to this       │
│  organisation yet.                   │
│                                      │
│  Ask your administrator to grant     │
│  you access, then try again.         │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Back to sign-in              │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

**Variante C: local login disabled**

```
┌──────────────────────────────────────┐
│           [Latero logo]              │
│         Latero Control               │
│                                      │
│  ⚠  Password sign-in is disabled    │
│                                      │
│  Your organisation requires sign-in  │
│  through your identity provider.     │
│                                      │
│  ┌────────────────────────────────┐  │
│  │  Continue with SSO →          │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 2.7 Admin — Auth configuration

```
┌─────────────────────────────────────────────────────┐
│  Admin  /  Installations  /  Acme Corp  /  Auth      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Authentication                                     │
│  ─────────────────────────────────────────          │
│  Auth mode          [SSO only            ▾]         │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  ⚠ Changing to "SSO only" will disable      │   │
│  │  password login for all users in this        │   │  ← warning banner
│  │  organisation. Ensure SSO is working         │   │
│  │  before saving.                              │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  SSO Configuration                                  │
│  ─────────────────────────────────────────          │
│  Issuer URL         [https://idp.example.com  ]     │
│  Client ID          [latero-control           ]     │
│  Client secret      [••••••••         [update]]     │
│  Redirect URI       [https://app.example.com/ ]     │
│  Scopes             [openid email profile     ]     │
│                                                     │
│  ┌────────────────────┐  ┌──────────────────────┐  │
│  │  Test connection   │  │  Save                │  │
│  └────────────────────┘  └──────────────────────┘  │
│                                                     │
│  Break-glass                                        │
│  ─────────────────────────────────────────          │
│  Enable break-glass  [ ] Allow designated local     │
│                          admins to bypass SSO        │
└─────────────────────────────────────────────────────┘
```

---

## 3. Copy Deck

### 3.1 Login-scherm — User-facing

| Context | Copy |
|---|---|
| Subtitel — local_only | "Sign in with your email and password." |
| Subtitel — e-mail stap | "Enter your work email to continue." |
| Subtitel — na policy-check, sso_only | "Your organisation uses single sign-on (SSO)." |
| Subtitel — na policy-check, sso_with_break_glass | "Your organisation uses single sign-on (SSO)." |
| CTA — primaire SSO | "Continue with SSO" |
| CTA — lokaal (secundair) | "Sign in with password" |
| CTA — wachtwoord submit | "Sign in" |
| CTA — e-mail continue | "Continue" |
| Laden SSO | "Completing sign-in…" |
| Laden wachtwoord | "Signing in…" |
| E-mail placeholder | "you@organisation.com" |
| Wachtwoord placeholder | "Your password" |
| Terug-link (change email) | "change" |

### 3.2 Auth Error States

| Error code | Heading | Body |
|---|---|---|
| `callback_failed` | "Sign-in failed" | "We couldn't complete your sign-in. This may happen if the link expired or was used before." |
| `state_mismatch` | "Sign-in failed" | "We couldn't complete your sign-in. This may happen if the link expired or was used before." |
| `unauthorized` | "Access not granted" | "Your identity was verified, but you don't have access to this organisation yet. Ask your administrator to grant you access, then try again." |
| `local_disabled` | "Password sign-in is disabled" | "Your organisation requires sign-in through your identity provider." |
| `sso_config_missing` | "SSO is not configured" | "Single sign-on is not fully set up for your organisation. Contact your administrator." |
| `session_expired` | "Your session has expired" | "Please sign in again to continue." |
| `rate_limited` | "Too many attempts" | "Please wait a moment before trying again." |

### 3.3 Admin — Auth Config

| Context | Copy |
|---|---|
| Sectietitel | "Authentication" |
| Label auth-mode | "Auth mode" |
| Label issuer | "Issuer URL" |
| Label client ID | "Client ID" |
| Label client secret | "Client secret" |
| Secret-veld masked | "••••••••" |
| Secret-update knop | "update" |
| Test-knop | "Test connection" |
| Opslaan-knop | "Save" |
| Sectietitel SSO | "SSO Configuration" |
| Sectietitel break-glass | "Break-glass" |
| Break-glass label | "Enable break-glass" |
| Break-glass hulptekst | "Allow designated local admins to bypass SSO. Use only for incident recovery." |

### 3.4 Impact-waarschuwingen (admin, vóór opslaan)

| Wijziging naar | Waarschuwingstekst |
|---|---|
| `sso_only` | "Changing to "SSO only" will disable password login for all users in this organisation. Ensure SSO is working before saving." |
| `local_only` (van SSO) | "Changing to "Local only" will disable SSO login. Users will need a local password to sign in." |
| `sso_with_break_glass` | "Break-glass login is intended for emergency use only. Limit the number of break-glass accounts." |

---

## 4. UX Acceptatiecriteria

- [ ] `sso_only` installaties tonen geen wachtwoord-inputveld en geen wachtwoord-CTA
- [ ] `sso_with_break_glass` installaties tonen de SSO-CTA primair; lokale login is secundair en visueel subdued
- [ ] `local_only` installaties tonen uitsluitend het bestaande e-mail+wachtwoord formulier (geen SSO-elementen)
- [ ] De e-mailinvoer-stap is de eerste stap voor SSO-installaties; wachtwoord-invoer is nooit zichtbaar vóór de policy-check
- [ ] Na policy-check past de UI zich aan zonder volledige pagina-reload
- [ ] "change" link herstelt de e-mailinvoer-stap en herstart de policy-check
- [ ] SSO callback toont een laadstaat; er is geen lege of defecte tussenpagina
- [ ] Alle error-codes hebben een dedicated, begrijpelijke UX-state met handelingsperspectief
- [ ] `unauthorized-after-login` toont een specifieke state (niet de generieke login-fout)
- [ ] Admin-UI toont nooit de plaintext client secret; masking is standaard
- [ ] Admin-UI toont een impact-waarschuwing bij elke auth-mode-wijziging vóórdat opgeslagen wordt
- [ ] Installatienaam/label is zichtbaar op de login-pagina zodra de auth-mode bekend is
- [ ] Alle auth-schermen zijn responsive en functioneel op 375px (mobile) tot 1280px (desktop)
- [ ] Alle tokens zijn uit het design system (`--color-brand`, `--color-error`, etc.) — geen hardcoded kleuren

---

## 5. Architectuurspecificatie — `GET /api/auth/policy`

### 5.1 Doel

Stelt de `InstallationGate` component in staat de auth-mode te kennen vóór
authenticatie, zodat de login-UI adapteert zonder dat de gebruiker al is
ingelogd. Dit is een **unauthenticated** endpoint.

### 5.2 Route

```
GET /api/auth/policy?hint=<email-domein>
```

`hint` is het e-maildomein van de gebruiker (bijv. `acme.com`). De hint wordt
gebruikt om de installatie op te zoeken via de `allowed_domains` lijst in
`installation_sso_config`. Als geen match: fallback naar `local_only`.

### 5.3 Response contract

**200 OK — match gevonden of graceful fallback:**

```json
{
  "auth_mode": "sso_only" | "sso_with_break_glass" | "sso_with_local_fallback" | "local_only",
  "sso_available": true | false,
  "sso_label": "Acme Corp SSO" | null
}
```

| Veld | Omschrijving |
|---|---|
| `auth_mode` | De auth-mode van de installatie die matched op het domein |
| `sso_available` | `true` als `installation_sso_config.enabled = true` voor deze installatie |
| `sso_label` | Optionele installatie-label voor in de UI; `null` als niet geconfigureerd |

**Als geen installatie matcht op het domein:**

```json
{
  "auth_mode": "local_only",
  "sso_available": false,
  "sso_label": null
}
```

*Het endpoint geeft altijd HTTP 200 terug. Geen 404 of 403 — dat zou domeinen enumereerbaar maken.*

### 5.4 Security constraints

- Het endpoint retourneert **nooit**: `client_id`, `issuer`, `client_secret_ref`, `installation_id`, of enige andere interne identifier
- De hint (e-maildomein) wordt **niet** gelogd op request-niveau — alleen bij misbruik-detectie (rate-limit overschrijding)
- Rate limiting: max 20 requests/min per IP (de UI roept dit eenmalig aan na e-mailinvoer)
- Het endpoint is **niet** bruikbaar voor installatie-enumeratie: zowel "geen match" als "match maar local_only" retourneren dezelfde response
- Cross-origin: het endpoint mag alleen worden aangeroepen vanuit de eigen origin (CORS restrictie)

### 5.5 Afstemming met WP3

- WP3 implementeert `/api/auth/sso/initiate` die de daadwerkelijke OIDC redirect start
- De `InstallationGate` roept `/api/auth/policy` aan voor de UI-aanpassing; `/api/auth/sso/initiate` wordt aangeroepen bij de SSO-CTA-klik
- De `installation_id` lookup op basis van het e-maildomein-hint is identiek in beide routes — dit wordt een gedeelde helper in `web/src/lib/auth-policy.ts`
- De `auth_mode` uit `/api/auth/policy` is informatief voor de UI; de server verifieert de policy opnieuw server-side in elke auth-route (defense in depth)

### 5.6 Vereiste bestanden (WP3 implementatie-input)

| Bestand | Inhoud |
|---|---|
| `web/src/app/api/auth/policy/route.ts` | GET handler, domein-hint lookup, response |
| `web/src/lib/auth-policy.ts` | `getAuthPolicyByDomain(domain)`, `getAuthPolicyByInstallation(id)` helpers |
| `web/src/components/navigation/installation-gate.tsx` | Uitgebreid met twee-staps flow (e-mail → policy-check → login-variant) |
