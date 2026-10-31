# Локальный security-патч deepmerge

Основа: upstream `deepmerge@4.3.1` (MIT, оригинальная лицензия сохранена).
Версия `4.3.2-pip.0` обозначает локальный патч Plus In Plus, а не upstream-релиз.

Исправление перенесено из публичного PR TehShrike/deepmerge#274 для
CVE-2026-93753 / GHSA-gcqx-w48m-w2h4: ключ `__proto__` отклоняется по имени
и при копировании target, и при merge source. Это закрывает обходы через
null-prototype target, null/primitive placeholder и собственный `__proto__`.
Остальная логика библиотеки не менялась. Патч применён к Node/CJS/UMD-сборкам.

Поведенческие regression-тесты: `tests/dependency-security.test.cjs`.
При появлении официального исправленного релиза vendor-пакет и override нужно
заменить на upstream после повторного audit и полного regression.
