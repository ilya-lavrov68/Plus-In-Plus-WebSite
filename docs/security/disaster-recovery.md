# Runbook backup, Disaster Recovery и ransomware (шаблон)

**Статус:** restore, failover и recovery-time test в рамках репозиторной работы не выполнялись. Цели ниже — предложения для founder/business approval, а не достигнутые SLA.

## 1. Активы и предлагаемые цели

| Актив | Необходимая защита | Начальная цель до business impact analysis |
| --- | --- | --- |
| Turso/libSQL database | Provider backup + независимый encrypted access-separated export | RPO 24 часа; RTO 4 часа |
| `public/uploads` | Versioned/incremental encrypted copy, integrity checks, safe deletion | Тот же начальный RPO/RTO; reconcile references |
| Environment/provider configuration | Managed secret store и отдельная recovery procedure | Восстановление named owners; секреты не входят в общий archive |
| Application source/config | Git history, reviewed release artifact, lockfile | Rebuild из known-good commit с provenance check |
| DNS/TLS/proxy/CDN | Restricted exported config и renewal/runbook docs | До открытия трафика восстановить HTTPS-only и trusted headers |

Рекомендуемые классы: ежедневные protected copies, отдельная off-site/account copy и immutable/offline recovery point. Encryption keys и backup-delete permissions отделяются от production application identity.

`AUTH_SECRET` не помещается в общий backup archive. Его восстановление/ротация планируется отдельно: смена значения завершает sessions и требует повторной настройки TOTP, потому что MFA encryption key выводится из него через HKDF.

## 2. Требования к backup jobs

Примеры команд находятся в `README.md` и `DEPLOYMENT.md`. До того как полагаться на них:

- [ ] Настроить schedule и monitoring для БД и uploads; alert на failure, unusual size и missing recovery point.
- [ ] Шифровать in transit/at rest; разделить read/delete/write roles.
- [ ] Хранить минимум одну копию вне production account/region failure domain, где это разрешено provider/legal policy.
- [ ] Использовать immutable/object-lock или offline protection от ransomware и credential misuse.
- [ ] Записывать start/end, source version, key reference, integrity и expiry без secrets/PII в job logs.
- [ ] Согласовать database/upload snapshots, чтобы restored references и files совпадали.
- [ ] Проверить retention и secure deletion; не хранить все копии бесконечно.
- [ ] Не размещать backups в public web root или Git workspace.
- [ ] Учесть `ActivityLog` pseudonymization/deletion-reapplication после restore, чтобы старая копия не отменила approved privacy actions бессрочно.

## 3. Изолированный restore drill

Первый restore никогда не выполняется в production database или production uploads directory.

1. **Authorize и записать:** назначить operator/reviewer, выбрать recovery point, указать ожидаемое UTC time и создать isolated workspace/provider project.
2. **Защитить production:** использовать separate credentials без production write/delete privilege. Перед каждой destructive command подтвердить target name.
3. **Восстановить БД:** импортировать в новую isolated libSQL/Turso database, не перезаписывая source backup. Проверить схему через Prisma generation, `db:check` и health; текущая схема ожидает 17 таблиц.
4. **Восстановить uploads:** извлечь в новую isolated directory с path traversal/symlink-safe handling. Сравнить manifest counts, sizes и cryptographic hashes.
5. **Проверить integrity:** сравнить row counts и нечувствительные invariants: roles, published slugs, order/payment state totals. Не печатать customer records/secrets в drill log.
6. **Обезопасить restored sessions:** до открытия приложения выполнить reviewed revocation restored `AuthSession` и очистку `PendingLogin`, чтобы старые browser tokens не получили доступ после cutover. Само наличие backup не должно воскрешать refresh access.
7. **Запустить isolated app:** направить только test instance на restored DB/uploads, сохранить production-like headers и non-production auth config. Для MFA-сценариев создать test-only account и заново настроить факторы; не использовать реальные customer credentials и не ожидать, что старый TOTP заработает с другим `AUTH_SECRET`.
8. **Smoke-test:** health, public pages, representative login, customer/staff separation, MFA enrollment/challenge, refresh revocation, owned orders, CMS и images. Не отправлять real payments/messages.
9. **Измерить:** фактическое data-loss window, database/upload/application recovery times, failures и manual dependencies; сравнить с approved RPO/RTO.
10. **Очистить:** отозвать temporary credentials и securely destroy isolated PII copies после evidence/approval requirements.
11. **Улучшить:** назначить corrective owners/dates и повторять до успешного restore; записать следующий drill date.

Рекомендуемый cadence: automated backup checks ежедневно, isolated restore ежеквартально и после крупных DB/storage changes. До formal approval это рекомендация, не действующая политика.

## 4. Disaster recovery sequence

1. Объявить incident и заморозить risky deployments/migrations.
2. Сохранить logs/evidence и определить, заслуживает ли source data доверия. Не восстанавливать поверх evidence.
3. Выбрать known-clean recovery point до compromise/corruption window.
4. Rebuild known-clean infrastructure и ротировать application/database/backup/payment/deployment secrets по необходимости.
5. Выполнить isolated restore и validation выше.
6. Запланировать production cutover с explicit target IDs, rollback decision и customer communication.
7. Перед reopening восстановить HTTPS-only routing, trusted forwarded headers, WebAuthn origin/RP ID, shared rate limiting и monitoring.
8. Не открывать доступ со старыми restored sessions: выполнить revocation и потребовать новый вход. Не replay unknown webhooks/payment callbacks.
9. Согласовать записи после recovery point только reviewed process; вести privacy deletion/pseudonymization reapplication ledger.
10. Усилить monitoring, затем завершить post-incident review.

## 5. Ransomware-specific controls

- Держать immutable/offline recovery points вне досягаемости production и ordinary admin credentials.
- Разделять backup read/write/delete privileges; требовать strong MFA для backup/control-plane accounts.
- Alert на mass file changes, abnormal backup deletion, unusual DB dumps и privilege changes.
- Изолировать affected hosts и остановить synchronization potentially encrypted files в healthy versions.
- Rebuild вместо доверия compromised host, ротировать exposed credentials и проверять restored files до execution/public serving.
- Не заявлять ransomware resilience, пока isolation и clean restoration не отрепетированы.

## 6. Шаблон evidence для drill

Хранить в restricted operational storage, не в Git с PII:

- Дата/время, operator и reviewer:
- Source/target environments (нечувствительные IDs):
- Recovery point и причина выбора:
- Backup integrity/encryption/immutability checks:
- Schema (17 таблиц), counts и invariant results:
- Upload manifest/hash/reference result:
- Session revocation и privacy reapplication result:
- Application/MFA/security smoke result:
- Измеренные RPO и RTO:
- Failures, corrective owners и due dates:
- Temporary-data destruction и credential revocation:
