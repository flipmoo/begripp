-- IRIS Revenue App tabellen

-- Manual project previous consumption
CREATE TABLE IF NOT EXISTS iris_manual_project_previous_consumption (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  previous_year_budget_used REAL NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(project_id)
);

-- Manual monthly targets
CREATE TABLE IF NOT EXISTS iris_manual_monthly_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  target_amount REAL NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(year, month)
);

-- Manual monthly definite revenue
CREATE TABLE IF NOT EXISTS iris_manual_monthly_definite_revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(year, month)
);

-- Project revenue settings
CREATE TABLE IF NOT EXISTS iris_project_revenue_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  include_in_revenue INTEGER DEFAULT 1,
  notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(project_id)
);

-- KPI targets
CREATE TABLE IF NOT EXISTS iris_kpi_targets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  kpi_name TEXT NOT NULL,
  target_value REAL NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(year, kpi_name)
);

-- Final revenue
CREATE TABLE IF NOT EXISTS iris_final_revenue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  amount REAL NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(year, month)
);
