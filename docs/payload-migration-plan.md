# Архитектура после перехода на Payload

## 1. Итоговый статус

Переход завершён **без coexistence**: самописная legacy-админка, отдельные manager-экраны, Prisma schema/client и compatibility adapter удалены. Payload `3.92.1` обслуживает и staff-панель, и прикладные серверные workflows.

- Payload Admin Panel: `/admin`;
- native Payload REST: `/api/payload`;
- GraphQL и GraphQL Playground: отключены;
- локальный Payload password login: отключён;
- единая SQLite/libSQL база: `PAYLOAD_DATABASE_URL`;
- схема: только reviewed files в `payload/migrations/`, `push: false`.

Публичный дизайн, RU/EN-маршруты, Auth.js, MFA/passkeys, customer cart/orders/payments и доменные ограничения сохранены. Lumi/Kairo остаются презентационными анонсами; Robokassa не считается включённой для реальных платежей без отдельного согласования и live-проверки.

## 2. Единая архитектура

```text
Публичный Next.js сайт
  ├─ RU/EN RSC и клиентские компоненты
  ├─ public reads → Payload Local API с узкими projections
  └─ customer auth / cart / orders / payment → серверные actions и routes

Payload Admin Panel (/admin)
  ├─ collections и Story global
  ├─ dashboard и защищённые staff views
  ├─ collection/field/document access
  └─ custom Auth.js strategy с действующей staff session и MFA

Тот же Next.js server и Payload Local API
  ├─ Auth.js / TOTP / WebAuthn / отзываемые AuthSession
  ├─ доменные операции и дочерние документы в SQLite transactions
  ├─ hooks для статусов, цен, блокировок и каскадного удаления
  └─ SQLite/libSQL + постоянное media-хранилище
```

Local API не считается автоматическим guard. Публичные и customer workflows явно проверяют session/ownership до чтения или записи. Внутренние операции после такой проверки используют `overrideAccess: true`; REST и Admin получают реальный Payload user и не обходят access control.

## 3. Collections и ответственность

| Область | Payload documents | Правила |
| --- | --- | --- |
| Аккаунты | `accounts` | Роль, блокировка, профиль и защищённые auth-поля. Чтение directory только для `ADMIN`/`FOUNDER`; manager не видит customers |
| Каталог | `services`, `products`, `media` | Публикация, локализация, quote/orderable rules, остатки и безопасные WebP uploads |
| Контент | `posts`, `Story` | RU/EN-контент, публикации, featured post, author-controlled markup/embeds и landing story |
| Продажи | `orders`, `order-services`, `order-items`, `payments` | Cart — это `orders.status = cart`; Admin/REST staff reads исключают carts. Дочерние документы изменяются только серверными workflows |
| Аналитика и настройки | `page-views`, `activity-logs`, `site-settings` | Server-owned записи, audit и защищённые платёжные настройки |
| Auth-хранилища | `pending-logins`, `auth-sessions`, `mfa-backup-codes`, `webauthn-credentials` | Не публикуются в Admin как обычные редактируемые данные; используются Auth.js/MFA workflows через Local API |

Generated TypeScript-типы находятся в `payload/payload-types.ts`. Они обновляются через `npm run payload:types` после согласованного изменения config, но не заменяют runtime access checks.

## 4. Auth, RBAC и manager scope

Auth.js остаётся authentication layer; Payload получает staff identity через custom strategy. Параллельного Payload password account нет. Для staff требуется включённый служебный режим и подтверждённый TOTP/passkey. Без MFA staff-аккаунт получает только customer-level session и направляется на настройку второго фактора.

Действующая роль проверяется по серверной session и актуальному `accounts` document. Блокировка, смена пароля и понижение роли отзывают серверные сессии. Правила founder protection, запрет самоблокировки/самопонижения и последнего staff-фактора сохраняются в hooks и доменных actions.

Manager scope является частью access control, а не только скрытием ссылок:

