# TimeCapsule Market (front end)

Gifts that unfold over time. Shop by occasion, split a gift into stages that open on dates you choose, and let friends chip in through one link.

This is the **front end**. It runs on its own: every page works against a mock API (`assets/js/api.js`) that stores data in the browser. The Node + Express + MySQL backend replaces that one file later.

## Run it

- **Quickest:** open `index.html` in Chrome or Edge.
- **Better (works in every browser):** in this folder run `python -m http.server 5500`, then open http://localhost:5500

Firefox blocks shared storage between local files, so use the second option there.

## Demo logins

| Role | Email | Password |
|---|---|---|
| Customer | demo@timecapsule.in | demo123 |
| Admin | admin@timecapsule.in | admin123 |

The login page has buttons that fill these in. "Reset demo data" in the footer restores the starting data.

## A 5-minute demo for the viva

1. **Home:** tap the envelopes. Explain staged delivery.
2. **Gift quiz:** answer six questions. The results page shows the score for each product (3 per matching tag + 2 for the occasion + 1 for budget).
3. **Build this capsule:** log in as the customer. Edit stage dates, move items, watch the budget meter, switch on gift wrap.
4. **Group capsule:** switch "Who pays?" to Group, start funding, open the contribute link in a private window and chip in.
5. **Scheduler:** use "+30 days" in the footer. Stages open, deliveries dispatch, emails appear in the Demo mailbox, and the recipient page unlocks.
6. **Memory timeline:** completed capsules get a yearly reminder. Try Repeat and Upgrade.
7. **Admin:** products and tags, collections, quiz answers, order status, reports.

## Pages (23)

Public: `index`, `occasions`, `collection`, `product`, `quiz`, `results`, `login`, `contribute` (friends' link), `recipient` (unlock link), `mailbox`
Customer: `builder`, `cart`, `checkout`, `order`, `capsules`, `timeline`, `recipients`, `saved`, `group`
Admin: `admin`, `admin-products`, `admin-collections` (collections + quiz), `admin-orders` (orders, capsule schedule, reports)

## Folder map

```
assets/css/styles.css     design system (colours, type, components)
assets/js/data.js         seed data: occasions, products, collections, quiz
assets/js/api.js          mock backend: same functions the Express API will expose
assets/js/app.js          shared header, footer, helpers
assets/js/pages/*.js      one file per page
```

## Moving to the real backend

Every page talks to `TC.api.<function>()` and never to `localStorage` directly. To go live, keep the function names and return shapes and rewrite each one as `fetch('/api/...')`. The scoring, group funding rules and daily scheduler in `api.js` (`score`, `contribute`, `runScheduler`) are the logic to port to Node + MySQL; the schema is in the project report.

Passwords are plain text here only because this is a mock. The real backend must hash them with bcrypt.
