# Incident-response runbook (template)

Status: operational template, not yet approved or exercised. Before production, assign named primary/deputy owners and private contact details in a restricted operational document; do not commit personal phone numbers, credentials or sensitive contact trees to Git.

## 1. Roles and severity

| Role | Required responsibility |
| --- | --- |
| Incident commander | Declares severity, assigns work, controls timeline and approves containment/recovery. |
| Technical lead | Preserves evidence, investigates application/database/host data and implements fixes. |
| Security/privacy lead | Assesses personal-data impact, regulatory duties and safe logging/redaction. |
| Communications owner | Coordinates approved customer, partner, provider and regulator communications. |
| Scribe | Records UTC timestamps, commands, evidence locations, decisions and outstanding actions. |

Suggested severity model (approve before use):

- **SEV-1:** active compromise of founder/admin, payment integrity breach, confirmed mass personal-data exposure, ransomware or complete service outage.
- **SEV-2:** limited account compromise, exploitable authorization/XSS/SSRF issue, sustained credential stuffing or material degradation.
- **SEV-3:** blocked attempt, isolated defect with no confirmed impact, suspicious event requiring investigation.

If impact is uncertain, preserve evidence and escalate rather than assuming no breach.

## 2. First 30 minutes

1. Record the detection source and UTC time. Open one incident channel and one restricted evidence log.
2. Name the incident commander and technical lead. Avoid discussing sensitive indicators in public issues.
3. Preserve volatile evidence before restarting or redeploying where safe: proxy/CDN/application logs, process/host state, deployment version, Auth.js configuration metadata (not secrets), rate-limit health and relevant ActivityLog rows.
4. Snapshot or export evidence to access-controlled off-site storage. Record collector, source, time, integrity hash and chain of custody. Do not alter original evidence to “clean it up.”
5. Scope affected accounts, orders, content, uploads, sessions, secrets and time window. Never put passwords, full session tokens, payment secrets or unnecessary personal data in tickets/chat.
6. Decide whether containment requires temporary maintenance mode, route restriction, account blocking, provider key rotation or isolation. Balance evidence preservation against active harm.

## 3. Containment levers

Use the least disruptive effective action and record every change:

- Block a compromised user through the existing admin control; demote/block staff where authorized. Founder protections still apply.
- Change the account password through the approved recovery path to revoke JWTs carrying the old password stamp. Do not send temporary passwords through public channels.
- For systemic session-key compromise, plan `AUTH_SECRET` rotation carefully: it can invalidate all sessions and requires an approved recovery/communication step.
- Disable a vulnerable route or integration at the proxy/application layer. Preserve ordinary customer access where safe; do not silently weaken authorization or security headers.
- Rotate affected Turso, Upstash, HIBP-related configuration (if any), payment or deployment credentials in the provider's secret manager. Never commit replacements.
- If shared rate limiting fails, treat local fallback as reduced distributed protection; apply temporary CDN/WAF limits during an active attack.
- For suspected host/container compromise, isolate the instance and rebuild from a known-good artifact rather than attempting only in-place cleanup.

## 4. Investigation checklist

- Which deployment commits and configuration versions were active?
- Which identities, roles, source addresses and user agents appear in provider logs? Correlate without copying unnecessary personal data into the incident record.
- Are there login/rate-limit spikes, `staff login` anomalies, role/block/password changes or `auth.audit.write_failed` events?
- Are there unexpected order totals, payment state changes, new invoices, content changes or upload names?
- Are ActivityLog, application, CDN, database and host timelines consistent? Identify logging gaps explicitly.
- Could secrets, backups, analytics identifiers, order notes, support messages or uploaded images have been accessed?
- Is the entry point confirmed? If not, state the hypotheses and evidence needed; never invent root cause.

## 5. Eradication and recovery

1. Patch and test the root cause, including a regression test that fails on the vulnerable revision where feasible.
2. Rotate affected credentials and revoke active attacker sessions/tokens.
3. Rebuild or deploy from a reviewed commit. Verify `npm ci`, policy/dependency audits, types, tests and production build.
4. Restore only from a known-clean backup if integrity is uncertain. Follow the isolated restore procedure in `disaster-recovery.md` first.
5. Verify `/api/health`, authentication, staff/customer separation, order ownership, CMS integrity and payment configuration without using real customer credentials.
6. Return gradually, monitor closely and keep enhanced logging/limits until the agreed observation period ends.
7. Obtain incident-commander approval before closing containment or declaring recovery.

## 6. Communication and privacy

- Use approved, factual language: what is known, what is not, actions taken and safe steps for users.
- The privacy/legal owner determines whether GDPR or another notification regime applies. Where GDPR applies to a personal-data breach, assess the supervisory-authority notification requirement without undue delay and, where required, within 72 hours of awareness; document decisions and reasons.
- Notify affected individuals without undue delay when the applicable high-risk threshold and legal assessment require it.
- Coordinate with hosting, Turso, Upstash, payment and other affected providers through their official incident channels.
- Preserve evidence of notification decisions, timelines and content. Do not promise that no data was affected unless verified.

## 7. Scenario playbooks

### Credential stuffing / account takeover

Apply shared/CDN limits, preserve authentication aggregates, check successful staff logins and role/password changes, block compromised accounts, revoke sessions and require the approved recovery/MFA path. Do not log submitted passwords or full credential pairs.

### XSS or malicious CMS content

Preserve the sanitized and original author-controlled source in restricted evidence, disable affected publication if needed, patch sanitizer/rendering, add a payload regression, invalidate caches and review CSP reports. Do not respond by enabling broad inline scripts.

### SSRF or unauthorized outbound request

Block the destination/egress path, preserve validated URL and DNS evidence under restricted access, check cloud metadata/provider logs, rotate any potentially exposed credentials and add a redirect/rebinding test.

### Malicious upload / storage abuse

Disable the affected upload route, preserve a controlled sample with restricted handling, check serving paths and decoder logs, remove active content only after evidence capture, and verify re-encoding/path confinement. Do not execute or open a suspicious file on a workstation.

### Payment callback anomaly

Keep Robokassa disabled if not intentionally accepting payments. Preserve callback/signature/state evidence without secrets, verify amount/order/latest-invoice checks, contact the provider through an official channel and reconcile manually before changing paid status.

### Secret exposure

Revoke/rotate first according to active risk, then remove exposure through normal history/security procedures. A Git deletion alone does not revoke a secret. Inspect provider use logs and assume values in chat, CI logs or deployed artifacts may have been copied.

### Ransomware / destructive action

Isolate affected systems, preserve evidence, disable synchronization of potentially encrypted files to healthy backups, protect immutable/offline copies, rotate backup credentials if exposed and rebuild from known-clean infrastructure. Recovery requires an isolated restore validation, not just the presence of backup files.

## 8. Closure and improvement

- Confirm containment, eradication, monitoring and required communications are complete.
- Produce a blameless post-incident review with timeline, root cause/evidence, control failures, customer impact and corrective owners/dates.
- Add regression tests and update threat models, IR/GDPR/DR documents and alert rules.
- Track all remediation to verified closure; schedule a tabletop exercise at least annually and after major architecture changes (recommended cadence, not yet approved policy).
