# Microsoft Defender SmartScreen Checklist

**Last Updated:** 2026-05-11  
**Scope:** `latero.nl`, `www.latero.nl`, `control.latero.nl`, `sso.latero.nl`

## Purpose

This checklist helps reduce the chance of Microsoft Defender SmartScreen warnings for Latero domains. SmartScreen decisions are reputation-based and can change over time; this document focuses on concrete controls that improve trust signals and reduce false positives.

## Important Limitation

Passing this checklist does **not** guarantee that SmartScreen will never warn. Microsoft uses URL reputation, behavioral heuristics, malware/phishing reports, and download reputation.

For `*.latero.nl`, SmartScreen reputation is **not** automatically inherited as a wildcard trust state. New subdomains can be evaluated independently.

## Baseline Checklist

### DNS and TLS

- [x] `latero.nl` resolves to the Hetzner production server
- [x] `www.latero.nl` resolves to the production site and redirects to `https://latero.nl`
- [x] `control.latero.nl` resolves to the Hetzner production server
- [x] `sso.latero.nl` resolves to the Hetzner production server
- [x] All public hostnames use valid HTTPS certificates
- [x] TLS renewal is automated through Caddy
- [ ] IPv6 records are intentionally configured or intentionally absent for each public hostname

### Content and Branding

- [x] Public website clearly identifies the Latero brand
- [x] Contact details are visible on the public site
- [x] App login pages are visibly branded as Latero
- [x] Login pages clearly indicate their purpose (`Admin Login`, `Platform admin`, `Operator access`)
- [ ] Legal and trust pages are published and easy to find:
  - Privacy statement
  - Terms / disclaimer if applicable
  - Company / contact details

### Behavioral Safety

- [x] No auto-download behavior on the public website was observed
- [x] No executable or archive download links were observed on the public website homepage
- [x] No suspicious redirect chains were observed for `latero.nl`
- [x] `www.latero.nl` uses a simple canonical redirect to `latero.nl`
- [x] No third-party ad or tracking scripts were observed in the public homepage HTML
- [ ] No publicly exposed test, staging, or abandoned subdomains remain reachable

### Security Headers and Browser Signals

- [x] `latero.nl` serves HSTS
- [x] `latero.nl` serves `X-Content-Type-Options: nosniff`
- [x] `latero.nl` serves `Referrer-Policy: strict-origin-when-cross-origin`
- [x] `control.latero.nl` serves CSP, HSTS, `X-Frame-Options`, and related security headers
- [ ] `latero.nl` serves an explicit Content Security Policy
- [ ] `latero.nl` serves `Permissions-Policy`
- [ ] `latero.nl` serves `Cross-Origin-Opener-Policy` where appropriate

### Downloads and Files

- [x] No `.exe`, `.msi`, `.zip`, or macro-enabled Office downloads were observed on the public site
- [ ] Any future downloadable binaries are code-signed before publication
- [ ] Any future downloadable binaries are reputation-tested in Microsoft Edge / SmartScreen

### Operations and Monitoring

- [x] Public site content is served from a stable production path on Hetzner
- [x] App and SSO services are behind Caddy with valid certificates
- [x] Health checks are configured for production containers
- [ ] Periodic manual check in Microsoft Edge on Windows is part of release validation
- [ ] SmartScreen false-positive response process is documented for operations

## Current Review — 2026-05-11

The following live checks were performed against production:

### Observed Good Signals

- `https://latero.nl` returned `200 OK` with valid HTTPS and HSTS
- `https://www.latero.nl` returned a clean redirect to `https://latero.nl/`
- `https://control.latero.nl` returned a redirect into the authenticated app flow
- `https://sso.latero.nl` returned the expected Keycloak redirect
- The public site showed clear brand identity and visible contact details
- The admin login page for `control.latero.nl` was clearly branded as Latero Control
- No suspicious download links were found in the public homepage HTML
- No third-party tracking or ad scripts were found in the public homepage HTML

### Observed Risks / Gaps

- `latero.nl` currently loads Google Fonts from `fonts.googleapis.com` and `fonts.gstatic.com`
- `latero.nl` does not currently expose an explicit CSP header
- `control.latero.nl/robots.txt` currently falls through to a `404` page instead of serving an explicit robots policy
- SmartScreen reputation for new future subdomains under `*.latero.nl` is not guaranteed by the current setup

## Recommendations

### High Priority

1. Add an explicit `Content-Security-Policy` header for `latero.nl`
   - Keep it simple and compatible with the current site
   - Allow only self-hosted assets plus the exact Google Fonts origins in use

2. Add an explicit `robots.txt` for `control.latero.nl`
   - Recommended content:
     - `User-agent: *`
     - `Disallow: /`

3. Review all public Latero subdomains quarterly
   - Remove stale demos, tests, previews, and old app hosts

### Medium Priority

4. Consider self-hosting the current web fonts for `latero.nl`
   - This reduces third-party dependency signals and simplifies CSP

5. Add `Permissions-Policy` and, where suitable, `Cross-Origin-Opener-Policy` to `latero.nl`

6. Add a simple release check in Edge on Windows for:
   - `latero.nl`
   - `www.latero.nl`
   - `control.latero.nl/admin/login`
   - `sso.latero.nl`

### If You Ever Publish Downloads

7. Code-sign Windows binaries before publication
8. Expect SmartScreen reputation to build over time per file hash
9. Test new downloads in Microsoft Edge on a clean Windows machine

## False Positive Response

If SmartScreen ever flags a Latero URL incorrectly:

1. Verify the page is clean and unchanged
2. Check recent DNS, TLS, redirect, and content changes
3. Remove or disable anything that could resemble phishing or deceptive behavior
4. Submit the affected URL to Microsoft as a false positive
5. Re-test in Microsoft Edge after Microsoft updates reputation

## References

- [Microsoft Defender SmartScreen overview](https://learn.microsoft.com/en-us/windows/security/operating-system-security/virus-and-threat-protection/microsoft-defender-smartscreen/)
- [SmartScreen URL reputation demonstrations](https://learn.microsoft.com/en-us/defender-endpoint/defender-endpoint-demonstration-smartscreen-url-reputation?view=o365-worldwide)
