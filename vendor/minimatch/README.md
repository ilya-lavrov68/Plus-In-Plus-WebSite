# Compatibility-facade для minimatch

Этот приватный dev-only пакет нужен до появления совместимых исправлений в самих ESLint-dependent пакетах. Он делегирует сопоставление официальному `minimatch@11.0.3` через alias `minimatch-upstream`, а снаружи сохраняет два используемых в проекте API:

- legacy `require("minimatch")(path, pattern, options)` для ESLint 8 и его плагинов;
- named exports (`minimatch`, `Minimatch`, `match`, `filter`, `defaults` и остальные) для современных dependents.

Версия `11.0.3-compat.0` явно отличает facade от официального пакета. Это не копия и не самостоятельная реализация glob-алгоритма. В production-зависимости пакет не входит.

Удалить facade и вернуть обычные версии можно после того, как весь актуальный lint-stack будет поддерживать исправленный minimatch без override. После изменений обязательны чистый `npm ci`, `npm ls minimatch`, полный `npm audit`, lint и тесты.
