# Оценка безопасности Plus In Plus и план дальнейших работ

Дата обновления: **2026-10-26**. База сравнения: `d583e92725c1c30095882af1e5d21ce06cb6799d`; оцениваемый delta находится в ветке, содержащей этот документ.

Это оценка исходников и автоматических проверок, **не** сертификация, внешний penetration test, infrastructure audit, юридическое заключение или production security rating. Не было доступа к настроенной non-production/production БД, реальному HTTPS endpoint, cloud account, SIEM, backup vault или live Robokassa. Mock repositories, in-memory doubles и disposable SQLite не выдаются за staging/production evidence.

## 1. Результат и объём изменений

В baseline уже были server-side RBAC/ownership, Auth.js credentials, bcrypt, generic login failures, bounded/shared rate limiting, Zod, parameterized Prisma, HTML sanitization, image re-encoding, nonce CSP, payment signature/state checks и transactional ActivityLog.

Текущий hardening delta добавляет или завершает:

- **Additive MFA/session schema:** `pending_logins`, `auth_sessions`, `mfa_backup_codes`, `webauthn_credentials` и nullable `activity_logs.actorPseudonym`. Health проверяет 17 таблиц. **Предупреждение:** реальная схема не применялась; нужны backup, reviewed `db:push` и staging verification.
- **TOTP:** secrets шифруются AES-256-GCM с отдельным HKDF-derived key из `AUTH_SECRET`; pending setup действует десять минут и атомарно переиспользуется между вкладками. Форма привязана к timestamp конкретного enrollment: устаревший QR получает отдельное recovery-состояние, а invalid code оставляет только redacted event `auth.mfa.failed`. Verification throttled, `window: 1` не расширяется.
- **WebAuthn/passkeys:** registration/authentication через SimpleWebAuthn 14, user verification required, алгоритмы `-7` и `-257`; production требует HTTPS, `WEBAUTHN_ORIGIN` и `WEBAUTHN_RP_ID` с hostname/parent-domain validation.
- **Исправление MFA serialization:** `AuthenticationResponseJSON` явно кодируется в JSON перед URL-encoded Auth.js credentials boundary и строго декодируется с size/shape checks в `authorize`. Отсутствующее passkey-поле больше не превращается в строку `"undefined"`; malformed passkey payload не проваливается в TOTP/backup branch. Challenge/origin/RP ID/UV/replay/rate-limit проверки не ослаблены.
- **Backup codes:** десять одноразовых кодов, только SHA-256 hashes в БД, atomic `usedAt` consumption и regeneration после owner verification. Staff не может удалить последний second factor.
- **MFA login boundary:** пятиминутный pending login, пять попыток, одноразовое consumption. Staff без фактора получает только `USER` session и `/profile?mfa=required`; ordinary customer login сохранён. Role change во время challenge не повышает сессию автоматически.
- **Access/refresh sessions:** 15-минутный access, семидневный refresh с исходной absolute expiry и максимум три активные sessions. Единый источник чисел — `lib/session-policy.ts`. Refresh/device hashes, rotation, device binding, reuse/race revocation, logout/password revocation и persisted role downgrade реализованы в коде: позднее повышение не восстанавливает staff mode без нового входа.
- **Same-origin state changes:** создание платёжной ссылки и refresh принимают только POST. Payment требует `application/x-www-form-urlencoded`, auth, throttling, owner/staff checks, `awaiting_payment` и согласованную положительную цену. State-changing payment GET удалён.
- **SSRF:** protocol/port/credential restrictions, hostname/IP/DNS validation, connection-time pinning validated address через Undici dispatcher, redirect revalidation, timeout, streamed body cap и cancellation unread body.
- **CSP telemetry:** legacy и Reporting API bodies, включая camelCase directive fields; rate limit и body cap; structured event содержит только allowlisted directive, но не URLs, samples, cookies, IP или user agent.
- **Sanitized errors:** health и остальные reviewed server errors логируют fixed event и allowlisted code без provider messages/stacks/connection strings.
- **Audit retention CLI:** dry-run по умолчанию, HMAC pseudonyms для direct actor/email/IPv4, явный apply confirmation и отдельный ключ. Это не scheduled production retention и не universal GDPR deletion.
- **Supply-chain updates:** SimpleWebAuthn 14.0.x и совместимый `undici` 7.30.1 с lockfile/overrides; полный npm audit остаётся CI gate.
- **Постоянный UI/UX-стандарт:** `docs/ui-ux-pro-max.md` и обязательная ссылка в `AGENTS.md`; утверждённые PIP UI-решения сохранены.

