# Plus In Plus security assessment and remediation plan

Assessment date: 2026-10-25. Baseline reviewed: `f31c4d7a2654655921b2b959bae30aa10909b1a1`; the hardening delta is the branch containing this document.

This is a source-and-test assessment, not a certification, external penetration test, infrastructure audit, legal opinion or production security rating. No external “skills” collection or certification is claimed. No configured non-production database, production host, cloud account, TLS endpoint, SIEM or backup vault was available for verification.

## 1. Executive result

The repository already had meaningful defenses: server-side RBAC and ownership checks, Auth.js credential handling, bcrypt, timing-safe unknown-account behavior, JWT revocation after password changes, bounded/shared rate limiting, Zod validation, parameterized Prisma queries, HTML sanitization, image re-encoding, SSRF checks, nonce CSP and transactional activity records.

This hardening change adds:

- **Passwords:** 12+ characters, maximum 72 UTF-8 bytes for bcrypt, at least three of four character classes, a small offline common-password denylist, and Have I Been Pwned range checks for registration and password changes. Only the first five SHA-1 characters are sent to HIBP; passwords and complete hashes are not sent. Production fails closed on HIBP unavailability by default. `PIP_HIBP_REQUIRED=0` is an explicit availability exception, and `PIP_HIBP_CHECK=0` disables the integration only as an explicit configuration decision.
- **Login throttling:** five attempts per IP/account pair and ten per IP in a 15-minute fixed window, with a bounded progressive delay of 250 ms–2 s before the hard block. The existing optional atomic Upstash backend and bounded local fallback remain.
- **Transport/browser headers:** production HSTS `max-age=31536000; includeSubDomains`, without `preload`; `X-XSS-Protection: 0` to disable the unsafe legacy auditor. Existing nonce CSP, `frame-ancestors 'none'`, `nosniff`, referrer and permissions policies are preserved. Production now ignores `PIP_CSP=off` instead of allowing CSP to be disabled.
- **API request boundaries:** strict `application/json` handling and actual streamed byte limits, not just `Content-Length`, for the reviewed JSON write endpoints. Invalid media type, oversized body and malformed JSON produce 415, 413 and 400 respectively. Existing schema and ownership checks remain authoritative.
- **Rate-limit semantics:** API 429 responses now include the limiter-derived `Retry-After` value in the updated handlers.
- **Audit/log hygiene:** successful customer/staff login and logout activity records; structured failed-login/rate-limit events with fixed fields; no email in new user-audit titles; sanitized auth/admin error logging that retains only an allowlisted provider error code, not provider messages or stack data.
- **Supply-chain gates:** `npm run security:audit` performs focused high-confidence repository policy checks, and `npm run security:dependencies` runs the full npm vulnerability audit. Both are CI gates.

No database schema was changed. Customer login, separate staff-mode login, manager scope, CMS ownership, uploads, payments behavior and existing UI behavior were preserved.

## 2. Verification results

| Check | Result | Meaning / limitation |
| --- | --- | --- |
| Clean baseline tests | 331/331 passed before edits | Establishes that the starting branch was healthy after restoring local dependencies with `npm ci`. |
| `npm audit --omit=dev --json` | 0 critical, high, moderate, low; 246 production dependencies | Point-in-time registry audit, not proof that every package is supported or vulnerability-free forever. |
| Full `npm audit --json` | 0 critical, high, moderate, low; 722 total dependencies reported by npm | Includes development dependencies. CI runs the full audit and fails on reported vulnerabilities. |
| `npm run security:audit` | Passed: 310 source/test/workflow files, no high-confidence findings | Detects selected high-confidence secret/token patterns, tracked env files, wildcard CORS, unreviewed HTML/raw-SQL sinks and dynamic runtime execution. It is not a full SAST or secret-scanning guarantee. |
| Full regression suite after hardening | **342/342 passed** | Covers password policy/HIBP protocol, streamed body caps, headers, throttling, PII-free logs and existing authorization behavior. |
| TypeScript, ESLint and production build | Passed; ESLint reported no warnings/errors | Build retained existing dependency/Edge and unset-database notices; no build failure. |
| Local production HTTP smoke | `/` 200; protected page 307; unique nonces; HSTS/security headers present; no wildcard CORS | Production ignored `PIP_CSP=off` as intended. `/api/health` returned the expected 503 because no validation database was configured; database health was not claimed as successful. |
| External Security Headers / SSL Labs scans | **Not run** | A/A+ cannot be claimed. A real HTTPS deployment and external scanner are required. |
| Live HIBP integration | **Not called from tests** | Protocol behavior is tested with mocked responses; production connectivity and outage behavior must be smoke-tested without using a real user's password. |
| Upstash shared limiter | Atomic Lua behavior unit-tested with a mocked REST response | No live Upstash credentials were available. Local fallback is not a distributed limit. |
| Database/cloud encryption, IAM, firewall and container configuration | **Not verified** | Requires infrastructure access and provider evidence. |
| External penetration test | **Not performed** | Source review and unit tests do not replace independent testing. |
| Backup restoration | **Not performed** | The DR runbook is a template, not evidence of recoverability. |

