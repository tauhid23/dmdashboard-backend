# Authentication and frontend integration

Base URL: `http://localhost:5000/api` (the `/api/v1` alias also works). Every frontend request must use `credentials: "include"` / Axios `withCredentials: true`.

## Auth routes

| Method | Route | Body | Success |
|---|---|---|---|
| POST | `/auth/login` | `{ "identifier": "admin@admin.com", "password": "admin@1234" }` | `{ "user": SafeUser }` plus HttpOnly cookies |
| POST | `/auth/logout` | none | `204` |
| POST | `/auth/refresh` | none | `{ "user": SafeUser }`, rotated cookies |
| GET | `/auth/me` | none | `{ "user": SafeUser }` |
| POST | `/auth/change-password` | `{ "currentPassword": "...", "newPassword": "..." }` | message; all sessions revoked |
| POST | `/auth/forgot-password` | `{ "identifier": "email-or-username" }` | generic message (development also returns `resetToken`) |
| POST | `/auth/reset-password` | `{ "token": "...", "password": "..." }` | message; all sessions revoked |

## User and RBAC routes

| Method | Route | Permission |
|---|---|---|
| GET | `/users?search=&role=&status=&page=1&limit=20` | `user-management.view` |
| POST | `/users` | `user-management.add` |
| GET | `/users/:id` | `user-management.view` |
| PATCH | `/users/:id` | `user-management.edit` |
| DELETE | `/users/:id` | `user-management.delete` |
| POST | `/users/:id/reset-password` | `user-management.edit` |
| GET | `/roles` | `user-management.view` |
| PATCH | `/roles/:id/permissions` | `user-management.edit` |
| GET | `/permissions` | `user-management.view` |

Create user body: `{ "name":"Rafiq Hossain", "email":"rafiq@example.com", "username":"rafiq", "temporaryPassword":"TemporaryPassword123!", "role":"Teacher", "status":"Active", "permissions":{} }`.

User-list response is `{ "data": SafeUser[], "pagination": { "page":1,"limit":20,"total":0,"totalPages":0 } }`. Errors are `{ "message", "code", "errors"? }` with HTTP 401/403/404/409/422 as appropriate.

## Existing protected resources

`/students`, `/teachers`, `/class-reports`, `/exam-attempts`, and `/exam-rules` require their matching `view` permission. POST/PATCH/DELETE require `add`/`edit`/`delete` respectively.

## React/TanStack Query prompt

> Replace temporary localStorage authentication with the backend at `VITE_API_URL` (default `http://localhost:5000/api`). Create one fetch client that always sends `credentials: "include"`. Add typed functions for login, logout, refresh, me, change/forgot/reset password, users CRUD, roles and permissions using the routes in AUTH_API.md. The login response and `/auth/me` return `{ user }`; user lists return `{ data, pagination }`. Bootstrap auth with a TanStack Query `['auth','me']` query. On a 401, call POST `/auth/refresh` once and retry the original request once; never retry refresh recursively. On logout clear the query cache and navigate to `/login`. Replace `userStorage.ts` reads with the auth query/context. Protect routes using `user.permissions[resource].view`, and hide add/edit/delete controls using the corresponding action, while treating the backend as authoritative. Keep exact resource keys: `dashboard`, `students`, `teachers`, `class-reports`, `exams`, `results`, `user-management`, `settings`. Add loading state while `/auth/me` runs and redirect unauthenticated users to login. Display backend `message` and field-level `errors`; do not store cookies or tokens in JavaScript storage.

## Setup

Set `DATABASE_URL`, Cloudinary variables, `FRONTEND_ORIGIN`, `AUTH_SECRET`, and production `SUPER_ADMIN_*` values. Run `npm run prisma:generate`, `npx prisma migrate deploy`, then `npx tsx prisma/seed.ts`. The seed is idempotent and never resets an existing Super Admin password.
