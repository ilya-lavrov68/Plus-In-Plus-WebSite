# Security policy

## Supported code

Security fixes are assessed on the repository's active `main` branch. A deployed fork or older release may need a separate backport and must be identified when reporting an issue.

## Report a vulnerability

Do not open a public issue for a suspected vulnerability, credential leak, personal-data exposure or exploitable proof of concept.

Use GitHub's private vulnerability reporting for this repository when that feature is available to you. Otherwise, use the maintainers' established private contact channel and request a secure way to share details. Do not include real passwords, session tokens, payment credentials, unredacted personal data or production database dumps in an initial report.

Include where possible:

- affected commit/deployment and route/component;
- impact and required privileges;
- minimal reproduction using test accounts/data only;
- suggested mitigation if known;
- whether safe coordinated disclosure timing is needed.

Do not perform destructive testing, access other users' data, interrupt service, run high-volume automated tests against production or exfiltrate data to prove impact. Stop at the minimum evidence needed and report it privately.

A response SLA, bug bounty and safe-harbor program are **not currently promised**. They require an explicitly approved disclosure program and triage ownership.

## Security checks for contributors

Run before submitting security-relevant changes:

```bash
npm ci
npm run security:audit
npm run security:dependencies
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Never disable the nonce CSP or other security headers to make a payload work, never commit `.env` files or credentials, never log passwords/tokens/unnecessary personal data, and do not suppress npm audit findings. Dependency upgrades must preserve authorization, payment, CMS and upload regression tests.

## Operational documents

- [Security assessment and remediation plan](docs/security/README.md)
- [Incident response](docs/security/incident-response.md)
- [GDPR/privacy checklist](docs/security/gdpr.md)
- [Backup and disaster recovery](docs/security/disaster-recovery.md)

These documents distinguish code controls from controls that still require production infrastructure, named owners, external testing or legal approval.
