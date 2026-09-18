const SOFT_WHITE = '#e7e7e7';

// Punto único para los valores predeterminados del editor.
// Más adelante este objeto puede alimentarse desde las preferencias del usuario
// sin tener que perseguir colores hardcodeados por cada herramienta.
export const DEFAULT_EDITOR_PREFERENCES = Object.freeze({
  colors: Object.freeze({
    drawing: SOFT_WHITE,
    shapeFill: SOFT_WHITE,
    shapeStroke: SOFT_WHITE,
    text: SOFT_WHITE,
    textStroke: SOFT_WHITE,
    timer: SOFT_WHITE,
    timerStroke: SOFT_WHITE
  })
});

