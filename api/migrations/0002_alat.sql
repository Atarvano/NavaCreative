-- Migration 0002: alat + alat_servis (ticket #41).
-- Modal is derived (harga_beli + servis), never a column (G2).
-- Alat rows are never deleted, only archived via is_active (B4).

CREATE TABLE alat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  harga_beli INTEGER NOT NULL CHECK (harga_beli >= 0),
  tarif_event INTEGER NOT NULL CHECK (tarif_event >= 0),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE alat_servis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alat_id INTEGER NOT NULL REFERENCES alat(id),
  tanggal TEXT NOT NULL,
  keterangan TEXT NOT NULL DEFAULT '',
  biaya INTEGER NOT NULL CHECK (biaya >= 0)
);

CREATE INDEX idx_servis_alat ON alat_servis(alat_id);
