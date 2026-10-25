# Политика безопасности

## Поддерживаемый код

Исправления безопасности оцениваются для активной ветки `main` репозитория. Для развёрнутого fork или старого релиза может потребоваться отдельный backport; в сообщении об уязвимости указывайте фактический commit и окружение.

## Как сообщить об уязвимости

Не создавайте публичный issue при подозрении на уязвимость, утечку секретов или персональных данных и не публикуйте рабочий exploit.

Используйте закрытый GitHub Private Vulnerability Reporting, если он доступен в репозитории. Иначе обратитесь через установленный закрытый канал maintainers и запросите безопасный способ передать детали. В первом сообщении не присылайте реальные пароли, session/refresh tokens, платёжные ключи, неотредактированные персональные данные или production database dumps.

По возможности укажите:

- затронутые commit, deployment, маршрут или компонент;
- влияние и необходимые права;
- минимальное воспроизведение только на тестовых аккаунтах и данных;
- предлагаемую митигуацию, если она известна;
- нужен ли согласованный срок раскрытия.

Не выполняйте деструктивные проверки, не читайте чужие данные, не прерывайте сервис, не запускайте высоконагруженное сканирование production и не выгружайте данные ради доказательства. Остановитесь на минимально необходимом evidence и передайте его приватно.

SLA ответа, bug bounty и safe-harbor программа **пока не обещаются**. Для них нужны назначенные владельцы triage и официально утверждённая программа.

## Обязательные проверки для участников

Перед security-relevant изменением выполните:

```bash
npm ci
npm run security:audit
npm run security:dependencies
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Существующий `.github/workflows/ci.yml` также запускает dependency/repository audits, lint, TypeScript, тесты, проверку схемы на disposable SQLite, production build и smoke test. Не считайте успешный CI заменой staging/production verification.

Запрещено:

- отключать nonce CSP или другие security headers ради работоспособности payload;
- коммитить `.env`, credentials, tokens или database dumps;
- логировать пароли, полные токены, connection strings или необязательные персональные данные;
- скрывать или подавлять результаты `npm audit`;
- ослаблять RBAC, ownership, server-authoritative pricing/CMS или проверки платёжных callback;
- менять схему реальной БД без предупреждения, backup и согласованного порядка применения.

Dependency upgrades должны сохранять регрессии авторизации, MFA/session flows, платежей, CMS и uploads.

## Эксплуатационные документы

- [Оценка безопасности, OWASP/NIST/MITRE и план](docs/security/README.md)
- [Incident Response](docs/security/incident-response.md)
- [GDPR и приватность](docs/security/gdpr.md)
- [Backup, Disaster Recovery и ransomware](docs/security/disaster-recovery.md)
- [Деплой и настройка окружения](DEPLOYMENT.md)

Документы разделяют репозиторные контроли и меры, которым ещё нужны production infrastructure, назначенные владельцы, независимая проверка или юридическое согласование. Наличие runbook не является сертификацией, успешным restore drill или penetration test.
