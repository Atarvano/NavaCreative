-- Migration 0004: rab + rab_baris + transaksi + transaksi_baris + settings
-- (ticket #43, issue #43). Rows snapshot name/rate at creation: later master
-- edits never rewrite documents. Nomor RAB-YYYY-NNNN derived from id (B6).
-- Transaksi created by approve (rab_id set) or walk-in (rab_id NULL, #44).
-- Settings holds identity + single bank account text (Q23, M6); logo is a
-- static file (B5). No DELETE routes (M1).

CREATE TABLE rab (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nomor TEXT UNIQUE,
  nama_project TEXT NOT NULL,
  tanggal_rab TEXT NOT NULL,
  nama_client TEXT NOT NULL,
  perusahaan_client TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  diskon INTEGER NOT NULL DEFAULT 0 CHECK (diskon >= 0),
  total INTEGER NOT NULL DEFAULT 0,
  catatan TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE rab_baris (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_id INTEGER NOT NULL REFERENCES rab(id),
  kategori TEXT NOT NULL DEFAULT 'PRODUCTION',
  jenis TEXT NOT NULL CHECK (jenis IN ('alat', 'jasa', 'biaya')),
  alat_id INTEGER REFERENCES alat(id),
  nama TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  satuan TEXT NOT NULL DEFAULT '',
  harga_satuan INTEGER NOT NULL CHECK (harga_satuan >= 0)
);

CREATE INDEX idx_rab_baris_rab ON rab_baris(rab_id);

CREATE TABLE transaksi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_id INTEGER REFERENCES rab(id),
  nama_project TEXT NOT NULL,
  nama_client TEXT NOT NULL,
  perusahaan_client TEXT NOT NULL DEFAULT '',
  tanggal_mulai TEXT NOT NULL DEFAULT '',
  tanggal_selesai TEXT NOT NULL DEFAULT '',
  lokasi TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'terjadwal' CHECK (status IN ('terjadwal', 'berjalan', 'selesai', 'batal')),
  diskon INTEGER NOT NULL DEFAULT 0 CHECK (diskon >= 0),
  total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE transaksi_baris (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaksi_id INTEGER NOT NULL REFERENCES transaksi(id),
  kategori TEXT NOT NULL DEFAULT 'PRODUCTION',
  jenis TEXT NOT NULL CHECK (jenis IN ('alat', 'jasa', 'biaya')),
  alat_id INTEGER REFERENCES alat(id),
  nama TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  satuan TEXT NOT NULL DEFAULT '',
  harga_satuan INTEGER NOT NULL CHECK (harga_satuan >= 0)
);

CREATE INDEX idx_transaksi_baris_transaksi ON transaksi_baris(transaksi_id);
CREATE INDEX idx_transaksi_baris_alat ON transaksi_baris(alat_id);
CREATE INDEX idx_transaksi_tanggal ON transaksi(tanggal_mulai, tanggal_selesai, status);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);

INSERT INTO settings (key, value) VALUES
  ('nama', 'Nava Production'),
  ('hp', '085817999140'),
  ('email', 'navaproduction9@gmail.com'),
  ('bank', 'BCA'),
  ('norek', '8335463109'),
  ('atas_nama', 'Luthfi Ahmad Zaidan');
