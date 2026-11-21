-- TimeCapsule Market schema (SQLite dialect, used by the running server).
-- schema.mysql.sql is generated from this file by `node tools/make-mysql.js`.
-- Money is stored as whole rupees (INTEGER). Dates are 'YYYY-MM-DD' text, timestamps are ISO-8601 text.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          VARCHAR(80)  NOT NULL,
  email         VARCHAR(190) NOT NULL UNIQUE,
  phone         VARCHAR(20)  NOT NULL DEFAULT '',
  password_hash VARCHAR(200) NOT NULL,
  role          VARCHAR(10)  NOT NULL DEFAULT 'customer',
  created_at    VARCHAR(30)  NOT NULL
);

CREATE TABLE sessions (
  token_hash VARCHAR(64) PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE settings (
  k VARCHAR(40) PRIMARY KEY,
  v VARCHAR(200) NOT NULL
);

CREATE TABLE occasions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  slug    VARCHAR(60)  NOT NULL UNIQUE,
  name    VARCHAR(80)  NOT NULL,
  tagline VARCHAR(160) NOT NULL DEFAULT '',
  emoji   VARCHAR(16)  NOT NULL DEFAULT '',
  color   VARCHAR(9)   NOT NULL DEFAULT '#2b4be0',
  ink     VARCHAR(9)   NOT NULL DEFAULT '#ffffff'
);

CREATE TABLE vendors (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_name     VARCHAR(80)  NOT NULL,
  contact_email VARCHAR(190) NOT NULL DEFAULT '',
  city          VARCHAR(60)  NOT NULL DEFAULT ''
);