Обычный вход клиента, отдельный staff mode, manager customer/order scope, правила quote/orderable services, database-authoritative CMS, author-controlled content, uploads и RU/EN UI не удалялись.

## 2. Подтверждённые репозиторные проверки и их границы

| Проверка | Результат на 2026-10-26 | Что это доказывает / чего не доказывает |
| --- | --- | --- |
| Полный `npm test` | **389/389 passed** | Включает прежние RBAC/payment/CMS/upload regressions и MFA/session/CSP/SSRF/health/origin tests, включая stable/stale/expired TOTP enrollment. Это не staging или external test. |
| Focused MFA/session regressions | Passed внутри полного suite | TOTP challenge consumption, backup-code single use, role-demotion/re-promotion semantics, refresh rotation/reuse/device binding, three-session limit и selective revocation на in-memory doubles. Не доказывает live authenticator или distributed DB race. |
| Реальная MFA ceremony integration | **4/4 passed** | `tests/mfa-ceremony-integration.test.cjs`: настоящие action functions, URL-encoded `@auth/core` parser, Credentials provider, SimpleWebAuthn, QR/TOTP, bcrypt и Prisma на disposable SQLite. Дополнительно проверены parallel/reopened setup, один `setupId`, отклонение stale enrollment, истечение TTL и успешное renewal. Это не физический/platform authenticator и не staging. |
| Локальный Next.js HTTP MFA smoke | **Passed** | До fix реальный `next dev` воспроизвёл `The verification code is invalid or expired.` для валидной signed assertion; после fix тот же flow завершился успешно. `beginTotpSetup` → QR → `enableTotp` также прошёл на HTTP в development и в собранном `next start`; pending secret очищен. Не доказывает чужой deployment, HTTPS-домен или браузерный authenticator. |
| Локальный HTTPS production browser MFA review | **Passed** | QR декодирован в `otpauth://`; код вычислен независимой HMAC-реализацией и принят. Проверены invalid recovery, server/client expiry, renewal и повторный Staff sign-in как `ADMIN`; RU/EN, 320–1440 px, keyboard и console. Disposable SQLite и самоподписанный TLS не являются production evidence. |
| Focused SSRF/CSP/health/origin | Passed внутри полного suite | Body-cap read stop/cancellation, redirect revalidation, modern CSP fields/redaction, health log redaction и cross-origin rejection до side effects. Не live DNS rebinding или browser CSP verification. |
| Focused WebAuthn config / audit retention | Passed внутри полного suite | Production origin/RP ID/HTTPS validation, deterministic pseudonyms, repeated regex safety и clean-record no-op. Не live authenticator или production retention job. |
| `npm run security:audit` | Passed: **334 source files**, no high-confidence findings | Focused policy checks выбранных secrets/CORS/raw-SQL/HTML/dynamic-execution patterns. Не полный SAST и не гарантия отсутствия секретов. |
| `npm run security:dependencies` | **0 vulnerabilities** | Point-in-time full npm audit. Не гарантия будущего отсутствия advisories или поддержки всех версий. |
| ESLint / TypeScript / production build | **Passed** | `next lint` без warnings/errors, `tsc --noEmit` и `next build` успешны. Сохраняются non-blocking warnings о next-intl cache dependency, Edge-совместимости optional jose compression APIs и отсутствующей постоянной БД во время build; они не скрываются под successful verdict. |
| Disposable SQLite schema + local production smoke | **Passed** | `db:push`/`db:check`: 17 таблиц; health `ok`, `/`, `/shop`, `/blog`, `/sitemap.xml` — 200; payment GET — 405; cross-origin POST — 403; пустой refresh — 401; CSP reporting headers есть. Это не staging/Turso/production. |
| Реальная БД / миграция / Turso concurrency | **Не выполнялись** | `TURSO_DATABASE_URL` для такой среды не был настроен. Нужен reviewed staging run. |
| Operational MFA у всех staff | **Не подтверждено** | Код enforcement есть; реальные пользователи должны настроить факторы и пройти recovery drill. |
| Live HIBP / Upstash | **Не проверялись** | Protocol/atomic behavior покрыт mocks; production connectivity и outage behavior требуют smoke. |
| Live Robokassa | **Не выполнялась; реальные платежи не принимаются** | Нельзя заявлять successful payment. Цены и включение требуют manager/founder confirmation. |
| Browser design review | **Выполнен только для затронутого MFA UI** | Проверены RU/EN recovery-состояния, 320/390/768/1440 px, keyboard/focus и console. Полный дизайн-аудит всех страниц этим результатом не закрывается. |
| Security Headers / SSL Labs | **Не выполнялись** | A/A+ нельзя вывести из source headers; нужен реальный HTTPS endpoint. |
| External penetration test | **Не выполнялся** | Source review и unit tests не заменяют независимую проверку. |
| Backup restoration / IR/GDPR certification | **Не выполнялись** | Runbooks и CLI не доказывают recoverability, compliance или incident readiness. |

