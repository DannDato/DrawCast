export function validatePasswordPolicy(value) {
  const password = String(value || '');
  if (password.length < 6 || password.length > 128) return { ok: false, message: 'La contraseña debe tener entre 6 y 128 caracteres.' };
  if (!/[A-Z]/.test(password)) return { ok: false, message: 'La contraseña debe incluir al menos una mayúscula.' };
  if (!/\d/.test(password)) return { ok: false, message: 'La contraseña debe incluir al menos un número.' };
  return { ok: true };
}
