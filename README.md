# Раскраска (Nuxt 4)

Веб-версия детской раскраски. Проект в разработке; полный README (архитектура, модель хранения, ограничения, доступы, работа с ИИ) будет к сдаче.

## Локальный запуск

Требования: Node.js 24 (`nvm use`), pnpm 10 (`corepack enable pnpm`).

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Проверки

```bash
pnpm typecheck      # vue-tsc через nuxi
pnpm lint           # ESLint (+ границы слоёв)
pnpm lint:css       # Stylelint (mobile-first: только min-* медиа)
pnpm test           # Vitest: unit + nuxt
pnpm test:e2e       # Playwright: телефоны в альбомной ориентации, планшет, desktop
```

WebKit-проекты Playwright на Windows локально выключены: WebKit под Windows применяет системное масштабирование экрана к эмулируемому viewport. В CI (Linux) они работают; локально включаются через `PW_WEBKIT=1`.

## Структура

```
layers/core/       общая платформа: оболочка, «игровой режим», реестр игр
layers/coloring/   мини-игра «Раскраска»
shared/            типы и утилиты, общие для клиента и сервера
tests/             unit, nuxt, e2e
```

Игры регистрируются через `app.config.ts` своего слоя (`games.<id>`). Core строит навигацию по реестру и не импортирует код игр, это проверяет ESLint.