Сообщённый отказ TOTP на deployed-площадке локально **не воспроизвёлся**: формат URI совпал с независимыми HMAC/`pyotp`, а production browser scenario принял код. После повторного пользовательского отчёта добавлены привязка формы к enrollment, отдельное stale/expired recovery и redacted `auth.mfa.failed` для invalid setup code. Это устраняет подтверждённый stale-QR дефект, но не доказывает причину отказа на чужой инфраструктуре. Если invalid сохраняется на текущем QR после deploy, нужны только конкретный UI result и redacted server event `auth.mfa.failed`; также проверить `npm run db:check`, UTC/NTP на сервере, автоматическое время на authenticator-устройстве, одинаковый `AUTH_SECRET` на всех инстансах и отсутствие его ротации между setup и enable. Секреты, QR, TOTP codes и содержимое БД в тикет не включать.

Полный CI в `.github/workflows/ci.yml` дополнительно запускает install/doctor, audits, lint, TypeScript, tests, disposable SQLite schema push/check, production build и HTTP smoke. Он не имеет production secrets и не применяет реальную схему.

## 3. OWASP Top 10 mapping

**Partial** означает наличие полезных controls при остающейся потребности в production или independent assurance.

| Категория | Repository evidence | Оставшийся риск |
| --- | --- | --- |
| A01 Broken Access Control | Server-derived roles, DB/token effective roles, founder rules, manager scope, owned cart/order/support, staff MFA enforcement и regressions. Partial. | Нужны external horizontal/vertical tests и centralized permission-denied alerting. |
| A02 Cryptographic Failures | bcrypt cost 12, encrypted TOTP, hashed backup/refresh secrets, secure production cookies и HSTS при правильном HTTPS deployment. Partial. | TLS/ciphers, certificate automation, Turso/storage/backups encryption, key rotation и managed secret store не проверены. |
| A03 Injection | Prisma binding, reviewed raw SQL binds, Zod, sanitization, request caps/type checks и no runtime `child_process`. Partial. | Нужны independent SQL/command/template/fuzz tests. |
| A04 Insecure Design | Deny-by-default roles, server-authoritative prices/CMS, MFA/session architecture, abuse limits, audit records и IR/GDPR/DR templates. Partial. | Нужны approved threat model, RTO/RPO, operational recovery и periodic design reviews. |
| A05 Security Misconfiguration | Nonce CSP, anti-framing, nosniff/referrer/permissions, HSTS, production CSP enforcement и telemetry endpoint. Partial. | Proxy redirect/forwarded-header overwrite, CDN/WAF, TLS и host/container hardening требуют deployment verification. HSTS `includeSubDomains` требует all-subdomain review. |
| A06 Vulnerable and Outdated Components | Exact lockfile, `npm ci`, full audit в CI, текущий zero finding. Partial. | Нужны continuous advisory monitoring, SBOM, supported Prisma/ESLint upgrades и dependency/action provenance. |
| A07 Identification and Authentication Failures | Strong/HIBP passwords, generic errors, throttling, TOTP/WebAuthn/backup codes, pending challenge limits, 15-minute access, rotating seven-day refresh, device binding и three-session limit. Repository controls реализованы; overall Partial. | Нужны real staff enrollment, authenticator/browser tests, staging concurrency/revocation, risk-based signals и incident recovery. |
| A08 Software and Data Integrity Failures | Lockfile/CI, schema/build checks, transactional audit, payment signature/amount/order/state validation. Partial. | Actions pinned by tags, не commit SHA; нет SBOM, artifact signing/provenance и independent integrity assessment. |
| A09 Security Logging and Monitoring Failures | ActivityLog, fixed-field auth/refresh events, sanitized errors, health и redacted CSP telemetry; retention CLI. Partial. | Нет подтверждённого central immutable logging, alerting/on-call и approved automated retention schedule. |
| A10 Server-Side Request Forgery | Public protocol/port/IP/DNS rules, connection-time validated-IP pinning, redirect revalidation, timeout/body cap и focused tests. Partial. | Нужны live rebinding/egress tests и при необходимости dedicated egress proxy; external network behavior не проверялся. |

