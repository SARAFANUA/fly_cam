-- server/db/schema.sql

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;

CREATE TABLE IF NOT EXISTS cameras (
  camera_id TEXT PRIMARY KEY,

  oblast TEXT,
  camera_name TEXT,
  install_date TEXT,

  video_signal_type TEXT,
  storage_type TEXT,
  video_archive_days INTEGER,
  fixations_archive_days INTEGER,

  camera_form_factor TEXT,
  license_type TEXT,
  analytics_object TEXT,
  functionality_desc TEXT,

  manufacturer TEXT,
  owner_name TEXT,
  owner_edrpou TEXT,
  owner_reg_address TEXT,

  contact_person TEXT,
  contact_phone TEXT,

  camera_status TEXT,
  integration_status TEXT,
  integrated_systems TEXT,
  integrated_npu_platform TEXT,
  integrated_harpun TEXT,
  ka_access TEXT,

  lat REAL,
  lon REAL,

  object_affiliation TEXT,
  object_type TEXT,
  azimuth REAL,

  raion TEXT,
  hromada TEXT,
  katottg TEXT,

  settlement_type TEXT,
  settlement_name TEXT,
  street_type TEXT,
  street_name TEXT,
  building_number TEXT,
  cross_street TEXT,

  highway_number TEXT,
  kilometer REAL,

  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  source TEXT,
  sheet_id TEXT,
  tab_name TEXT,
  last_sync_at TEXT,
  rows_upserted INTEGER
);


INSERT OR IGNORE INTO sync_state (id, source, sheet_id, tab_name, last_sync_at, rows_upserted)
VALUES (1, NULL, NULL, NULL, NULL, 0);

CREATE INDEX IF NOT EXISTS idx_cameras_oblast ON cameras(oblast);
CREATE INDEX IF NOT EXISTS idx_cameras_raion ON cameras(raion);
CREATE INDEX IF NOT EXISTS idx_cameras_hromada ON cameras(hromada);
CREATE INDEX IF NOT EXISTS idx_cameras_katottg ON cameras(katottg);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON cameras(camera_status);
CREATE INDEX IF NOT EXISTS idx_cameras_integration_status ON cameras(integration_status);
CREATE INDEX IF NOT EXISTS idx_cameras_lat_lon ON cameras(lat, lon);

CREATE TABLE IF NOT EXISTS katottg_regions (
  katottg TEXT PRIMARY KEY,
  oblast TEXT,
  raion TEXT,
  hromada TEXT
);

CREATE INDEX IF NOT EXISTS idx_katottg_regions_oblast ON katottg_regions(oblast);
CREATE INDEX IF NOT EXISTS idx_katottg_regions_raion ON katottg_regions(raion);
CREATE INDEX IF NOT EXISTS idx_katottg_regions_hromada ON katottg_regions(hromada);
