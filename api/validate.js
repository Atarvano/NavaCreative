// Shared input validators (ponytail: was copy-pasted in 5 routers).
export const JENIS = ['alat', 'jasa', 'biaya'];
export const isNonNegInt = (v) => Number.isInteger(v) && v >= 0;
export const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function validBaris(b) {
  if (typeof b !== 'object' || b === null) return 'Baris harus objek.';
  if (!JENIS.includes(b.jenis)) return `jenis harus salah satu: ${JENIS.join(', ')}.`;
  if (typeof b.nama !== 'string' || !b.nama.trim()) return 'Nama baris wajib diisi.';
  if (!Number.isInteger(b.qty) || b.qty <= 0) return 'qty harus bilangan bulat > 0.';
  if (!isNonNegInt(b.harga_satuan)) return 'harga_satuan harus bilangan bulat >= 0.';
  if (b.jenis === 'alat' && b.alat_id !== undefined && b.alat_id !== null && !Number.isInteger(b.alat_id))
    return 'alat_id harus id alat atau null.';
  return null;
}
