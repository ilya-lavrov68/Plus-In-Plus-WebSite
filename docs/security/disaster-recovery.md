# Backup, disaster-recovery and ransomware runbook (template)

Status: no backup restoration, failover or recovery-time test was performed for this assessment. The targets below are proposals requiring founder/business approval; they are not achieved service levels.

## 1. Assets and proposed objectives

| Asset | Required protection | Proposed starting objective |
| --- | --- | --- |
| Turso/libSQL database | Provider backup plus independently exported, encrypted, access-separated copy | RPO 24 hours; RTO 4 hours until business impact analysis approves otherwise. |
| `public/uploads` | Versioned/incremental encrypted copy with integrity checks and safe deletion handling | Same initial RPO/RTO as the database; reconcile references during restore. |
| Environment/provider configuration | Managed secret store with separate backup/recovery procedure | Recover through named owners; never commit secrets or place them in the general backup archive. |
| Application source/configuration | Git history, reviewed release artifact and dependency lockfile | Rebuild from a known-good reviewed commit; verify artifact provenance. |
| DNS/TLS/proxy/CDN settings | Exportable restricted configuration and renewal/runbook documentation | Restore HTTPS-only routing and trusted-header behavior before reopening traffic. |

Recommended resilience classes: daily protected copies, a separate off-site/account copy, and an immutable or offline recovery point. Encryption keys and backup-delete permissions must be separated from the production application identity.

## 2. Backup job requirements

The README contains example Turso dump and uploads archive commands. Before relying on them:

- [ ] Schedule and monitor both database and upload jobs; alert on failure, unusual size changes and missing recovery points.
- [ ] Encrypt backups in transit and at rest; restrict read/delete/write roles separately.
- [ ] Store at least one copy outside the production account/region failure domain where provider/legal policy permits.
- [ ] Use immutable/object-lock or offline protection against ransomware and credential misuse.
- [ ] Record backup start/end, source version, encryption/key reference, integrity result and retention expiry without including secrets or personal data in job logs.
- [ ] Reconcile database and upload snapshots so restored image references and files are consistent.
- [ ] Test retention and secure deletion; do not keep every copy forever.
- [ ] Do not place backups under the public web root or Git workspace.

## 3. Isolated restore drill

Never perform a first restore against the production database or production uploads directory.

1. **Authorize and record:** assign operator/reviewer, choose the recovery point, document expected UTC time and create an isolated restoration workspace/provider project.
2. **Protect production:** use separate credentials with no production write/delete privilege. Confirm the target name verbally and in the record before every destructive command.
3. **Restore database:** import into a newly created isolated libSQL/Turso database. Do not overwrite the source backup. Verify schema with the repository's Prisma generation/`db:check` approach using the isolated configuration.
4. **Restore uploads:** extract into a new isolated directory with path traversal/symlink-safe archive handling. Compare manifest counts, sizes and cryptographic hashes with the recorded source manifest.
5. **Check integrity:** compare row counts and selected non-sensitive invariants (roles, published slugs, order/payment state totals) against the backup record. Do not print customer records or secrets into the drill log.
6. **Run an isolated application:** point only the test instance to the restored database/uploads. Require production-like security headers and non-production authentication secrets.
7. **Smoke-test:** `/api/health`, public pages, representative login using test-only accounts, staff/customer role separation, owned orders, CMS rendering and image responses. Do not send real payments or messages to real users.
8. **Measure:** actual data-loss window, elapsed database/upload/application recovery times, failures and manual dependencies. Compare with approved RPO/RTO.
9. **Clean up:** revoke temporary credentials and securely destroy isolated personal-data copies after evidence/approval requirements are met.
10. **Improve:** file corrective actions with owners/dates and repeat until the restore succeeds. Record the next drill date.

Suggested cadence: automated backup checks daily, an isolated restore quarterly and after major database/storage changes. This cadence is a recommendation until formally approved.

## 4. Disaster recovery sequence

1. Declare the incident and freeze risky deployments/migrations.
2. Preserve logs/evidence and determine whether source data is trustworthy. Do not restore over evidence.
3. Select a known-clean recovery point before the compromise/corruption window.
4. Rebuild known-clean infrastructure and rotate application, database, backup, payment and deployment secrets as required.
5. Perform the isolated restore and validation above.
6. Plan production cutover with explicit target identifiers, rollback decision and customer communication.
7. Restore HTTPS-only proxy/CDN routing, trusted forwarded headers, shared rate limiting and monitoring before reopening.
8. Reconcile writes that occurred after the recovery point only through a reviewed process; never replay unknown webhooks or payment callbacks blindly.
9. Monitor integrity and security closely, then complete the post-incident review.

## 5. Ransomware-specific controls

- Keep immutable/offline recovery copies beyond the reach of production and ordinary administrator credentials.
- Separate backup read, write and delete privileges; require strong MFA for backup/control-plane accounts.
- Alert on mass file changes, abnormal backup deletion, unusual database dumps and unexpected privilege changes.
- Isolate affected hosts and pause synchronization that could propagate encrypted files to healthy versions.
- Rebuild rather than trusting a compromised host, rotate exposed credentials and validate restored files before execution or public serving.
- Do not claim ransomware resilience until both isolation and clean restoration have been exercised.

## 6. Drill evidence template

Record this in restricted operational storage, not with personal data in Git:

- Drill date/time and operators/reviewer:
- Source and target environments (non-sensitive identifiers):
- Recovery point and reason selected:
- Backup integrity/encryption/immutability checks:
- Database schema/count/invariant result:
- Upload manifest/hash/reference result:
- Application/security smoke result:
- Measured RPO and RTO:
- Failures, corrective owners and due dates:
- Temporary-data destruction and credential revocation confirmation:
