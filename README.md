# GoalMate

**A planner for goals that take months.** Describe what you want to achieve, and GoalMate turns it into a dated plan, keeps a Notion-style notebook next to every task, gives you an AI coach that already knows the context, and tells you honestly whether you're on track.

**Backend:** Node.js 22 · Express 5 · PostgreSQL (plain SQL with `pg`) · Zod · JWT auth · Google Gemini API
**Frontend:** React 19 · Vite · Tailwind CSS · TanStack Query · BlockNote editor · Recharts

![GoalMate landing page](docs/screenshots/landing.png)

---

## What it does

- **Goals and AI roadmaps.** Describe a goal, your level and the time you have; Gemini drafts dated work sessions with steps. You edit the draft before anything is saved. Each goal shows progress against the plan.
- **Today.** Everything due today plus anything overdue, a mood check-in, your streak, and **Plan my day**: the AI picks the three tasks that matter most and says why.
- **A notebook and a coach behind every task.** Each task has steps (with *Break down with AI*), a full block-editor notes page, and a streaming chat that knows the goal, the task, its steps and your notes.
- **Journal.** Daily entries with a mood, notes pages and saved weekly reviews, with AI writing help inside the editor.
- **Insights.** A year-long heatmap, streaks, planned vs. done by week, mood next to output, the hours you work best, and each goal against its plan. An AI **weekly review** reads your tasks and journal together.
- **And the details.** Calendar with drag-to-reschedule, command palette (`Ctrl K`), dark mode, Undo and a 30-day Trash, JSON import/export (including files from the original v1 app), and a one-click demo workspace with three months of sample data.

| Today | Task notes | Insights |
| --- | --- | --- |
| ![Today](docs/screenshots/today.png) | ![Task notes](docs/screenshots/task-notes.png) | ![Insights](docs/screenshots/insights.png) |

---

## Backend architecture

```
Browser (React)
   │  JSON over HTTP, chat answers as Server-Sent Events
   ▼
Express app (server/src/app.js)
   │  helmet → JSON body → cookies → readSession → requireAuth → router → error handler
   ▼
routes/     HTTP only: validate input with Zod, call a service, send JSON
   ▼
services/   the application logic and all SQL (goals, tasks, pages, insights, ai, …)
   ▼
db/         connection pool, transaction helper, migrations
   ▼
PostgreSQL                         ai/ → Gemini REST API
```

Every request goes through the same small pipeline:

1. **`readSession`** verifies the JWT in the `gm_session` httpOnly cookie and sets `req.userId`.
2. **`requireAuth`** rejects anything under `/api` (except auth and health) without a user.
3. The **route** validates the body or query string with a Zod schema. A bad request becomes a `400` naming the field.
4. The **service** runs parameterised SQL (`$1, $2 …`, never string-concatenated input). Every query is scoped to `user_id`, so one user can never read another's data.
5. Anything thrown (a `HttpError`, an `AiError`, a Postgres constraint error) reaches **one error handler**, which turns it into a JSON response with the right status. Express 5 forwards errors from `async` handlers automatically.

### Database

Six tables, created by `server/src/db/migrations/001_initial_schema.sql`:

| Table | Holds | Notes |
| --- | --- | --- |
| `users` | accounts | case-insensitive unique email (`UNIQUE INDEX … (lower(email))`), bcrypt hash, `is_demo` flag |
| `goals` | goals | `TEXT[]` tags, `DATE` start/target, `position` for drag-and-drop order, soft delete (`deleted_at`) |
| `tasks` | tasks and their steps | `goal_id` NULL = Inbox; `parent_id` makes a step; `completed_at` NULL = open |
| `pages` | journal entries, notes, reviews | editor document in `JSONB`, extracted `plain_text` for search and AI; at most one notes page per task (partial unique index) |
| `messages` | AI coach chats | `thread` = `task:<id>`, `page:<id>` or `goal:<id>` |
| `activity` | the "recent activity" feed | identity primary key |

Foreign keys use `ON DELETE CASCADE`, so deleting an account removes everything it owns. `CHECK` constraints keep invalid values (a priority of "urgent", a mood of 9) out even if the application had a bug.

SQL worth pointing out:

- **Goal progress in one query.** Each goal's task count, done count, overdue count and next task come from `LATERAL` subqueries with `COUNT(*) FILTER (WHERE …)` (`services/goals.js`), instead of one query per goal.
- **Time-zone-correct statistics.** Streaks, the heatmap and "done today" group completions by the user's local day: `(completed_at + make_interval(mins => 330))::date` (`services/insights.js`). A task finished at 11:30 pm in India counts for that day, not the next UTC day.
- **Transactions for multi-step writes.** Creating a goal with its tasks, completing a task (which also completes its steps and logs activity), signing up for the demo and importing a file each run inside `transaction()`: all or nothing.
- **Batch inserts.** The demo workspace (≈200 rows) is written with one multi-row `INSERT` per table, so it's created in about 30 ms locally and stays fast on a hosted database.
- **Drag-and-drop ordering** saves a whole list in one statement with `unnest($1::text[]) WITH ORDINALITY`.
- **Migrations.** A small runner (`db/migrate.js`) applies new `.sql` files in order at startup and records them in `schema_migrations`.

### AI layer

`server/src/ai/gemini.js` is a small REST client written for this project (no SDK):