`npm ci` also reported deprecated transitive/tooling packages (including ESLint 8 and older glob/rimraf-related tooling). Deprecation is not the same as a known vulnerability, but the tooling upgrade remains in the plan. The Prisma 6 support window must be reviewed before 2026-11-19; plan a tested Prisma 7 migration rather than an unreviewed jump across breaking releases.

## 3. OWASP Top 10 mapping

Status **partial** means useful controls exist but production or independent assurance is still required.

| OWASP category | Repository evidence | Remaining risk |
| --- | --- | --- |
| A01 Broken Access Control | Server-derived roles; effective DB/token role checks; founder protections; manager customer/order scope; owned cart/order operations; authenticated account-linked support; authorization regression tests. Partial. | No external horizontal/vertical authorization test. Permission-denied events are not comprehensively centralized. |
| A02 Cryptographic Failures | bcrypt cost 12; no plaintext password storage in application code; HSTS and secure Auth.js cookie behavior when production HTTPS is configured. Partial. | TLS/cipher configuration, certificate automation, Turso/storage/backups encryption and key rotation are not verified. Payment credentials can be stored in `site_settings`; a secret-manager migration is still needed. |
| A03 Injection | Prisma parameter binding; reviewed analytics raw SQL binds values; Zod; sanitized rich text/Markdown; no runtime `child_process`; request size/type checks. Partial. | Independent SQL/NoSQL/command/template injection testing remains. SSRF DNS-resolution pinning should be strengthened as noted under A10. |
| A04 Insecure Design | Deny-by-default role assignments, server-authoritative prices/CMS, ownership checks, audit records, abuse limits and documented IR/GDPR/DR templates. Partial. | MFA, short access/refresh session architecture, concurrent-session controls, threat-model reviews and approved RTO/RPO are incomplete. |
| A05 Security Misconfiguration | Nonce CSP, anti-framing, MIME/referrer/permissions headers, production HSTS, disabled legacy XSS auditor, powered-by disabled, CI header tests. Partial. | Proxy HTTPS redirect, forwarded-header overwrite, global CDN/WAF limits, TLS and host/container hardening require deployment verification. HSTS `includeSubDomains` requires an all-subdomain HTTPS review before production enablement. |
| A06 Vulnerable and Outdated Components | Exact lockfile, `npm ci`, full npm audit in CI, zero current audit findings. Partial. | Continuous advisory monitoring, supported-version upgrades, SBOM and action/dependency provenance need work. Zero audit findings is not a guarantee. |
| A07 Identification and Authentication Failures | Stronger password policy and HIBP, dummy bcrypt comparison, blocked accounts, password-change revocation, layered limits/delay, generic credential errors. Partial. | No TOTP/WebAuthn/backup codes, risk-based CAPTCHA, device binding, 15-minute access tokens, rotating refresh tokens or three-session limit. |
| A08 Software and Data Integrity Failures | Lockfile and CI, schema/build checks, transactional audit records, payment signature and amount/order/state validation. Partial. | GitHub Actions are version-tag pinned rather than commit-SHA pinned; no SBOM, artifact signing/provenance or independent integrity assessment. |
| A09 Security Logging and Monitoring Failures | Activity records for mutations/login/logout, fixed-field auth security events, sanitized auth/admin errors, health check. Partial. | No verified central log collection, immutable off-site audit trail, retention enforcement, CSP report endpoint, Sentry equivalent, alerting or on-call process. |
| A10 Server-Side Request Forgery | Protocol/port/credential restrictions, private/reserved IP and DNS checks, redirect revalidation, response caps and admin rate limit. Partial. | DNS validation and the subsequent fetch can use separate resolutions (rebinding/TOCTOU risk). Pin the validated address at connection time or enforce a dedicated egress proxy; verify with a live rebinding test. |

XML parsing was not identified as an application request path. No new XML parser or external-entity feature is introduced. CORS remains same-origin by default; no wildcard allowance is added. JSON media-type enforcement also prevents cross-origin “simple form” submission to the updated JSON endpoints, but it is not a universal CSRF design for every route. Auth.js/Next.js origin and SameSite protections must remain enabled, and state-changing GET routes should be removed in a follow-up review.

