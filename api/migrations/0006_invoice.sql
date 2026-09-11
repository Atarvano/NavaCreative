-- Migration 0006: invoice + pembayaran (ticket #45, issue #45).
-- 1 invoice per transaksi (M5, transaksi_id UNIQUE). Rows live on the
-- Transaksi (Q21, no invoice_baris table): issue locks the Transaksi rows
-- via invoice_terbit flag checked by the API. Nomor INV-YYYY-NNNN from id
-- (B6). Pembayaran minus-amount = correction, never DELETE (M1).

CREATE TABLE invoice (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transaksi_id INTEGER NOT NULL UNIQUE REFERENCES transaksi(id),
  nomor TEXT UNIQUE,
  tanggal_terbit TEXT NOT NULL,
  jatuh_tempo TEXT NOT NULL,
  total INTEGER NOT NULL,
  bank_snapshot TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid', 'batal')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE pembayaran (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoice(id),
  tanggal TEXT NOT NULL,
  jumlah INTEGER NOT NULL,
  metode TEXT NOT NULL DEFAULT 'transfer' CHECK (metode IN ('transfer', 'cash')),
  referensi TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_pembayaran_invoice ON pembayaran(invoice_id);

-- Row lock: set when the invoice issues (Q21). Checked by PATCH ributan.
ALTER TABLE transaksi ADD COLUMN invoice_terbit INTEGER NOT NULL DEFAULT 0;