- **Model fallback.** Each request walks a list of Gemini models. A model that is retired, overloaded or out of free quota is skipped for a while, and the model that answered last is tried first. The first version of this app broke when Google shut down the model it hard-coded.
- **Two tiers.** *Fast* (Flash-Lite first, about 1–2 s) for chat, step suggestions, Plan my day and writing help. *Smart* (full Flash first) for roadmaps and weekly reviews, with a 20-second budget before the Lite models take over.
- **Structured output.** Roadmaps, plans and reviews ask for JSON matching a schema; `services/ai.js` then cleans it: dates clamped to the plan, "Week 1:" prefixes stripped, invented task ids dropped.
- **Streaming.** Chat answers are streamed to the browser as Server-Sent Events and saved per thread.
- **Honest errors.** No key, a rejected key and an exhausted quota each reach the UI as a clear message. The app never fakes an answer.

### Security

bcrypt password hashes · JWT in an httpOnly, `SameSite=Lax` cookie (Secure in production) · Zod validation on every input · parameterised SQL · rate limits on auth (30 per 15 min) and AI (20 per minute per user) · Helmet headers and a strict Content-Security-Policy in production · the Gemini key is only ever sent in a request header.

---

## Getting started

Requires **Node.js 22+** and **PostgreSQL 14+**.

**1. Install PostgreSQL** (Windows: `winget install PostgreSQL.PostgreSQL.17`, macOS: `brew install postgresql@17`) and create a user and database for the app:

```bash
psql -U postgres -c "CREATE ROLE goalmate LOGIN PASSWORD 'goalmate';" -c "CREATE DATABASE goalmate OWNER goalmate;"
```

**2. Install dependencies**

```bash
npm install
```

**3. Configure.** Copy `.env.example` to `.env`. The default `DATABASE_URL` matches step 1. Add a free Gemini key from [Google AI Studio](https://aistudio.google.com/app/apikey); everything except the AI features works without one.

**4. Run**

```bash
npm run dev
```

Open http://localhost:5000. One server runs the API and the React app (with hot reload). Tables are created automatically on first start.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | API + React app with hot reload; the server restarts when server code changes |
| `npm run build` | Builds the React app into `dist/` |
| `npm start` | Production server: API + the built app |
| `npm run db:reset` | Drops all GoalMate tables and recreates the empty schema (local development) |
| `npm run test:e2e` | Headless-Chrome test of the main flows against a running server (`BASE=http://localhost:5000`) |

### Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | `postgres://user:password@host:5432/database`. For hosted databases add `?sslmode=verify-full` |
| `GEMINI_API_KEY` | for AI features | Free key from Google AI Studio |
| `GEMINI_MODEL` | no | Put one model first in both fallback lists (see `server/src/config.js`) |
| `JWT_SECRET` | in production | Signs login cookies. Locally, a random one is generated into `.jwt-secret` |
| `PORT` | no | Defaults to `5000` |

## Deploy (free): Neon + Render

1. **Database:** create a free project on [Neon](https://neon.tech) and copy its connection string. Change `sslmode=require` at the end to `sslmode=verify-full`.
2. **App:** push this repository to GitHub. On [Render](https://render.com) choose **New → Blueprint** and select the repository; `render.yaml` describes the service. When asked, paste the Neon URL as `DATABASE_URL` and your Gemini key as `GEMINI_API_KEY`. `JWT_SECRET` is generated for you.
3. The first start creates the tables. Render's free plan sleeps after 15 minutes without traffic, so the first request after a pause takes a little longer.

## Project structure

```
server/src/
  index.js              entry: migrations, hourly clean-up, Vite (dev) or static files (prod), listen
  app.js                middleware order, routers, the error handler
  config.js             environment variables, Gemini model lists
  db/
    pool.js             pg connection pool, query helpers, transaction(), insertRows()
    migrate.js          applies migrations/*.sql once each, in order
    migrations/         001_initial_schema.sql
  lib/                  auth (bcrypt + JWT cookie), HttpError + Zod parse, dates, ids, shared schemas, editor-text helpers
  routes/               auth, goals, tasks, pages, ai, insights, misc (search, trash, import/export)
  services/             goals, tasks, pages, users, insights, ai, data, search, trash, activity, housekeeping,
                        mappers (row → API object), rows (row builders for inserts)
  ai/                   gemini.js (client), prompts.js (prompts + JSON schemas)
  seed/demo.js          the demo workspace
  scripts/reset-db.js   npm run db:reset
client/src/             React app: pages, components, API client and React Query hooks
shared/types.js         goal colours + JSDoc descriptions of every API object
scripts/e2e.mjs         end-to-end test
render.yaml             Render deployment blueprint
```

## API overview

All routes are under `/api`, JSON in and out, authenticated by the session cookie.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/signup` · `POST /auth/login` · `POST /auth/demo` · `POST /auth/logout` · `GET/PATCH/DELETE /auth/me` · `POST /auth/password` |
| Goals | `GET/POST /goals` · `POST /goals/reorder` · `GET/PATCH/DELETE /goals/:id` · `POST /goals/:id/restore` · `DELETE /goals/:id/permanent` |
| Tasks | `GET/POST /tasks` · `POST /tasks/reorder` · `GET/PATCH/DELETE /tasks/:id` · `POST /tasks/:id/subtasks` · `POST /tasks/:id/page` · `POST /tasks/:id/restore` |
| Journal | `GET/POST /pages` · `POST /pages/daily` · `GET/PATCH/DELETE /pages/:id` · `POST /pages/:id/restore` · `DELETE /pages/:id/permanent` |
| AI | `GET /ai/status` · `POST /ai/roadmap` · `POST /ai/breakdown` · `POST /ai/chat` (SSE) · `GET/DELETE /ai/threads/:thread` · `POST /ai/plan-day` · `POST /ai/weekly-review` · `POST /ai/write` |
| Other | `GET /insights` · `GET /search` · `GET/DELETE /trash` · `GET /data/export` · `POST /data/import` · `GET /health` |

## Author

Yuvraj Malethia, B.E. Computer Science Engineering, Thapar Institute of Engineering and Technology.
