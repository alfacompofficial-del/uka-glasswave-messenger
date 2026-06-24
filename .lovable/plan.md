# Группы / Каналы / Просмотр профилей

Большая фича — разбита на 4 блока. После одобрения иду по порядку.

## 1. База данных (миграция)

**`conversations`** — добавить:
- `is_public boolean default false` — публичный (по ссылке) или приватный (только инвайт)
- `invite_slug text unique` — короткая ссылка для публичных (`/join/<slug>`)

**`conversation_members.role`** — расширить значения:
- `owner` — создатель (один на чат, нельзя кикнуть)
- `admin` — назначается владельцем
- `member` — обычный

**Storage bucket `chat-avatars`** (публичный) — фото групп/каналов.

**RPC-функции (SECURITY DEFINER):**
- `create_group_or_channel(_type, _name, _avatar_url, _is_public, _member_ids[])` → uuid — создаёт чат, добавляет владельца как `owner`, добавляет участников как `member`, генерирует `invite_slug`.
- `set_member_role(_conv, _user, _role)` — только owner может назначать/снимать admin; нельзя менять роль owner.
- `remove_member(_conv, _user)` — owner или admin могут кикать `member`; admin не может кикнуть owner/admin; owner не может быть удалён.
- `add_members(_conv, _user_ids[])` — owner/admin добавляют.
- `update_conversation(_conv, _name, _avatar_url, _is_public, _invite_slug)` — owner/admin.
- `join_by_slug(_slug)` — для публичных.
- `can_view_members(_conv, _user)` → boolean — для каналов: только owner/admin; для групп: любой участник.

RLS: переписать политики `conversation_members` через `can_view_members`, чтобы в каналах обычные подписчики не видели список других подписчиков.

## 2. Создание (флоу мастер)

Кнопка «New Group» / «New Channel» в `AppShell` (рельса слева, плюсик сверху списка чатов) → `NewChatWizard` диалог с шагами:

1. **Название** (обязательно, 1-64 символа) → Далее.
2. **Фото** (обязательно, аплоад в `chat-avatars`) → Далее.
3. **Добавить участников** (необязательно, поиск по `@username`, мульти-выбор) → Далее.
4. **Тип**: Публичный / Приватный → Создать.

После создания — редирект в `/app/<id>`.

## 3. Профиль чата (`ChatProfilePanel`)

Открывается по клику на header чата (правая выезжающая панель или модалка):

**Для direct (1-на-1):** профиль собеседника — аватар, имя, `@username`, статус, страна. Кнопки: «Написать», «Добавить в контакты».

**Для group/channel:**
- Аватар, название, описание, тип (публичный/приватный), ссылка-приглашение.
- Список участников с ролями (для каналов — только если `can_view_members`).
- Действия:
  - **Owner:** изменить фото/название/описание/тип, изменить slug, добавить людей, назначить admin, снять admin, кикнуть любого кроме себя, удалить чат.
  - **Admin:** изменить фото/название/описание, добавить людей, кикнуть `member` (не owner/admin).
  - **Member группы:** видит всех. **Member канала:** видит только owner/admins, без списка подписчиков.
- Клик по участнику → его профиль (тот же `UserProfileDialog`).

## 4. UI-изменения

- `ChatList.tsx` — иконка по типу (group/channel/direct), название группы вместо имени собеседника.
- `app.$conversationId.tsx` — кликабельный header → открывает `ChatProfilePanel`.
- Новый `UserProfileDialog` — переиспользуется в direct и в списках участников.
- Меню «New Group / New Channel» в `AppShell` (плюс над списком чатов).

## Тех. детали

- Миграция одним файлом со всеми GRANT.
- `chat-avatars` создаю через `supabase--storage_create_bucket` (публичный).
- Realtime подписка на `conversation_members` для живого обновления списка участников.
- Все формы — с валидацией (zod + react-hook-form), стиль glass/neon.

Подтвердите план — начну с миграции и бакета, потом UI.