CREATE TABLE products (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL,
  name      VARCHAR(120) NOT NULL,
  price     INTEGER NOT NULL CHECK (price > 0),
  stock     INTEGER NOT NULL CHECK (stock >= 0),
  emoji     VARCHAR(16)  NOT NULL DEFAULT '',
  tint      VARCHAR(9)   NOT NULL DEFAULT '#e6ebfd',
  blurb     VARCHAR(300) NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE product_tags (
  product_id INTEGER NOT NULL,
  tag        VARCHAR(40) NOT NULL,
  PRIMARY KEY (product_id, tag),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE INDEX idx_tags_tag ON product_tags(tag);

CREATE TABLE collections (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  occasion_id INTEGER NOT NULL,
  title       VARCHAR(120) NOT NULL,
  blurb       VARCHAR(300) NOT NULL DEFAULT '',
  FOREIGN KEY (occasion_id) REFERENCES occasions(id)
);

CREATE TABLE collection_products (
  collection_id INTEGER NOT NULL,
  product_id    INTEGER NOT NULL,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, product_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE quiz_questions (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  position INTEGER NOT NULL,
  question VARCHAR(200) NOT NULL
);

-- each option carries exactly one of: tag, occasion_id, budget
CREATE TABLE quiz_options (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  label       VARCHAR(120) NOT NULL,
  tag         VARCHAR(40),
  occasion_id INTEGER,
  budget      INTEGER,
  FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

CREATE TABLE recipients (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL,
  name      VARCHAR(80)  NOT NULL,
  relation  VARCHAR(60)  NOT NULL DEFAULT '',
  interests VARCHAR(200) NOT NULL DEFAULT '',
  birthday  VARCHAR(10)  NOT NULL DEFAULT '',
  email     VARCHAR(190) NOT NULL DEFAULT '',
  address   VARCHAR(300) NOT NULL DEFAULT '',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE capsules (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id         INTEGER NOT NULL,
  recipient_id     INTEGER,
  occasion_id      INTEGER,
  title            VARCHAR(120) NOT NULL,
  type             VARCHAR(10)  NOT NULL DEFAULT 'solo',
  status           VARCHAR(12)  NOT NULL DEFAULT 'draft',
  share_token      VARCHAR(40) UNIQUE,
  recipient_token  VARCHAR(40) NOT NULL UNIQUE,
  target_amount    INTEGER NOT NULL DEFAULT 0,
  funding_deadline VARCHAR(10),
  gift_wrap        INTEGER NOT NULL DEFAULT 0,
  budget           INTEGER NOT NULL DEFAULT 0,
  total_price      INTEGER NOT NULL DEFAULT 0,
  thank_you        VARCHAR(300) NOT NULL DEFAULT '',
  created_at       VARCHAR(10) NOT NULL,
  completed_at     VARCHAR(10),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES recipients(id) ON DELETE SET NULL,
  FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE SET NULL
);
CREATE INDEX idx_capsules_owner ON capsules(owner_id);
CREATE INDEX idx_capsules_status ON capsules(status);

CREATE TABLE stages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  capsule_id  INTEGER NOT NULL,
  stage_no    INTEGER NOT NULL,
  unlock_date VARCHAR(10) NOT NULL,
  status      VARCHAR(10) NOT NULL DEFAULT 'locked',
  message     VARCHAR(400) NOT NULL DEFAULT '',
  UNIQUE (capsule_id, stage_no),
  FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE
);
CREATE INDEX idx_stages_unlock ON stages(unlock_date, status);

CREATE TABLE stage_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  stage_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  UNIQUE (stage_id, product_id),
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE contributions (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  capsule_id       INTEGER NOT NULL,
  contributor_name VARCHAR(80) NOT NULL,
  amount           INTEGER NOT NULL CHECK (amount > 0),
  message          VARCHAR(240) NOT NULL DEFAULT '',
  product_id       INTEGER,
  txn_ref          VARCHAR(40) NOT NULL,
  created_at       VARCHAR(30) NOT NULL,
  refunded         INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
CREATE INDEX idx_contrib_capsule ON contributions(capsule_id);

CREATE TABLE orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  capsule_id INTEGER,
  occasion_id INTEGER,
  total      INTEGER NOT NULL,
  status     VARCHAR(12) NOT NULL DEFAULT 'placed',
  created_at VARCHAR(30) NOT NULL,
  address    VARCHAR(400) NOT NULL DEFAULT '',
  pay_mode   VARCHAR(12) NOT NULL,
  pay_status VARCHAR(12) NOT NULL,
  txn_ref    VARCHAR(40) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE SET NULL,
  FOREIGN KEY (occasion_id) REFERENCES occasions(id) ON DELETE SET NULL
);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_capsule ON orders(capsule_id);

CREATE TABLE order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  qty        INTEGER NOT NULL,
  price      INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE deliveries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id       INTEGER NOT NULL,
  stage_id       INTEGER,
  address        VARCHAR(400) NOT NULL DEFAULT '',
  scheduled_date VARCHAR(10) NOT NULL,
  status         VARCHAR(12) NOT NULL DEFAULT 'pending',
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE SET NULL
);

CREATE TABLE memory_events (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL,
  capsule_id    INTEGER NOT NULL,
  event_date    VARCHAR(10) NOT NULL,
  reminder_date VARCHAR(10) NOT NULL,
  notified      INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE
);

CREATE TABLE wishlist (
  user_id       INTEGER NOT NULL,
  collection_id INTEGER NOT NULL,
  PRIMARY KEY (user_id, collection_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
);

CREATE TABLE cart_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        VARCHAR(10) NOT NULL,
  product_id  INTEGER,
  qty         INTEGER NOT NULL DEFAULT 1,
  occasion_id INTEGER,
  capsule_id  INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (capsule_id) REFERENCES capsules(id) ON DELETE CASCADE
);

-- the demo "inbox": every email the scheduler would send
CREATE TABLE outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER,
  to_addr    VARCHAR(190) NOT NULL,
  subject    VARCHAR(200) NOT NULL,
  body       VARCHAR(600) NOT NULL,
  link       VARCHAR(200),
  kind       VARCHAR(12) NOT NULL DEFAULT 'info',
  created_at VARCHAR(30) NOT NULL
);
