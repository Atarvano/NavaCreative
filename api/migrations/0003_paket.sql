-- Migration 0003: paket + paket_baris + seed 4 paket Excel (ticket #42).
-- Paket = template rincian (Q12): rows grouped by kategori (Q23), each row
-- a jenis alat|jasa|biaya (Q13) with qty units (G1) + free-text satuan.
-- Seed numbers are as-is from the Excel (Y2), anomalies included:
-- FDR AX-40 @150rb in Paket 2 (vs 100rb elsewhere), Intercom @200rb in
-- Paket 1 (vs 250rb elsewhere). Correct later if the team confirms typos.
-- harga_satuan = unit rate: HARGA column / BANYAK (e.g. OPERATOR 2 ORANG
-- 500rb total = 250rb/orang; WIRLES VIDEO x2 500rb = 250rb/unit).

CREATE TABLE paket (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  deskripsi TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE paket_baris (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paket_id INTEGER NOT NULL REFERENCES paket(id),
  kategori TEXT NOT NULL DEFAULT 'PRODUCTION',
  jenis TEXT NOT NULL CHECK (jenis IN ('alat', 'jasa', 'biaya')),
  alat_id INTEGER REFERENCES alat(id),
  nama TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  satuan TEXT NOT NULL DEFAULT '',
  harga_satuan INTEGER NOT NULL CHECK (harga_satuan >= 0)
);

CREATE INDEX idx_paket_baris_paket ON paket_baris(paket_id);

-- Paket 1 Camera: total 1.415.000
INSERT INTO paket (id, nama, deskripsi) VALUES (1, 'Paket 1 Camera', 'Live streaming 1 kamera');
INSERT INTO paket_baris (paket_id, kategori, jenis, nama, qty, satuan, harga_satuan) VALUES
  (1, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 100000),
  (1, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000),
  (1, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 1, 'Unit', 250000),
  (1, 'PRODUCTION', 'alat', 'STOP KONTAK', 1, 'Unit', 15000),
  (1, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 200000),
  (1, 'PRODUCTION', 'jasa', 'OPERATOR', 2, 'Orang', 250000),
  (1, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000),
  (1, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000);

-- Paket 2 Camera: total 2.380.000 (FDR AX-40 @150rb = anomali Y2, as-is)
INSERT INTO paket (id, nama, deskripsi) VALUES (2, 'Paket 2 Camera', 'Live streaming 2 kamera');
INSERT INTO paket_baris (paket_id, kategori, jenis, nama, qty, satuan, harga_satuan) VALUES
  (2, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 150000),
  (2, 'PRODUCTION', 'alat', 'SONY NXR-100', 1, 'Unit', 350000),
  (2, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000),
  (2, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 2, 'Unit', 250000),
  (2, 'PRODUCTION', 'alat', 'STOP KONTAK', 2, 'Unit', 15000),
  (2, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 250000),
  (2, 'PRODUCTION', 'jasa', 'OPERATOR', 3, 'Orang', 250000),
  (2, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000),
  (2, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000);

-- Paket 3 Camera: total 3.495.000
INSERT INTO paket (id, nama, deskripsi) VALUES (3, 'Paket 3 Camera', 'Live streaming 3 kamera');
INSERT INTO paket_baris (paket_id, kategori, jenis, nama, qty, satuan, harga_satuan) VALUES
  (3, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 100000),
  (3, 'PRODUCTION', 'alat', 'SONY NXR-100', 2, 'Unit', 350000),
  (3, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000),
  (3, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 3, 'Unit', 250000),
  (3, 'PRODUCTION', 'alat', 'STOP KONTAK', 3, 'Unit', 15000),
  (3, 'PRODUCTION', 'alat', 'SWITCHER', 1, 'Unit', 300000),
  (3, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 250000),
  (3, 'PRODUCTION', 'jasa', 'OPERATOR', 4, 'Orang', 250000),
  (3, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000),
  (3, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000);

-- Paket 4 Camera: total 4.110.000
INSERT INTO paket (id, nama, deskripsi) VALUES (4, 'Paket 4 Camera', 'Live streaming 4 kamera');
INSERT INTO paket_baris (paket_id, kategori, jenis, nama, qty, satuan, harga_satuan) VALUES
  (4, 'PRODUCTION', 'alat', 'SONY FDR AX-40', 1, 'Unit', 100000),
  (4, 'PRODUCTION', 'alat', 'SONY NXR-100', 3, 'Unit', 350000),
  (4, 'PRODUCTION', 'alat', 'TRIPOD B-18', 1, 'Unit', 50000),
  (4, 'PRODUCTION', 'alat', 'WIRLES VIDEO', 3, 'Unit', 250000),
  (4, 'PRODUCTION', 'alat', 'STOP KONTAK', 4, 'Unit', 15000),
  (4, 'PRODUCTION', 'alat', 'SWITCHER', 1, 'Unit', 300000),
  (4, 'PRODUCTION', 'alat', 'INTERCOM SOLID SE 5S GLOBAL', 1, 'Unit', 250000),
  (4, 'PRODUCTION', 'jasa', 'OPERATOR', 5, 'Orang', 250000),
  (4, 'LOGISTIK', 'biaya', 'INTERNET', 1, 'Sesi', 150000),
  (4, 'MISC', 'biaya', 'OPERASIONAL LAIN', 1, 'Sesi', 150000);
