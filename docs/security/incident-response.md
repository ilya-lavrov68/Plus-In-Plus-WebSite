# Runbook реагирования на инциденты (шаблон)

**Статус:** шаблон, не утверждённый и не отрепетированный operational process. До production назначьте основных и резервных владельцев, закрытые контакты и on-call порядок в ограниченном operational document. Не коммитьте телефоны, credentials или чувствительную contact tree в Git.

## 1. Роли и severity

| Роль | Обязанность |
| --- | --- |
| Руководитель инцидента | Объявляет severity, распределяет работу, контролирует timeline и утверждает containment/recovery |
| Технический владелец | Сохраняет evidence, исследует приложение/БД/host и внедряет исправление |
| Security/privacy владелец | Оценивает влияние на персональные данные, уведомления и безопасное редактирование логов |
| Владелец коммуникаций | Координирует согласованные сообщения клиентам, партнёрам, providers и регуляторам |
| Летописец | Фиксирует UTC time, команды, evidence locations, решения и открытые действия |

Предлагаемая модель, требующая утверждения:

- **SEV-1:** активный компрометационный доступ founder/admin, нарушение платёжной целостности, подтверждённая массовая утечка, ransomware или полный outage.
- **SEV-2:** ограниченный account takeover, эксплуатируемые authorization/XSS/SSRF, sustained credential stuffing или существенная деградация.
- **SEV-3:** заблокированная попытка, изолированный дефект без подтверждённого влияния, подозрительное событие для расследования.

Если влияние неизвестно, сохраняйте evidence и эскалируйте, а не предполагайте отсутствие breach.

## 2. Первые 30 минут

1. Записать источник обнаружения и UTC time. Создать один incident channel и один restricted evidence log.
2. Назначить руководителя и технического владельца. Не обсуждать чувствительные indicators в публичных issues.
3. До restart/redeploy, где это безопасно, сохранить proxy/CDN/application logs, host/process state, deployment commit, нечувствительные config metadata, rate-limit health и нужные ActivityLog rows.
4. Экспортировать evidence в access-controlled off-site storage. Записать collector, source, time, integrity hash и chain of custody. Не «чищать» оригиналы.
5. Определить затронутые accounts, orders, content, uploads, auth sessions, pending logins, secrets и time window.
6. Не помещать passwords, полные access/refresh tokens, TOTP secrets, backup codes, payment secrets или лишние PII в tickets/chat.
7. Выбрать минимально достаточный containment: maintenance mode, route restriction, account block, session revocation, key rotation или host isolation.
8. Зафиксировать legal/incident hold. Пока он действует, не запускать удаление или `db:audit-retention` против relevant evidence без согласования.

## 3. Инструменты сдерживания

- Заблокировать compromised user через существующий admin control; понижать/block staff только в рамках полномочий. Founder protections сохраняются.
- Через approved recovery сменить пароль: password stamp делает старые JWT недействительными, а transaction отзывает активные AuthSession records. Не отправлять temporary passwords в публичных каналах.
- Для подозрения на refresh reuse проверить `auth.refresh.reuse_detected`, revocation reasons и связанные сессии. Не логировать сам token.
- При компрометации MFA использовать отдельный verified recovery: отозвать сессии, повторно настроить TOTP/passkey и регенерировать backup codes. Не считать наличие MFA колонок доказательством её включения у всех staff.
- При системной компрометации `AUTH_SECRET` планировать массовый logout и повторную настройку TOTP: HKDF-derived MFA key тоже изменится. Заранее подготовить communication/recovery.
- Отключить уязвимый route/integration на proxy/application layer, не ослабляя глобально RBAC, CSP или security headers.
- Ротировать затронутые Turso, Upstash, payment и deployment credentials в provider secret manager. Новые значения не коммитить.
- При fallback shared rate limiter на process-local защиту временно применить CDN/WAF limits.
- При подозрении на host/container compromise изолировать и пересобрать из known-good artifact, а не ограничиваться in-place cleanup.

## 4. Investigation checklist

- Какие deployment commits и config versions были активны?
- Какие identities, roles, source addresses и user agents видны в provider logs? Коррелировать без копирования лишних PII.
- Есть ли всплески `auth.login.*`, `auth.mfa.*`, `auth.refresh.*`, `security.csp.violation`, `health.check_failed`, role/block/password changes?
- Нет ли неожиданных `refresh_reuse`, `refresh_race`, `session_limit`, `password_changed` или массового `mfa_enabled`?
- Есть ли неожиданные order totals, payment states, invoices, CMS changes или upload names?
- Согласованы ли timelines ActivityLog, application, CDN, database и host? Явно отметить logging gaps.
- Могли ли быть затронуты secrets, backups, analytics identifiers, order notes, support messages или uploads?
- Подтверждён ли entry point? Если нет, зафиксировать hypotheses и необходимые evidence, не выдумывая root cause.

