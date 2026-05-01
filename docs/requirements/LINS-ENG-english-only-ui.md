# LINS-ENG — English-Only UI Requirement

## Requirement

All user-facing text in the Latero Control web application MUST be in English. This includes:
- Button labels
- Form field labels
- Modal and dialog text
- Notifications and error messages
- Table headers and footers
- All static and dynamic UI content

## Rationale
- Consistency for international users and support teams
- Alignment with documentation and technical specifications
- Avoidance of mixed-language UX and translation issues

## Scope
- Applies to all React components, pages, and shared UI elements
- Applies to all new features and refactors
- Existing Dutch or non-English text MUST be replaced with English

## Enforcement
- PRs introducing or retaining non-English UI text will be rejected
- Automated linting or review may be added

---

**Status:** CURRENT
**Owner:** Tech Lead
**ID:** LINS-ENG
