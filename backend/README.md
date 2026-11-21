# TimeCapsule Market – backend

Zero-dependency Node backend: REST API + SQLite + daily scheduler. Needs **Node 22.5+** (uses built-in `node:sqlite`).

## Run
```
cd backend
npm start            # http://127.0.0.1:3000  (serves the front end too)
npm run seed         # reset DB to demo data
npm test             # 44 tests (API, security, mock-vs-server contract)
```
Logins: `demo@timecapsule.in / demo123`, `admin@timecapsule.in / admin123`.
Test card `4242 4242 4242 4242` succeeds; a card ending `0002` is declined. COD is blocked for capsules.

## Env vars
`PORT` (3000), `HOST` (127.0.0.1), `DB_FILE`, `DEMO=0` (turn off demo clock/reset), `COOKIE_SECURE=1`, `TRUST_PROXY=1`, `REGISTER_LIMIT`.

## How it fits
- Opening the site through this server sets `window.TC_BACKEND = true`; pages then use `assets/js/api-remote.js` (real API). Opened from file:// or any static server, they fall back to the localStorage mock.
- Routes are listed once in `assets/js/api-remote.js` (shared by browser and server).
- Schema: `schema.sqlite.sql`. Emails go to the `outbox` table (no SMTP). Payments are simulated (no Razorpay).
- Scheduler: unlocks stages, delivers (+2 days), completes, sends a 1-year memory reminder. Demo buttons shift the clock.

## Not done / not tested
MySQL, real SMTP, real Razorpay, HTTPS deployment.
