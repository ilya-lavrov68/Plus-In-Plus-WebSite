# GDPR и инженерия приватности (шаблон)

**Статус:** engineering checklist, не юридическая консультация и не декларация compliance. Controller/privacy owner обязан до production утвердить цели, legal bases, retention, processors, международные transfers и notification decisions.

## 1. Инвентарь данных по репозиторию

| Данные | Где | Назначение в коде | Основной риск / решение |
| --- | --- | --- | --- |
| Email, имя/фамилия, роль, blocked status, password hash, avatar path | `users` | Authentication, profile, RBAC и orders | Утвердить bases, access/export/deletion и retention. Не логировать hashes/credentials |
| Encrypted TOTP secrets, pending secrets и MFA timestamps | `users` | Настройка и проверка второго фактора | Ограничить доступ; ротация `AUTH_SECRET` требует MFA recovery/re-enrollment |
| WebAuthn credential IDs, public keys, counters, names | `webauthn_credentials` | Passkey authentication | Это security/account data; не считать публичный key разрешением на публикацию связи с пользователем |
| Hashed backup codes и `usedAt` | `mfa_backup_codes` | Одноразовый recovery | Не хранить/логировать raw codes; определить retention после замены/использования |
| Pending login ID, secret hash, role, attempts, challenge, expiry | `pending_logins` | Пятиминутный MFA challenge | Удалять expired/replayed records по approved retention; не превращать в долгий login history |
| Session ID, refresh/device hashes, role, usage/expiry/revocation | `auth_sessions` | До трёх revocable refresh sessions | Защитить как security data; определить cleanup expired/revoked rows и доступ к device correlations |
| Project descriptions, deadlines, prices, notes, order IDs | `orders`, `order_items`, `order_services` | Quotes, orders и support | Минимизировать free text, ограничить staff scope, учесть financial/legal holds |
| Payment IDs, amount/currency, status, limited callback data | `payments` | Invoice и server-confirmed state | Реальные платежи сейчас не принимаются; перед включением пересмотреть processor и retention |
| Actor/entity IDs, actions, titles, timestamps, actor pseudonym | `activity_logs` | Security/admin accountability | Старые titles могут содержать email; `actorPseudonym` остаётся псевдонимом, а не автоматической анонимностью |
| Path, pseudonymous visitor/session IDs, referrer, UTM, user agent/device/duration | `page_views` | Analytics после consent | Withdrawal очищает browser identifiers, но не удаляет historical rows; нужен отдельный retention/deletion процесс |
| Avatar, service/blog images, albums | `public/uploads` | User/CMS images в WebP | Видимое содержимое может быть PII; backup/delete/rights должны учитывать DB references |
| Founder-configured provider credentials | `site_settings` | Payment/integration configuration | Не обычный profile data, а restricted secrets; нужен managed secret store |

HIBP получает только пятисимвольный SHA-1 prefix и возвращает suffix range. Пароль, email и полный hash не отправляются. Задокументировать flow в privacy review и убедиться, что network logs не записывают sensitive request material.

CSP endpoint принимает browser reports, но structured event сохраняет только allowlisted directive. Document/blocked URLs, samples, cookies, IP и user agent в application event не копируются. Это minimization, а не основание хранить provider access logs без собственной политики.

## 2. Governance checklist

- [ ] Назначить controller, privacy owner, security owner и DPO, если он требуется по официальной оценке.
- [ ] Зафиксировать purposes и legal bases; не считать consent универсальным основанием для account/order processing.
- [ ] Вести processor/subprocessor и hosting-region records для deployment, Turso/libSQL, Upstash, email/monitoring, Robokassa при включении и Canva embeds.
- [ ] Оценить international transfer mechanisms и government-access risks.
- [ ] Определить необходимость DPIA и пересматривать её при monitoring/profiling/high-risk изменениях.
- [ ] Утвердить record of processing activities и обновлять после schema/vendor/analytics changes.
- [ ] Синхронизировать public privacy/cookie notices с фактическими providers и поведением.
- [ ] Проверять author-controlled Canva/third-party content на browser-side sharing; CSP frame allowlist не заменяет consent.

## 3. Data-subject rights workflow

Нужен приватный authenticated процесс, а не sensitive requests через public issues:

1. Зарегистрировать request reference без лишних PII.
2. Пропорционально проверить identity; не раскрывать account data до проверки.
3. Поискать по approved inventory: account, MFA/sessions, orders/support, payments, activity, analytics, uploads/backups.
4. Для access/export создать secure time-limited export с authorization и safe formatting. При будущем CSV защититься от spreadsheet formula injection.
5. Для correction использовать profile path где уместно; не помещать profile values в audit titles.
6. Для erasure/objection/restriction оценить legal holds и financial/security retention; записать, что удалено, псевдонимизировано или оставлено и почему.
7. При consent withdrawal остановить future analytics writes и выполнить approved historical-data rule. Очистка browser IDs не удаляет server rows.
8. Передать verified requests processors и в backup process по approved schedule.
9. Ответить в применимый срок (обычно один месяц по GDPR, только с законными extensions) и сохранить решение.

Self-service export/deletion и automated processor propagation **не реализованы** этим изменением.

## 4. Retention: кандидаты и фактический CLI

Сроки ниже — предложения, а не действующая политика:

| Data class | Кандидат | Открытое решение |
| --- | --- | --- |
| Operational security events | 30–90 дней online; дольше только для documented incidents | Minimization, restricted central storage, investigation needs |
| ActivityLog | По event class; старые email/IP titles обработать после review | Legal/financial holds и incident evidence имеют приоритет над automatic cleanup |
| PendingLogin / AuthSession | Короткий cleanup после expiry/revocation, если нет hold | Нужен отдельный approved schedule; текущий CLI их не удаляет |
| PageView | Короткое rolling window, затем aggregate/delete | Точный срок и consent-withdrawal behavior |
| Accounts/profile/MFA/uploads | Active account + approved closure period | Active orders, disputes, recovery и legal holds |
| Orders/payments | По accounting, tax, contract и dispute requirements | Нужна jurisdiction-specific оценка, не универсальный срок |
| Backups | Короткое protected rolling window с delayed secure expiry | Не воскрешать deleted data бессрочно; вести deletion-reapplication ledger где требуется |

### Что реализовано

`npm run db:audit-retention` обрабатывает только старые `ActivityLog` и по умолчанию ничего не изменяет:

```bash
npm run db:audit-retention -- --older-than-days=365
```

Dry-run выводит counts без record values. Для apply нужны backup, approved policy, отдельный стабильный ключ и явное подтверждение:

```bash
export AUDIT_PSEUDONYM_KEY="<отдельный-секрет-не-короче-32-символов>"
npm run db:audit-retention -- --older-than-days=365 --apply --confirm=PSEUDONYMIZE
```

Apply:

- устанавливает `actorId = null` и сохраняет HMAC-based `actorPseudonym` при наличии actor;
- заменяет обнаруженные email и IPv4 в `title` псевдонимами;
- сохраняет action/entity context и не удаляет всю запись;
- не обрабатывает автоматически orders, payments, sessions, page views, uploads или backups.

Это **псевдонимизирующий repository job**, не scheduled production retention, не universal anonymizer и не GDPR certification. Значение 365 дней — CLI default, а не утверждённый legal retention. Не запускать при incident/legal hold без approval. Смена ключа между запусками меняет будущую корреляцию и требует отдельного плана.

## 5. Уже существующие privacy/security controls

- Authenticated support связывает order с session customer, а не submitted account ID.
- Managers сохраняют customer/order scope; founder/admin settings остаются restricted.
- Analytics writes требуют `analyticsConsent: true`; withdrawal удаляет local pseudonymous identifiers.
- Новые user-audit titles не содержат email; sanitized auth/admin/health logs опускают provider messages/stacks/connection strings.
- Passwords bcrypt-hashed; refresh tokens и backup codes хранятся как hashes; TOTP secrets encrypted.
- Raster uploads перекодируются и лишаются metadata, но видимая PII остаётся ответственностью controller.

## 6. Privacy incident checklist

- [ ] Зафиксировать data, people, systems и time window; не копировать exposed dataset в incident channel.
- [ ] Сохранить evidence безопасно и ограничить доступ.
- [ ] Оценить likelihood/severity риска для rights and freedoms с privacy/legal owner.
- [ ] При применимом GDPR оценить supervisory notification без undue delay и в течение 72 часов, когда требуется; задокументировать причины даже при отказе от уведомления.
- [ ] Оценить high-risk individual notification и processor/controller duties.
- [ ] Завершить remediation, retention/deletion decisions и post-incident review.