## 4. NIST CSF 2.0 — all six functions

| Function | Current evidence | Status and next action |
| --- | --- | --- |
| **Govern** | This assessment, remediation priorities, security reporting policy and IR/GDPR/DR templates. | **Partial.** Founder/security/privacy/deputy roles, risk acceptance, vendor ownership, policy approval and review cadence must be assigned. |
| **Identify** | Prisma schema/data inventory, runtime source review, dependency inventory and audit, documented critical assets and threats. | **Partial.** Complete production asset/data-flow inventory, processor register, business impact analysis and externally validated attack surface. |
| **Protect** | RBAC/ownership, password and breach controls, throttling, validation, headers, upload re-encoding, sanitization, SSRF checks, secret-handling rules and CI gates. | **Partial.** Add staff MFA, session redesign, verified TLS/IAM/encryption, secret manager, global WAF limits and retention enforcement. |
| **Detect** | Health endpoint, activity/audit records, structured authentication events and CI anomaly gates. | **Partial.** Centralize tamper-resistant logs, alert on spikes/role changes/payment anomalies/audit failures, add CSP/error reporting and rehearse detection queries. |
| **Respond** | [Incident-response runbook](incident-response.md), audit evidence sources and containment levers. | **Template only.** Assign on-call and legal contacts, preserve off-site evidence, test communication and perform a tabletop exercise. |
| **Recover** | Existing backup commands and [DR runbook](disaster-recovery.md). | **Not proven.** Approve RTO/RPO, encrypt and separate backups, perform isolated database/upload restore drills and measure results. |

## 5. MITRE ATT&CK mapping

This is a defensive coverage map, not a claim that ATT&CK certifies the application.

| Technique | Relevant controls | Gap / validation |
| --- | --- | --- |
| T1110.001 Password Guessing; T1110.004 Credential Stuffing | bcrypt, dummy comparison, 5/10-attempt limits, progressive delay, stronger/HIBP password checks, generic errors. | Shared production limiter, distributed-attack tests, alerting, MFA and risk-based CAPTCHA. |
| T1078 Valid Accounts | Blocked users, effective DB roles, founder rules, staff opt-in, password-change JWT revocation. | MFA, stolen-session detection, device/risk signals and rapid global revocation. |
| T1550.004 Web Session Cookie | Auth.js signed cookies, production Secure behavior over HTTPS, SameSite/HttpOnly defaults, server role checks. | Short access/rotating refresh design, three-session limit, binding/reuse detection and cookie inspection on the real deployment. |
| T1136 Create Account | Registration always creates USER, input allowlist and registration limits. | Abuse monitoring and optional risk-based challenge; no self-service role assignment. |
| T1098 Account Manipulation | Role changes restricted to admin/founder, founder immutability rules and audit events. | Alerts for role/password/block changes and periodic access recertification. |
| T1190 Exploit Public-Facing Application | Validation, body caps, headers, sanitization, parameterized queries, dependency audit and tests. | Independent SAST/DAST/fuzzing and external penetration test. |
| T1059 Command and Scripting Interpreter; T1059.007 JavaScript | No runtime command execution identified; repository policy blocks new dynamic execution; nonce CSP and HTML sanitizer. | Browser exploit testing, CSP violation telemetry and trusted-types evaluation where compatible. |
| T1105 Ingress Tool Transfer | Raster-only allowlist, signature checks, Sharp re-encoding, metadata stripping, UUID names, no SVG, path confinement. | Aggregate multipart limits and optional malware scanning for any future non-image formats. |
| T1580 Cloud Infrastructure Discovery | SSRF blocks loopback, private, link-local and metadata destinations; redirects and response sizes constrained. | DNS pinning/egress proxy and live rebinding tests. |
| T1499 Endpoint Denial of Service | Bounded limiter map, optional atomic shared limiting, body/pixel limits, timeouts and capped SSRF reads. | CDN/WAF global 100 requests/IP/minute policy, load tests and distributed rate-limit availability decisions. |
| T1070 Indicator Removal on Host | Application activity log is append-oriented and transaction-bound. | Database administrators can alter local rows; export to immutable off-site retention with access separation. |
| T1485 Data Destruction; T1486 Data Encrypted for Impact | Backup guidance, no destructive schema change in this work, scoped permissions and DR runbook. | Immutable/offline copies, separate backup credentials, restore drills and ransomware tabletop. |
| T1567 Exfiltration Over Web Service | CSP `connect-src 'self'`, restricted outbound import target and no arbitrary avatar URL fetching. | Egress allowlisting, DLP/ anomaly monitoring and vendor/data-transfer review. |

