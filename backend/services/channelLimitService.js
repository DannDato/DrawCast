function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

// Punto único para los límites de lienzos.
// Hoy usa un límite global; cuando exista el modelo de suscripciones,
// este resolver puede leer el plan del usuario sin tocar controladores/UI.
export function getCanvasLimitForUser(_user) {
  return positiveInt(process.env.CANVAS_LIMIT_DEFAULT, 3);
}
