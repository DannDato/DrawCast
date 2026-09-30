export function getStoreSettings(source = process.env) {
  const raw = String(source.STORE_MINIMUM_PURCHASE_CENTS ?? '3900').trim();
  const minimumPurchaseCents = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(minimumPurchaseCents) || minimumPurchaseCents < 0 || minimumPurchaseCents > 100000000) {
    throw new Error('STORE_MINIMUM_PURCHASE_CENTS debe ser un entero entre 0 y 100000000.');
  }
  // Punto único de lectura para incorporar la configuración de base de datos.
  return { minimumPurchaseCents, currency: 'MXN' };
}