## 6. Prioritized remediation plan

### P0 — required before an Internet-facing production release

1. **Verify deployment security on the real host:** HTTPS-only redirect, HSTS after reviewing every subdomain, secure `__Secure-` cookies, trusted proxy header overwrite, no direct public Node port, current TLS/ciphers and certificate renewal. Run external Security Headers and SSL Labs scans; do not infer their grades from source.
2. **MFA for FOUNDER/ADMIN/MANAGER:** TOTP with encrypted secrets, single-use hashed backup codes, recovery workflow and throttled verification; then WebAuthn/passkeys. Require a warned, reviewed schema migration and test recovery/blocked/demoted users. Do not place TOTP secrets in JWTs or logs.
3. **Session architecture:** design 15-minute access plus seven-day rotating refresh sessions, refresh-reuse detection, explicit global revocation, optional device/risk binding and a maximum of three concurrent sessions. This needs a reviewed persistence design and migration; shortening the existing JWT lifetime alone would not implement refresh-token security.
4. **Production abuse controls:** configure and test Upstash or an equivalent atomic shared store; enforce the global 100 requests/IP/minute policy at CDN/WAF, tune NAT exceptions, add risk-based CAPTCHA only after abuse signals and alert on limiter fallback/outage.
5. **Secrets and data protection:** move payment credentials from database settings to a managed secret store without removing the founder's approved configuration workflow; rotate exposed credentials, verify Turso/host/IAM/encryption and separate backup credentials. Never print secrets or personal data in logs.
6. **Monitoring and response:** centralize logs off-site, protect audit integrity, configure alerts/on-call, add privacy-reviewed CSP violation and error reporting, approve the IR contact matrix and run a tabletop exercise.
7. **Recoverability:** create encrypted off-site immutable backups for Turso/libSQL and `public/uploads`, then perform and document an isolated restore test. Backups that have not been restored are not proven backups.
8. **Privacy:** approve legal bases, retention and processors; handle legacy audit titles containing email through a reviewed cleanup/pseudonymization job; implement access/export/deletion workflows and verify analytics-consent withdrawal retention behavior.

### P1 — next engineering iteration

- Pin SSRF connections to validated DNS results or route imports through a restricted egress proxy; add a live rebinding regression environment.
- Review and remove state-changing GET behavior, then run a dedicated CSRF test matrix for custom API routes, Server Actions, authentication and payment creation/callbacks.
- Add continuous advisory scanning, Dependabot/renovate review, SBOM generation, commit-SHA-pinned GitHub Actions and a supported ESLint/Prisma upgrade plan.
- Add professional SAST/DAST and fuzzing for parsers, upload decoders, URL canonicalization, role/ownership matrices and payment callbacks.
- Add aggregate multipart/streaming limits and central CSP/error telemetry with redaction and retention controls.
- Conduct access recertification, least-privilege reviews, secret rotation drills and security training for administrators/developers.

### P2 — independent assurance and resilience

- Commission an external authenticated/unauthenticated penetration test and remediate/retest findings before claiming success.
- Consider a scoped private vulnerability-disclosure or bug-bounty program only after triage ownership and fix SLAs exist.
- Exercise incident response, ransomware isolation and disaster recovery; measure actual RTO/RPO and improve runbooks.
- If AI functionality is introduced, inventory models/vendors, keep secrets and unnecessary personal data out of prompts, use typed allowlisted tools, treat output as untrusted, validate generated payloads, add prompt-injection/data-exfiltration evaluations and apply the same RBAC/audit boundaries.

## 7. Acceptance status

| Requested outcome | Current status |
| --- | --- |
| No critical/high npm findings | **Met at the 2026-10-25 point-in-time audit; continuously gated in CI.** |
| A+ Security Headers | **Not verified.** Header controls are implemented/tested; an external production scan is still required. |
| A+ SSL Labs | **Not verified.** Depends on the actual TLS endpoint and certificate configuration. |
| TOTP/WebAuthn/backup codes | **Not implemented; P0 with a reviewed migration.** |
| 15-minute access + seven-day refresh rotation/device binding/three sessions | **Not implemented; P0 architecture work.** |
| Successful independent penetration test | **Not performed.** |
| Successful backup restore | **Not performed.** |
| IR/GDPR/DR documents | **Templates added; ownership, legal approval and exercises remain.** |

Operational documents: [Incident response](incident-response.md), [GDPR/privacy checklist](gdpr.md), [Disaster recovery](disaster-recovery.md), and the repository-root `SECURITY.md`.