- `orders`: только оформленные заказы (`status != cart`);
- `accounts`: нет directory read и нет Admin view;
- carts: нет staff REST/Admin read;
- разрешённые поля заказа: согласование цены, счёт, статус и блокировка в пределах hooks;
- платёжные секреты и founder-only операции: недоступны.

Server CLI `db:promote-admin` также использует Payload Local API. Назначение `FOUNDER` возможно только этим runbook; после изменения роли hooks отзывают существующие сессии.

## 5. Заказы, корзина и оплата

`requestQuote`, `createOrder`, `cancelMyOrder`, customer Cart и payment workflows работают с Payload documents через Local API. Клиент не назначает окончательную цену и не выбирает произвольные relations.

- quote-only и `isOrderable = false` нельзя обойти подменой client input;
- цена, остатки, активность и публикация услуг/товаров перечитываются из БД;
- создание заказа и его дочерних documents выполняется в одной transaction;
- отмена разрешена владельцу только в допустимом неоплаченном статусе;
- цена и блокировка проверяются hooks с учётом фактических успешных payments;
- создание платёжной ссылки требует authenticated same-origin POST, владельца заказа или действующего staff user и статуса `awaiting_payment`;
- payment callback проверяет подпись, сумму и состояние заказа до изменения documents.

Per-client transaction queue в `lib/payload-native.ts` сериализует SQLite writers. Retry допускается только для неудачного `BEGIN`; callback с доменными side effects не повторяется.

## 6. Миграции и эксплуатация

Canonical env:

```env
PAYLOAD_DATABASE_URL="file:./payload/pip.db"
PAYLOAD_DATABASE_AUTH_TOKEN=""
AUTH_SECRET="независимый-секрет"
PAYLOAD_SECRET="другой-независимый-секрет"
```

`TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` остаются только aliases для существующего secret manager. Не создавайте вторую CMS-базу.

Обязательный порядок для чистой установки или обновления:

```bash
npm ci
npm run doctor
npm run payload:migrate
npm run payload -- migrate:status
npm run db:check
npm run typecheck
npm run lint
npm test
npm run security:audit
npm run security:dependencies
npm run build
```

Перед реальной миграцией нужны backup, review SQL и проверка на isolated copy. Сборка не применяет схему автоматически. Подробный production runbook: `DEPLOYMENT.md`; backup/restore: `docs/security/disaster-recovery.md`.

## 7. Обязательные runtime gates

Изменения collections, hooks, auth или схемы нельзя считать завершёнными только по typecheck. Нужны:

1. чистая disposable SQLite с применёнными migrations и успешным `db:check`;
2. customer registration/login, profile, cart, checkout, отмена и допустимый payment flow;
3. staff login с MFA, `/admin`, разрешённые CRUD operations и session revocation;
4. manager browser/REST checks: orders доступны, Accounts Admin закрыт, accounts REST запрещён, carts возвращают ноль documents;
5. реальные TOTP/WebAuthn ceremonies на isolated БД без production-секретов;
6. публичные RU/EN reads, blog filters, media upload/get/delete и отсутствие unpublished data;
7. production build и browser smoke без console errors, horizontal overflow и broken reduced-motion states;
8. migrations/status, security policy и полный dependency audit.

Unit mocks не заменяют эти сценарии. Live Robokassa, физический/platform authenticator, внешний penetration test и production restore drill требуют отдельных реальных проверок и не выводятся из исходного кода.

## 8. Официальная документация

- [Payload Installation](https://payloadcms.com/docs/getting-started/installation)
- [Payload SQLite](https://payloadcms.com/docs/database/sqlite)
- [Payload Migrations](https://payloadcms.com/docs/database/migrations)
- [Custom Authentication Strategies](https://payloadcms.com/docs/authentication/custom-strategies)
- [Payload Access Control](https://payloadcms.com/docs/access-control/overview)
- [Payload Admin routes](https://payloadcms.com/docs/admin/overview) и [REST API](https://payloadcms.com/docs/rest-api/overview)
- [Payload Uploads](https://payloadcms.com/docs/upload/overview)