Structured application events намеренно содержат мало полей. CSP telemetry хранит только allowlisted directive, а sanitized server errors — event и allowlisted code. Для расследования используйте защищённые provider logs и корреляцию по времени; не расширяйте приложение логированием URL, cookies или PII ради удобства.

## 5. Eradication и recovery

1. Исправить root cause и добавить regression, который по возможности падает на vulnerable revision.
2. Ротировать credentials и отозвать attacker sessions/tokens.
3. Выполнить deploy reviewed commit; повторить `npm ci`, audits, types, tests и production build.
4. Если целостность сомнительна, восстановить known-clean backup сначала по изолированной процедуре из `disaster-recovery.md`.
5. Проверить `/api/health` и все **16 обязательных прикладных таблиц** (плюс служебные Payload tables), authentication, customer/staff separation, MFA challenge/recovery, refresh revocation, order ownership, CMS и payment configuration только на test accounts/data.
6. Возвращать трафик постепенно, сохраняя enhanced monitoring/limits на согласованный observation period.
7. Получить approval руководителя до закрытия containment или объявления recovery.

## 6. Коммуникация и приватность

- Использовать утверждённые факты: что известно, что неизвестно, какие действия выполнены и что безопасно сделать пользователям.
- Privacy/legal owner определяет применимый режим уведомлений. Если применяется GDPR, оценить supervisory notification без undue delay и, когда требуется, в течение 72 часов с момента awareness; зафиксировать решение и мотивы.
- Уведомлять затронутых лиц без undue delay, если применимый high-risk threshold и legal assessment этого требуют.
- Координироваться с hosting, Turso, Upstash, payment и другими providers через официальные каналы.
- Сохранять evidence решений, сроков и текстов. Не обещать отсутствие влияния без проверки.

## 7. Сценарии

### Credential stuffing / account takeover

Применить shared/CDN limits, сохранить агрегированные auth events, проверить successful staff logins и role/password changes, заблокировать compromised accounts, отозвать sessions и пройти approved recovery/MFA. Не логировать submitted passwords или credential pairs.

### XSS или вредоносный CMS-контент

Сохранить sanitized и author-controlled source в restricted evidence, при необходимости снять publication, исправить sanitizer/rendering, добавить payload regression, invalidate caches и изучить CSP directives. Не включать broad inline scripts.

### SSRF или неожиданный outbound request

Заблокировать destination/egress, сохранить validated URL/DNS evidence под restricted access, проверить metadata/provider logs и ротировать потенциально раскрытые credentials. Проверить validated-IP pinning, redirect revalidation, timeout и body cap. Live rebinding test не считается выполненным только по unit tests.

### Вредоносный upload / storage abuse

Отключить affected route, сохранить controlled sample с безопасным handling, проверить serving paths/decoder logs, удалить active content только после evidence capture и подтвердить re-encoding/path confinement. Не открывать подозрительный файл на workstation.

### Payment callback anomaly

Не включать Robokassa, пока реальные платежи не согласованы. Сохранить callback/signature/state evidence без secrets, проверить amount/order/latest-invoice, связаться с provider официально и выполнить ручную reconciliation до изменения paid status.

### Secret exposure

Сначала revoke/rotate по активному риску, затем устранить exposure через history/security process. Git deletion не отзывает secret. Проверить provider use logs; считать значения из chat, CI logs и deployed artifacts потенциально скопированными.

### Ransomware / destructive action

Изолировать системы, сохранить evidence, остановить синхронизацию potentially encrypted files в healthy backups, защитить immutable/offline copies, ротировать backup credentials и rebuild из known-clean infrastructure. Recovery требует изолированного restore test, а не только наличия archives.

## 8. Закрытие и улучшение

- Подтвердить containment, eradication, monitoring и required communications.
- Подготовить blameless post-incident review: timeline, evidence-based root cause, control failures, customer impact, owners/dates.
- Добавить regressions и обновить threat model, IR/GDPR/DR и alert rules.
- Довести remediation до проверенного закрытия. Tabletop рекомендуется минимум ежегодно и после крупных architecture changes; это рекомендуемый, ещё не утверждённый cadence.
