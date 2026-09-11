-- Migration 0005: brief (ticket #44, issue #44).
-- Brief 1:1 ikut Transaksi/Job (B2), bukan RAB. Dokumen pra-produksi,
-- bukan dokumen duit: tak menyentuh Invoice/balik modal.

CREATE TABLE brief (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaksi_id INTEGER NOT NULL UNIQUE REFERENCES transaksi(id),
  objective TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL DEFAULT '',
  dos TEXT NOT NULL DEFAULT '',
  donts TEXT NOT NULL DEFAULT '',
  lokasi TEXT NOT NULL DEFAULT '',
  talent TEXT NOT NULL DEFAULT '',
  deliverables TEXT NOT NULL DEFAULT '',
  deadline TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
