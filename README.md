# eplug.mn — charging network console

Admin front end for the [OCPP 1.6-J Central System](../evChargerBack). Next.js 16
(App Router) + React 19 + Tailwind 4.

```
browser ──https://eplug.mn/──► ┌──────────────┐ ──http://127.0.0.1:3000/api/──► ┌──────────┐
                               │ this console │                                 │   CSMS   │
        ◄──SSE /console-api/── └──────────────┘ ◄────SSE /api/events/stream──── └──────────┘
```

The browser never talks to the CSMS directly. Every call is proxied by this
app's own server, which attaches the JWT from an httpOnly cookie.

---

## Quick start

```bash
npm install
cp .env.example .env.local   # then point CSMS_API_URL at your backend
npm run dev                  # http://localhost:3001
```

Sign in with the admin account created by the backend's `npm run seed`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD` in its `.env`).

---

## What is in it

| Page | What it does |
|---|---|
| **Overview** | Network stats, 30-day energy chart, active sessions, connector mix, live event feed, critical security alerts |
| **Charge points** | Search/filter list; register a charge point (shows the AuthorizationKey once) |
| **Charge point detail** | Overview, connectors, cached OCPP configuration, **command console**, command log, raw OCPP message log, per-charge-point live feed |
| **Connectors** | Every connector network-wide, filterable by status |
| **Sessions** | Transaction history with date/tag/charge-point filters; detail view with a power + state-of-charge chart, raw meter values, remote stop and force-close |
| **Live feed** | Full-page SSE stream with per-event-type filters |
| **RFID tags** | CRUD, bulk paste import (up to 5000), and a dry-run authorization checker |
| **Reservations** | ReserveNow holds, with cancel |
| **Smart charging** | Installed charging profiles and their schedules |
| **Firmware & logs** | Firmware, diagnostics and security-log jobs |
| **QPay merchants** | Register a QuickQR merchant as a company or an individual (city/district pulled from QPay), list them, copy the merchant id, delete (ADMIN) |
| **Security** | Security events with acknowledgement, certificate signing requests (sign/reject), certificates, and the local CA |
| **Users** | Account management (ADMIN only) |
| **System** | Backend health, OCPP capabilities, and how to connect a charge point |

The command console covers **all 27** Central-System-to-Charge-Point commands the
backend exposes, including a raw-OCPP escape hatch. Forms are generated from
[`src/lib/commands.ts`](src/lib/commands.ts), which mirrors the backend's zod
schemas field for field — keep the two in step when the backend changes.

---

## How auth works

1. `POST /console-api/auth/login` forwards the credentials to the CSMS.
2. The returned JWT is stored in an **httpOnly, SameSite=Lax** cookie. It is
   never sent to the page, so a script injected into the console cannot read it.
3. Browser data calls go to `/console-api/csms/<backend path>`; the proxy
   re-attaches the token server-side.
4. `src/proxy.ts` (Next 16's renamed middleware) redirects signed-out visitors to
   `/login`. It deliberately does **not** verify the token — that is the
   backend's job on every request, and this app holds no `JWT_SECRET`.

Roles are enforced by the backend. The console hides what a role cannot use
(`VIEWER` sees no command console, `OPERATOR` no user management), but that is
presentation only, not the security boundary.

> **Route prefix:** the console's own handlers live under `/console-api/`, not
> `/api/`, so they never collide with the CSMS's `/api/` when both are served
> from `eplug.mn`.

---

## Configuration

| Variable | Meaning |
|---|---|
| `CSMS_API_URL` | Backend origin. Server-side only — keep it on loopback. |
| `CSMS_API_BASE_PATH` | Must match the backend's `API_BASE_PATH` (default `/api`). |
| `CSMS_API_KEY` | Optional fallback for machine access. A value here grants ADMIN — normally leave empty. |
| `SESSION_COOKIE_NAME` | Session cookie name (default `eplug_session`). |
| `COOKIE_SECURE` | `false` only for local `http://` development. |
| `NEXT_PUBLIC_BRAND_*` | Name and domain shown in the UI. |

`.env.local` overrides `.env.production` in every environment, so do not ship a
`.env.local` to the server.

---

## Deploying on eplug.mn

The console runs on `127.0.0.1:3001` and nginx serves it at the domain root,
alongside the API on `/api/` and charge points on `/ocpp/`. The site config lives
in the backend repo: [`deploy/nginx-eplug.mn.conf`](../evChargerBack/deploy/nginx-eplug.mn.conf).

```bash
npm ci
cp .env.example .env.production   # set COOKIE_SECURE=true
npm run build
npm run start                     # listens on 3001
```

`/etc/systemd/system/eplug-admin.service`:

```ini
[Unit]
Description=eplug.mn admin console
After=network.target csms.service

[Service]
Type=simple
User=csms
WorkingDirectory=/opt/eplug-admin
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now eplug-admin
```

Two things nginx must get right, both already in the bundled config:

- `/console-api/stream` needs `proxy_buffering off`, or live events arrive in clumps.
- `COOKIE_SECURE=true` requires the console to be reached over HTTPS, otherwise
  the browser drops the session cookie and login appears to silently fail.

---

## Project layout

```
src/
  proxy.ts                     route gating (Next 16 middleware)
  app/
    login/                     sign-in page
    (app)/                     authenticated shell + every page
    console-api/
      auth/login|logout        session cookie lifecycle
      csms/[...path]           REST proxy to the CSMS
      stream                   SSE proxy
  components/
    ui/                        design-system primitives
    shell/                     sidebar, topbar, app shell
    charts/                    recharts wrappers
  lib/
    commands.ts                the 27 OCPP command definitions
    types.ts                   backend response types
    server-api.ts              server-side CSMS client
    client.ts                  browser client (via the proxy)
    use-live-events.ts         SSE subscription hook
```

## Checks

```bash
npm run typecheck && npx eslint src && npm run build
```
