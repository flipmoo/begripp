-- IRIS Offers tabel

-- Offers table
CREATE TABLE IF NOT EXISTS iris_offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id INTEGER NOT NULL,
  offer_name TEXT NOT NULL,
  client_id INTEGER,
  client_name TEXT,
  discr TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(offer_id)
);

-- Index voor snellere lookups
CREATE INDEX IF NOT EXISTS idx_iris_offers_offer_id ON iris_offers (offer_id);
