# SSO Forbidden Patterns

**Owner:** Security + Engineering  
**Status:** Active — normatief voor alle SSO/auth implementatie  
**Versie:** 1.0 (2026-05-03)  
**ADR:** LADR-034

Dit document bevat patronen die **expliciet verboden** zijn in de Latero Control
SSO/auth implementatie. Elk patroon bevat de rationale en een correct alternatief.

---

## FP-001 — OIDC tokens opslaan in browser storage

**Verboden:**
```typescript
// ❌ NOOIT
localStorage.setItem("oidc_access_token", token);
sessionStorage.setItem("id_token", idToken);
document.cookie = `access_token=${token}`;
```

**Rationale:** Browser-toegankelijke opslag is kwetsbaar voor XSS. Een aanvaller
die JavaScript kan uitvoeren, kan het token stelen en als de gebruiker impersonaten.

**Correct alternatief:**  
OIDC callback is volledig server-side. De browser ontvangt uitsluitend een
Latero `HttpOnly` sessiecookie. IdP tokens worden niet opgeslagen.

---

## FP-002 — E-mail als primaire identity-linking key

**Verboden:**
```typescript
// ❌ NOOIT
const user = await db.query(
  "SELECT * FROM insights_users WHERE email = $1",
  [idToken.email]
);
```

**Rationale:** E-mailadressen kunnen worden hergebruikt, gewijzigd, of aanwezig
zijn bij meerdere IdP's. Identity linking op basis van e-mail maakt
account-takeover mogelijk via een tweede IdP met hetzelfde e-mailadres.

**Correct alternatief:**
```typescript
// ✅ Altijd (issuer, subject) als primaire key
const identity = await db.query(
  "SELECT * FROM external_identities WHERE issuer = $1 AND subject = $2",
  [idToken.iss, idToken.sub]
);
```

---

## FP-003 — installation_id accepteren als user input in auth-context

**Verboden:**
```typescript
// ❌ NOOIT
const installationId = req.body.installation_id;
const policy = await getAuthPolicy(installationId);
```

**Rationale:** Een aanvaller kan een willekeurige `installation_id` injecteren
om de auth-policy van een andere installatie te lezen of te omzeilen.

**Correct alternatief:**
```typescript
// ✅ Altijd uit server-side sessie
const session = await requireSession(request);
const policy = await getAuthPolicy(session.active_installation_id);
```

---

## FP-004 — OIDC state of nonce alleen client-side bewaren

**Verboden:**
```typescript
// ❌ NOOIT (state alleen in de redirect URL opnemen zonder server-side opslag)
const state = randomBytes(16).toString("hex");
return redirect(`${authUrl}?state=${state}`); // zonder opslag
```

**Rationale:** Zonder server-side validatie kan een aanvaller een willekeurige
state injecteren en de callback laten slagen (CSRF op de OIDC-flow).

**Correct alternatief:**  
State en nonce worden server-side opgeslagen (signed HttpOnly cookie of
DB-tabel met TTL) voordat de redirect plaatsvindt. Op callback wordt de
server-side waarde vergeleken.

---

## FP-005 — OIDC client secret in settings.json of codebase

**Verboden:**
```json
// ❌ NOOIT in .cache/settings.json
{
  "oidcClientSecret": "secret-value-here"
}
```

```typescript
// ❌ NOOIT hardcoded
const clientSecret = "my-oidc-secret";
```

**Rationale:** `.cache/settings.json` is een door de app beheerd bestand dat in
logs, backups, of debug-output kan belanden. Hardcoded secrets lekken via
versiebeheer.

**Correct alternatief:**
```typescript
// ✅ Altijd via environment variabele of secrets mount
const clientSecret = process.env.OIDC_CLIENT_SECRET;
if (!clientSecret) throw new Error("OIDC_CLIENT_SECRET is not set");
```

---

## FP-006 — Admin-escalatie via IdP-claims

**Verboden:**
```typescript
// ❌ NOOIT
if (idToken.groups?.includes("admins")) {
  await grantAdminRole(userId);
}
```

**Rationale:** IdP-groups zijn onder controle van de tenant-admin, niet van de
Latero Control operator. Een kwaadaardige of gecompromitteerde tenant kan anders
admin-toegang claimen.

**Correct alternatief:**  
Admin-status is uitsluitend een interne Latero-markering (`is_admin` op
`insights_users`). De Latero admin-rol kan niet worden verkregen via externe
claims. Aparte, expliciete admin-provisioning is verplicht.

---

## FP-007 — Lokale login toestaan zonder policy-check

**Verboden:**
```typescript
// ❌ NOOIT (direct verifiëren zonder policy te checken)
const user = await verifyUserPassword(email, password);
if (user) return createSession(user.user_id, ...);
```

**Rationale:** Installaties met `sso_only` of `sso_with_break_glass` policy
mogen geen standaard lokale login accepteren.

**Correct alternatief:**
```typescript
// ✅ Policy altijd als eerste stap
const policy = await getAuthPolicy(installationId);
if (policy.auth_mode === "sso_only") {
  return NextResponse.json({ error: "Local login is disabled" }, { status: 403 });
}
const user = await verifyUserPassword(email, password);
```

---

## FP-008 — Tokens of claim payloads loggen

**Verboden:**
```typescript
// ❌ NOOIT
console.log("ID token:", idToken);
logger.info({ claims: idTokenClaims }, "auth success");
```

**Rationale:** Tokens en volledige claim payloads bevatten PII en kunnen
gevoelige attributen bevatten (groepen, rechten, interne identifiers van de IdP).
Loggen hiervan maakt auditlogs een potentieel datalekkkanaal.

**Correct alternatief:**
```typescript
// ✅ Alleen minimale, niet-gevoelige context loggen
logger.info({
  user_id: user.user_id,
  installation_id: installationId,
  auth_method: "oidc",
  issuer: idToken.iss,
}, "SSO login success");
```

---

## FP-009 — Keycloak (dev-IdP) in productie-image

**Verboden:**  
Keycloak of enige andere ingebundelde IdP opnemen in `docker-compose.prod.yml`
of in het productie-image.

**Rationale:** De lokale Keycloak-setup is uitsluitend bedoeld voor dev/test
(LADR-035). Productie-installaties beheren hun eigen IdP buiten de app-container.

**Correct alternatief:**  
Keycloak staat alleen in `infra/docker/docker-compose.sso.yml`. De productie
Compose-file bevat uitsluitend: app-container, Postgres, Caddy.

---

## FP-010 — PKCE weglaten bij OIDC flow

**Verboden:**
```typescript
// ❌ NOOIT Authorization Code Flow zonder PKCE
const authUrl = buildAuthUrl({ client_id, redirect_uri, state, nonce });
// zonder code_challenge / code_verifier
```

**Rationale:** Zonder PKCE is de Authorization Code Flow kwetsbaar voor
authorization code interception attacks, met name in omgevingen waar de
redirect URI niet volledig onder controle is.

**Correct alternatief:**  
Altijd `code_challenge_method=S256` meesturen. `code_verifier` wordt
server-side bewaard en meegestuurd bij de token-request.
