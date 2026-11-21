/* ==========================================================================
   TC.api, real-backend edition.
   In the browser this replaces the localStorage mock (api.js) with fetch('/api/...') calls, but only when the
   page was served by the Node backend (it serves /assets/js/config.js with window.TC_BACKEND = true).
   Opened from a plain file or a static server, config.js does not exist and the mock keeps working.

   The same file is loaded by the Node server (require) to get the ROUTES table, so the client and the server
   can never disagree about a URL.

   ROUTES entry: [function name, HTTP method, path, argument names, name of the argument that is the whole body/query]
   ========================================================================== */
(function (root) {
  "use strict";

  const ROUTES = [
    /* auth */
    ["me", "GET", "/api/auth/me", []],
    ["login", "POST", "/api/auth/login", ["email", "password"]],
    ["register", "POST", "/api/auth/register", ["body"], "body"],
    ["logout", "POST", "/api/auth/logout", []],
    /* catalogue and quiz (public) */
    ["occasions", "GET", "/api/occasions", []],
    ["occasion", "GET", "/api/occasions/:slugOrId", ["slugOrId"]],
    ["collections", "GET", "/api/collections", ["q"], "q"],
    ["collection", "GET", "/api/collections/:id", ["id"]],
    ["products", "GET", "/api/products", ["q"], "q"],
    ["product", "GET", "/api/products/:id", ["id"]],
    ["quiz", "GET", "/api/quiz", []],
    ["score", "POST", "/api/quiz/score", ["answers"], "answers"],
    ["suggest", "POST", "/api/quiz/suggest", ["answers"], "answers"],
    /* recipients */
    ["recipients", "GET", "/api/recipients", []],
    ["saveRecipient", "POST", "/api/recipients", ["r"], "r"],
    ["deleteRecipient", "DELETE", "/api/recipients/:id", ["id"]],
    /* capsules */
    ["capsules", "GET", "/api/capsules", []],
    ["capsule", "GET", "/api/capsules/:id", ["id"]],
    ["newCapsule", "POST", "/api/capsules", ["o"], "o"],
    ["buildFromQuiz", "POST", "/api/capsules/from-quiz", ["answers", "o"]],
    ["capsuleFromCollection", "POST", "/api/capsules/from-collection/:collection_id", ["collection_id"]],
    ["updateCapsule", "PATCH", "/api/capsules/:id", ["id", "patch"], "patch"],
    ["deleteCapsule", "DELETE", "/api/capsules/:id", ["id"]],
    ["addStage", "POST", "/api/capsules/:id/stages", ["id"]],
    ["removeStage", "DELETE", "/api/capsules/:id/stages/:stageNo", ["id", "stageNo"]],
    ["updateStage", "PATCH", "/api/capsules/:id/stages/:stageNo", ["id", "stageNo", "patch"], "patch"],
    ["addItem", "POST", "/api/capsules/:id/stages/:stageNo/items", ["id", "stageNo", "productId", "qty"]],
    ["setItemQty", "PUT", "/api/capsules/:id/stages/:stageNo/items/:productId", ["id", "stageNo", "productId", "qty"]],
    ["moveItem", "POST", "/api/capsules/:id/move-item", ["id", "fromStage", "productId", "toStage"]],
    ["startFunding", "POST", "/api/capsules/:id/funding", ["id", "deadline"]],
    ["cancelCapsule", "POST", "/api/capsules/:id/cancel", ["id"]],
    ["repeatCapsule", "POST", "/api/capsules/:id/repeat", ["id", "mode"]],
    /* cart and orders */
    ["cart", "GET", "/api/cart", []],
    ["addProductToCart", "POST", "/api/cart/products", ["productId", "qty", "occasionId"]],
    ["addCapsuleToCart", "POST", "/api/cart/capsules", ["id"]],
    ["setCartQty", "PUT", "/api/cart/lines/:idx", ["idx", "qty"]],
    ["removeCartLine", "DELETE", "/api/cart/lines/:idx", ["idx"]],
    ["placeOrder", "POST", "/api/orders", ["body"], "body"],
    ["orders", "GET", "/api/orders", []],
    ["order", "GET", "/api/orders/:id", ["id"]],
    /* group funding */
    ["group", "GET", "/api/capsules/:id/group", ["id"]],
    ["topUp", "POST", "/api/capsules/:id/topup", ["id", "amount"]],
    ["publicGroup", "GET", "/api/public/groups/:tok", ["tok"]],
    ["contribute", "POST", "/api/public/groups/:tok/contributions", ["tok", "body"], "body"],
    ["recipientView", "GET", "/api/public/recipient/:tok", ["tok"]],
    ["thankYou", "POST", "/api/public/recipient/:tok/thank-you", ["tok", "text"]],
    /* account */
    ["timeline", "GET", "/api/timeline", []],
    ["wishlist", "GET", "/api/wishlist", []],
    ["toggleWishlist", "POST", "/api/wishlist/:collection_id/toggle", ["collection_id"]],
    ["mailbox", "GET", "/api/mailbox", []],
    /* admin */
    ["adminStats", "GET", "/api/admin/stats", []],
    ["adminProducts", "GET", "/api/admin/products", []],
    ["adminVendors", "GET", "/api/admin/vendors", []],
    ["adminSaveProduct", "POST", "/api/admin/products", ["p"], "p"],
    ["adminDeleteProduct", "DELETE", "/api/admin/products/:id", ["id"]],
    ["adminCollections", "GET", "/api/admin/collections", []],
    ["adminSaveCollection", "POST", "/api/admin/collections", ["c"], "c"],
    ["adminDeleteCollection", "DELETE", "/api/admin/collections/:id", ["id"]],
    ["adminSaveQuizOption", "POST", "/api/admin/quiz/:qid/options", ["qid", "opt"], "opt"],
    ["adminDeleteQuizOption", "DELETE", "/api/admin/quiz/:qid/options/:oid", ["qid", "oid"]],
    ["adminOrders", "GET", "/api/admin/orders", []],
    ["adminSetOrderStatus", "PATCH", "/api/admin/orders/:id/status", ["id", "status"]],
    ["adminCapsules", "GET", "/api/admin/capsules", []],
  ].map(([name, method, path, args, bodyArg]) => ({ name, method, path, args, bodyArg: bodyArg || null }));

  /* ---------- Node: just hand over the table ---------- */
  if (typeof module !== "undefined" && module.exports) { module.exports = { ROUTES }; return; }

  /* ---------- browser: install only when the Node backend served this page ---------- */
  if (!root.TC_BACKEND) return;
  root.TC = root.TC || {};

  const pad = (n) => String(n).padStart(2, "0");
  const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  /* synchronous answers the pages need while rendering, refreshed from /api/bootstrap and from the calls that change them */
  const cache = { today: localToday(), clock: 0, cartCount: 0, wishlist: [] };

  async function send(route, argv) {
    const params = {};
    route.args.forEach((n, i) => { if (argv[i] !== undefined) params[n] = argv[i]; });
    const isGet = route.method === "GET";
    const url = route.path.replace(/:([A-Za-z_]+)/g, (_, k) => {
      const v = params[k];
      delete params[k];
      return encodeURIComponent(v === undefined || v === null ? "" : v);
    });
    const opts = { method: route.method, credentials: "same-origin", headers: { "X-TC-Client": "1", Accept: "application/json" } };
    let full = url;
    let payload = route.bodyArg ? params[route.bodyArg] || {} : params;
    if (isGet) {
      const qs = new URLSearchParams();
      Object.keys(payload || {}).forEach((k) => { if (payload[k] !== undefined && payload[k] !== null && payload[k] !== "") qs.set(k, String(payload[k])); });
      if ([...qs].length) full += "?" + qs.toString();
    } else if (route.method !== "DELETE" || Object.keys(payload).length) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(payload);
    }
    let res;
    try { res = await fetch(full, opts); } catch (e) { throw new Error("Could not reach the server. Check that it is running and try again."); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty or non-JSON body */ }
    if (!res.ok) throw new Error((data && data.error) || "Something went wrong. Please try again.");
    return data;
  }

  const api = {};
  const after = {
    cart: (r) => { cache.cartCount = r.lines.length; },
    addProductToCart: (r) => { cache.cartCount = r.lines.length; },
    addCapsuleToCart: (r) => { cache.cartCount = r.lines.length; },
    setCartQty: (r) => { cache.cartCount = r.lines.length; },
    removeCartLine: (r) => { cache.cartCount = r.lines.length; },
    placeOrder: () => { cache.cartCount = 0; },
    deleteCapsule: () => { /* a deleted draft also leaves the cart; the next bootstrap corrects the count */ },
    logout: () => { cache.cartCount = 0; cache.wishlist = []; },
    toggleWishlist: (r, a) => {
      const id = Number(a[0]);
      cache.wishlist = cache.wishlist.filter((x) => x !== id);
      if (r) cache.wishlist.push(id);
    },
  };
  ROUTES.forEach((route) => {
    api[route.name] = async (...argv) => {
      const out = await send(route, argv);
      if (after[route.name]) after[route.name](out, argv);
      return out;
    };
  });

  /* the calls the mock answers synchronously */
  async function bootstrap() {
    const b = await fetch("/api/bootstrap", { credentials: "same-origin", headers: { "X-TC-Client": "1", Accept: "application/json" } })
      .then((r) => r.json()).catch(() => { throw new Error("Could not reach the server. Check that it is running and try again."); });
    cache.today = b.today; cache.clock = b.clock_offset; cache.cartCount = b.cart_count; cache.wishlist = b.wishlist_ids;
    return b.events || [];
  }
  const demo = (path, body) => fetch(path, { method: "POST", credentials: "same-origin", headers: { "X-TC-Client": "1", "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
    .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && d.error) || "Demo controls are switched off on this server."); return d; });

  api.boot = bootstrap;
  api.today = () => cache.today;
  api.clockOffset = () => cache.clock;
  api.cartCount = () => cache.cartCount;
  api.wishlistIds = () => cache.wishlist.slice();
  api.advanceDays = async (n) => { const r = await demo("/api/demo/advance", { days: Number(n) }); cache.clock = r.clock_offset; return r.events; };
  api.resetClock = async () => { await demo("/api/demo/reset-clock"); cache.clock = 0; return []; };
  api.resetDemo = async () => { await demo("/api/demo/reset"); return true; };
  api.isRemote = true;

  if (root.TC.api && !root.TC.mockApi) root.TC.mockApi = root.TC.api;
  root.TC.api = api;
})(typeof window !== "undefined" ? window : globalThis);