XML parsing не обнаружен как application request path. CORS остаётся same-origin по умолчанию. JSON media-type checks и same-origin POST boundaries дополняют, но не заменяют Auth.js/Next.js Server Action protections и отдельную CSRF matrix для всех будущих routes.

## 4. NIST CSF 2.0 — все шесть функций

| Функция | Текущее evidence | Статус и следующее действие |
| --- | --- | --- |
| **Govern** | Эта оценка, reporting policy, IR/GDPR/DR и deployment runbooks | **Partial.** Назначить owners/deputies, risk acceptance, vendor ownership, approval и review cadence. |
| **Identify** | Prisma data inventory, source/dependency review, documented assets/threats | **Partial.** Завершить production asset/data-flow inventory, processor register, BIA и external attack-surface validation. |
| **Protect** | RBAC/ownership, MFA/session controls, passwords, throttling, validation, headers, uploads, SSRF pinning, secrets rules и CI | **Partial.** Применить reviewed schema, включить staff MFA, проверить TLS/IAM/encryption, secret manager, WAF и retention. |
| **Detect** | Health, ActivityLog, structured auth/refresh/security events и redacted CSP endpoint | **Partial.** Centralize tamper-resistant logs, alert на spikes/role/payment/session anomalies и отрепетировать queries. |
| **Respond** | [IR runbook](incident-response.md), containment/revocation/rotation levers | **Template only.** Назначить on-call/legal contacts, off-site evidence и tabletop exercise. |
| **Recover** | Backup commands, session-revocation guidance и [DR runbook](disaster-recovery.md) | **Not proven.** Утвердить RTO/RPO, создать immutable off-site copies и выполнить isolated restore. |

## 5. MITRE ATT&CK defensive mapping

Это defensive coverage map, а не заявление о certification ATT&CK.

| Technique | Релевантные controls | Gap / validation |
| --- | --- | --- |
| T1110.001 Password Guessing; T1110.004 Credential Stuffing | bcrypt, dummy comparison, 5/10-attempt limits, progressive delay, HIBP/password policy, generic errors и MFA | Shared production limiter, distributed-attack tests, alerting и при необходимости risk-based CAPTCHA |
| T1078 Valid Accounts | Blocked users, effective roles, staff opt-in + MFA, pending limits, password/session revocation | Operational enrollment, stolen-session detection, device/risk signals и access recertification |
| T1550.004 Web Session Cookie | Short access JWT, hashed rotating refresh, device binding, reuse/race revocation, three-session limit и Secure/HttpOnly cookies | Cookie inspection и replay/concurrency tests на реальном deployment |
| T1136 Create Account | Registration всегда USER, input allowlist и registration limits | Abuse monitoring и optional risk-based challenge; self-service role assignment отсутствует |
| T1098 Account Manipulation | Admin/founder role restrictions, founder rules, last-staff-factor protection и audit | Alerts на role/password/block/MFA changes и periodic recertification |
| T1190 Exploit Public-Facing Application | Validation, caps, headers, sanitization, parameterized queries, dependency audit и tests | Independent SAST/DAST/fuzzing и external penetration test |
| T1059 Command and Scripting Interpreter; T1059.007 JavaScript | No runtime command execution identified, policy checks, nonce CSP и sanitizer | Browser exploit testing, real CSP telemetry review и trusted-types evaluation |
| T1105 Ingress Tool Transfer | Raster allowlist, signatures, Sharp re-encoding, UUID names, no SVG и path confinement | Aggregate multipart limits и malware scanning для будущих non-image formats |
| T1580 Cloud Infrastructure Discovery | SSRF private/metadata blocking, DNS pinning, redirect revalidation и capped reads | Live rebinding и egress-proxy validation |
| T1499 Endpoint Denial of Service | Bounded limiter map, optional shared limiting, body/pixel limits, timeout/capped SSRF reads | CDN/WAF global 100 requests/IP/minute policy, load tests и distributed availability decisions |
| T1070 Indicator Removal on Host | Append-oriented transaction-bound ActivityLog и optional pseudonymization | DB admins могут изменять local rows; нужен immutable off-site export и legal-hold process |
| T1485 Data Destruction; T1486 Data Encrypted for Impact | Backup/DR guidance, scoped permissions и session revocation after restore | Immutable/offline copies, separate backup credentials, restore drills и ransomware tabletop |
| T1567 Exfiltration Over Web Service | CSP `connect-src 'self'`, restricted/pinned import target и no arbitrary avatar fetching | Egress allowlisting, anomaly monitoring и vendor/data-transfer review |

