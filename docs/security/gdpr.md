# GDPR and privacy engineering checklist (template)

Status: engineering checklist, not legal advice and not a declaration of compliance. The controller/privacy owner must approve purposes, legal bases, retention, processors, international transfers and notification decisions before production.

## 1. Repository-derived data inventory

| Data | Where | Purpose seen in code | Main risk / required decision |
| --- | --- | --- | --- |
| Email, first/last name, role, blocked status, password hash, avatar path | `users` | Account authentication, profile, authorization and order handling. | Define account/contract/legal-obligation bases, access/export/deletion and retention. Never log password hashes or credentials. |
| Project descriptions, deadlines, prices, customer/manager notes and order identifiers | `orders`, `order_items`, `order_services` | Quotes, order processing and support. The support note can include submitted name/email. | Minimize free text, restrict staff scope, define financial/legal retention and deletion exceptions. |
| Payment identifiers, amount/currency, status and limited callback payload | `payments` | Invoice and server-confirmed payment state. | Robokassa is not currently accepting payments; reassess before enabling. Define processor, reconciliation retention and access. |
| Actor/entity IDs, actions, entity titles and timestamps | `activity_logs` | Security/administrative accountability. | Older rows may contain email in titles; new user events use `User account`. Approve legacy cleanup and retention. Export security logs off-site with restricted access. |
| Path, pseudonymous visitor/session IDs, referrer, UTM source, optional user agent/device/duration | `page_views` | Product analytics after consent in the reviewed route. | Historical rows are not automatically deleted when browser consent is withdrawn. Define retention, deletion/pseudonymization and consent evidence. |
| Avatar, service/blog images and album files | `public/uploads` | User/CMS-controlled images, re-encoded to WebP. | Images may themselves contain personal data. Back up, delete and fulfill rights consistently with database references. |
| Founder-configured provider credentials | `site_settings` | Payment/integration configuration. | Not ordinary profile data, but highly restricted secrets. Move to a managed secret store and verify database encryption/access. |

The HIBP password check sends only a five-character SHA-1 prefix and receives a range of suffixes. It does not send the password, email or full hash. Document this flow in the privacy review and verify network logs do not capture sensitive request material.

## 2. Governance checklist

- [ ] Name the controller, privacy owner, security owner and DPO if required after an official assessment.
- [ ] Record each processing purpose and legal basis; do not assume consent is the correct basis for account/order processing.
- [ ] Maintain processor/subprocessor and hosting region records for the deployment, Turso/libSQL, Upstash if configured, email/monitoring providers, Robokassa if enabled and embedded Canva usage.
- [ ] Assess international transfer mechanisms and government-access risks where applicable.
- [ ] Determine whether a DPIA is required; perform one for material monitoring, profiling or other high-risk changes.
- [ ] Approve a record of processing activities and review it after schema, vendor or analytics changes.
- [ ] Keep public privacy/cookie notices consistent with actual behavior and configured providers.
- [ ] Review author-controlled Canva embeds and third-party content for browser-side data sharing; a CSP frame allowlist is not a privacy consent mechanism.

## 3. Data-subject rights workflow

Implement and test a private, authenticated workflow rather than accepting sensitive requests through public issues:

1. Receive and log the request reference without unnecessary personal data.
2. Verify identity proportionately; do not rely solely on an emailed ID document or expose account data before verification.
3. Search the approved inventory: account, orders/support notes, payments, activity, analytics identifiers and uploads/backups as applicable.
4. For access/export, produce a secure, time-limited export with safe formatting and authorization checks. CSV export must defend against spreadsheet formula injection if introduced.
5. For correction, use the existing profile path where appropriate and record the action without putting profile values in audit titles.
6. For erasure/objection/restriction, assess legal holds and financial/security retention; document what was deleted, pseudonymized or retained and why.
7. For consent withdrawal, stop future analytics writes and execute the approved historical-data retention/deletion rule. Clearing browser identifiers alone does not erase server rows.
8. Propagate verified requests to relevant processors and backups according to the approved schedule.
9. Respond within the applicable deadline (generally one month under GDPR, with only legally permitted extensions) and record the decision.

Self-service export/deletion and automated processor propagation are **not implemented** by this change.

## 4. Candidate retention schedule — approval and enforcement required

These are proposed starting points, not active policy:

| Data class | Candidate | Open decision |
| --- | --- | --- |
| Operational security events | 30–90 days online, longer only for documented incidents | Balance investigation needs against minimization; centralize and restrict access. |
| ActivityLog | Define by event class; review legacy email titles promptly | Some business/financial records may require longer legal retention; do not silently delete evidence during an incident. |
| PageView raw pseudonymous events | Short rolling window, then aggregate or delete | Approve exact period and consent-withdrawal behavior. |
| Accounts/profile/uploads | Active account duration plus approved closure period | Handle active orders, disputes and legal holds. |
| Orders/payment records | Determined by applicable accounting, tax, contract and dispute requirements | Obtain jurisdiction-specific advice; do not invent a universal period. |
| Backups | Short rolling protected window with delayed secure expiry | Restore process must not resurrect deleted data indefinitely; maintain a deletion-reapplication ledger where required. |

No automated retention enforcement is added in this change.

## 5. Privacy and security controls already relevant

- Authenticated support links the order to the session customer, not an arbitrary submitted account.
- Managers retain customer/order scope; founder/admin settings remain restricted.
- Analytics writes require `analyticsConsent: true`; browser consent withdrawal removes local pseudonymous identifiers.
- New user-audit titles do not contain email, and auth/admin error logging omits provider messages/stacks.
- Passwords are bcrypt-hashed and are not included in activity/security events or HIBP requests.
- Uploaded raster images are re-encoded and metadata is stripped, but visible personal content remains the controller's responsibility.

## 6. Privacy incident checklist

- [ ] Record what data, people, systems and time window are involved; avoid copying the exposed dataset into the incident channel.
- [ ] Preserve evidence securely and contain access.
- [ ] Assess likelihood and severity of risk to rights and freedoms with the privacy/legal owner.
- [ ] Where GDPR applies, assess supervisory notification without undue delay and within 72 hours of awareness when required; document reasons even when not notifying.
- [ ] Assess high-risk individual notification and processor/controller duties.
- [ ] Complete remediation, retention/deletion decisions and a documented post-incident review.
