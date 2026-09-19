export const TOOL_SHORTCUTS = {
  select: 'V',
  hand: 'H / CLICK RUEDA',
  draw: 'P',
  eraser: 'E',
  image: 'I',
  shape: 'S / G',
  text: 'T',
  timer: 'R'
};

export const GUIDE_SHORTCUTS = {
  none: '0',
  'canva-guide.png': '1',
  'canva-guide2.png': '2',
  'canva-guide3.png': '3'
};

export const HOTKEY_SECTIONS = [
  {
    title: 'HERRAMIENTAS',
    items: [
      ['V', 'Seleccionar / mover'],
      ['H', 'Manita / mover lienzo'],
      ['CLICK RUEDA (MANTENER)', 'Manita temporal; al soltar vuelve a la herramienta anterior'],
      ['P', 'Pincel'],
      ['E', 'Borrador'],
      ['I', 'Imagen / GIF'],
      ['S / G', 'Formas'],
      ['T', 'Texto'],
      ['R', 'Temporizador']
    ]
  },
  {
    title: 'LIENZO',
    items: [
      ['0', 'Quitar guía'],
      ['1 / 2 / 3', 'Guía 1 / 2 / 3'],
      ['RUEDA', 'Acercar / alejar vista'],
      ['FLECHAS', 'Mover selección 1 px'],
      ['SHIFT + FLECHAS', 'Mover selección 10 px'],
      ['ESC', 'Volver a Selección / limpiar selección'],
      ['SUPR / BACKSPACE', 'Eliminar selección']
    ]
  },
  {
    title: 'MODIFICADORES',
    items: [
      ['CTRL/CMD / SHIFT + CLICK', 'Añadir o quitar una capa de la selección'],
      ['SHIFT + REDIMENSIONAR', 'Mantener proporciones'],
      ['SHIFT + ROTAR', 'Ajustar rotación en pasos de 15°'],
      ['ALT + MOVER / REDIM.', 'Ignorar snap temporalmente'],
      ['SHIFT + ARRASTRAR FORMA', 'Crear forma con proporciones iguales'],
      ['ALT + ARRASTRAR FORMA', 'Crear forma desde el centro']
    ]
  },
  {
    title: 'CAPAS Y GRUPOS',
    items: [
      ['CTRL/CMD + A', 'Seleccionar todas las capas visibles'],
      ['CTRL/CMD + G', 'Agrupar selección'],
      ['CTRL/CMD + SHIFT + G', 'Desagrupar selección'],
      ['CTRL/CMD + D', 'Duplicar selección'],
      ['CTRL/CMD + ↑ / ↓', 'Subir o bajar una capa'],
      ['CTRL/CMD + SHIFT + SUPR / BACKSPACE', 'Vaciar el lienzo (pide confirmación)']
    ]
  },
  {
    title: 'HISTORIAL Y PORTAPAPELES',
    items: [
      ['CTRL/CMD + Z', 'Deshacer'],
      ['CTRL/CMD + SHIFT + Z', 'Rehacer'],
      ['CTRL/CMD + Y', 'Rehacer'],
      ['CTRL/CMD + C', 'Copiar'],
      ['CTRL/CMD + X', 'Cortar'],
      ['CTRL/CMD + V', 'Pegar']
    ]
  },
  {
    title: 'AYUDA',
    items: [
      ['?', 'Abrir / cerrar atajos'],
      ['F1', 'Abrir / cerrar atajos']
    ]
  }
];