## 6. Приоритетный оставшийся план

### P0 — до Internet-facing production release

1. **Схема и staging:** backup, reviewed additive `db:push`, `db:check`, health 17 и полный staging smoke на копии. Проверить MFA enrollment/login/recovery, passkeys в браузере, refresh rotation/reuse/race, logout/password revocation и четыре concurrent sessions.
2. **Operational MFA:** включить второй фактор у каждого FOUNDER/ADMIN/MANAGER, сохранить backup codes в approved manager, назначить recovery owners и убедиться, что ordinary customer login сохранён.
3. **Deployment security:** HTTPS-only redirect, trusted proxy headers, secure `__Secure-` cookies, `WEBAUTHN_*`, TLS/ciphers/certificate renewal и all-subdomain HSTS review. Выполнить external Security Headers/SSL Labs без выдумывания оценок.
4. **Abuse controls:** настроить и проверить Upstash/equivalent, CDN/WAF global limits, NAT exceptions, limiter outage alerts и при необходимости risk-based CAPTCHA.
5. **Secrets и payments:** managed secret store для payment/provider credentials, rotation drill, Turso/IAM/encryption review. Robokassa оставить без реальных платежей до manager/founder confirmation и successful live verification.
6. **Monitoring/privacy:** central off-site logs, alerting/on-call, approved CSP/log retention, legal bases/processors и отдельный monitored schedule для retention CLI. Не запускать cleanup поверх incident/legal hold.
7. **Recoverability:** encrypted immutable off-site backups БД/uploads и successful isolated restore, включая restored-session revocation и privacy reapplication.
8. **Независимая проверка:** authenticated/unauthenticated penetration test с remediation/retest до любого заявления об успешном pentest.

### P1 — следующая engineering-итерация

- Commit-SHA-pinned GitHub Actions, Dependabot/Renovate review, SBOM, artifact provenance и supported Prisma/ESLint upgrade plan.
- Live DNS-rebinding/egress test environment и professional SAST/DAST/fuzzing для parsers, uploads, URL canonicalization, RBAC и payment callbacks.
- Aggregate multipart/streaming limits, central error telemetry и rehearsed alert queries.
- Browser-based UI/accessibility review по `docs/ui-ux-pro-max.md` с screenshots, keyboard, responsive, reduced motion и повторным review после fixes.
- Access recertification, secret rotation drills и security training.

### P2 — assurance и resilience

- Повторные external pentest/retest после крупных изменений.
- Private disclosure/bug bounty только после triage owners и fix SLA.
- IR/ransomware/DR exercises с измеренными RTO/RPO.
- Для будущего AI: inventory models/vendors, no unnecessary PII/secrets in prompts, typed allowlisted tools, untrusted output validation и prompt-injection/exfiltration evaluations.

## 7. Acceptance status

| Запрошенный результат | Статус |
| --- | --- |
| Нет critical/high npm findings | **Выполнено на point-in-time audit 2026-10-26: 0 vulnerabilities; CI gate сохранён.** |
| A+ Security Headers | **Не проверено.** Source controls есть, нужен external production scan. |
| A+ SSL Labs | **Не проверено.** Зависит от реального TLS endpoint. |
| TOTP/WebAuthn/backup codes | **Реализовано в репозитории; operational enrollment и live authenticator verification остаются.** |
| 15-minute access + seven-day rotation/device binding/three sessions | **Реализовано в репозитории; staging/distributed verification остаётся.** |
| SSRF DNS pinning/redirect/cap | **Реализовано и unit-tested; live rebinding/egress verification остаётся.** |
| Same-origin POST payment/refresh | **Реализовано и regression-tested; live payment не выполнялась.** |
| CSP telemetry и sanitized health logging | **Реализовано и regression-tested; central monitoring/alerts остаются.** |
| Audit retention | **Dry-run/apply CLI реализован; approved schedule/legal policy/production execution отсутствуют.** |
| Successful independent penetration test | **Не выполнялся.** |
| Successful backup restore | **Не выполнялся.** |
| IR/GDPR/DR документы | **Русские templates обновлены; ownership, legal approval и exercises остаются.** |

Operational documents: [Incident Response](incident-response.md), [GDPR/privacy](gdpr.md), [Disaster Recovery](disaster-recovery.md) и корневой `SECURITY.md`.
