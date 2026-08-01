CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  ip TEXT,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  path TEXT NOT NULL,
  query TEXT,
  status INTEGER,
  ua TEXT,
  referer TEXT,
  accept_language TEXT,
  cookie TEXT,
  content_type TEXT,
  body_len INTEGER,
  body TEXT,
  country TEXT,
  colo TEXT,
  as_org TEXT,
  tls_version TEXT,
  bot_score INTEGER,
  verified_bot INTEGER,
  bot_guess INTEGER NOT NULL DEFAULT 0,
  ray TEXT
);

CREATE INDEX IF NOT EXISTS idx_visits_ts ON visits(ts);
CREATE INDEX IF NOT EXISTS idx_visits_ip ON visits(ip);
CREATE INDEX IF NOT EXISTS idx_visits_bot_guess ON visits(bot_guess);
