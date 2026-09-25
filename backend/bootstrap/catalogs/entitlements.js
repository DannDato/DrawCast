// Definiciones de bootstrap para una instalación nueva.
// La base de datos es la fuente de verdad una vez persistidos estos registros.

// Keys/capabilities = contrato técnico. Las definiciones descriptivas y bundles sólo sirven como defaults de bootstrap; la BD manda después.
export const ENTITLEMENT_BUNDLE_KEYS = Object.freeze({
  ACCOUNT_FREE: 'account.free',
  CANVAS_FREE: 'canvas.free',
  CANVAS_PLUS: 'canvas.plus',
  ACCOUNT_CANVAS_SLOT_1: 'account.canvas_slot.1',
  TOOL_TEXT: 'tool.text',
  TOOL_SHAPES: 'tool.shapes',
  TOOL_TIMER: 'tool.timer',
  TOOL_GUIDES: 'tool.guides',
  TOOL_DESIGNS: 'tool.designs',
  TOOL_QUICK_SOUNDS: 'tool.quick_sounds',
  TOOL_CUSTOM_SOUNDS: 'tool.custom_sounds',
  TOOL_LAUNCHPAD: 'tool.launchpad',
  TOOL_LIVE_STUDIO: 'tool.live_studio',
  TOOL_REMOVE_WATERMARK: 'tool.remove_watermark',
  ADDON_LAYERS_5: 'addon.layers.5',
  ADDON_DESIGN_SLOTS_3: 'addon.design_slots.3',
  ADDON_GUIDE_SLOTS_3: 'addon.guide_slots.3',
  ADDON_QUICK_SOUND_SLOTS_3: 'addon.quick_sound_slots.3',
  ADDON_CUSTOM_SOUND_SLOTS_5: 'addon.custom_sound_slots.5',
  ADDON_LAUNCHPAD_PADS_8: 'addon.launchpad_pads.8'
});

export const ENTITLEMENT_CAPABILITIES = Object.freeze([
  { key: 'account.canvas_slots', scope: 'account', valueType: 'integer', category: 'account', name: 'Lienzos activos', description: 'Cantidad máxima de lienzos que puede mantener activos una cuenta.', expandable: true, sortOrder: 10 },

  { key: 'editor.select', scope: 'channel', valueType: 'boolean', category: 'core', name: 'Selección', description: 'Seleccionar, mover y transformar objetos.', expandable: false, sortOrder: 100 },
  { key: 'editor.pan', scope: 'channel', valueType: 'boolean', category: 'core', name: 'Manita', description: 'Mover la vista del lienzo.', expandable: false, sortOrder: 110 },
  { key: 'editor.brush', scope: 'channel', valueType: 'boolean', category: 'drawing', name: 'Pincel', description: 'Dibujo libre con pincel.', expandable: false, sortOrder: 120 },
  { key: 'editor.eraser', scope: 'channel', valueType: 'boolean', category: 'drawing', name: 'Borrador', description: 'Borrado libre sobre capas de dibujo.', expandable: false, sortOrder: 130 },
  { key: 'editor.image', scope: 'channel', valueType: 'boolean', category: 'objects', name: 'Imagen / GIF', description: 'Insertar imágenes y GIF en el lienzo.', expandable: false, sortOrder: 140 },
  { key: 'editor.snap', scope: 'channel', valueType: 'boolean', category: 'core', name: 'Imán y guías de alineación', description: 'Ayudas de alineación del editor.', expandable: false, sortOrder: 150 },
  { key: 'editor.overlay', scope: 'channel', valueType: 'boolean', category: 'stream', name: 'Overlay', description: 'Salida pública del lienzo para OBS.', expandable: false, sortOrder: 160 },
  { key: 'overlay.remove_watermark', scope: 'channel', valueType: 'boolean', category: 'stream', name: 'Sin marca de agua', description: 'Oculta la marca de agua de TRAZIO en el Overlay público.', expandable: false, sortOrder: 165 },
  { key: 'editor.collaboration', scope: 'channel', valueType: 'boolean', category: 'collaboration', name: 'Colaboración', description: 'Edición compartida del lienzo.', expandable: false, sortOrder: 170 },

  { key: 'editor.guides', scope: 'channel', valueType: 'boolean', category: 'workflow', name: 'Guías guardadas', description: 'Guardar y cargar guías visuales del lienzo.', expandable: false, sortOrder: 200 },
  { key: 'editor.designs', scope: 'channel', valueType: 'boolean', category: 'workflow', name: 'Diseños guardados', description: 'Guardar y cargar estados completos del lienzo.', expandable: false, sortOrder: 210 },
  { key: 'editor.text', scope: 'channel', valueType: 'boolean', category: 'objects', name: 'Texto', description: 'Crear y editar objetos de texto.', expandable: false, sortOrder: 220 },
  { key: 'editor.live_studio', scope: 'channel', valueType: 'boolean', category: 'stream', name: 'Live / Estudio', description: 'Preparar cambios sin publicarlos hasta decidirlo.', expandable: false, sortOrder: 230 },
  { key: 'editor.quick_sounds', scope: 'channel', valueType: 'boolean', category: 'audio', name: 'Sonidos rápidos', description: 'Disparar sonidos desde el toolbar del editor.', expandable: false, sortOrder: 240 },
  { key: 'editor.custom_sounds', scope: 'channel', valueType: 'boolean', category: 'audio', name: 'Sonidos personalizados', description: 'Subir sonidos propios ligados al lienzo.', expandable: false, sortOrder: 250 },
  { key: 'editor.timer', scope: 'channel', valueType: 'boolean', category: 'objects', name: 'Temporizador', description: 'Crear temporizadores dentro del overlay.', expandable: false, sortOrder: 260 },
  { key: 'editor.line', scope: 'channel', valueType: 'boolean', category: 'objects', name: 'Línea', description: 'Crear objetos de línea.', expandable: false, sortOrder: 270 },
  { key: 'editor.shape', scope: 'channel', valueType: 'boolean', category: 'objects', name: 'Forma', description: 'Crear objetos de forma.', expandable: false, sortOrder: 280 },
  { key: 'editor.launchpad', scope: 'channel', valueType: 'boolean', category: 'audio', name: 'Launchpad', description: 'Workspace de pads de audio dentro del Editor.', expandable: false, sortOrder: 290 },

  { key: 'limit.layers', scope: 'channel', valueType: 'integer', category: 'limits', name: 'Capas', description: 'Cantidad máxima de capas disponibles en el lienzo.', expandable: true, sortOrder: 400 },
  { key: 'limit.design_slots', scope: 'channel', valueType: 'integer', category: 'limits', name: 'Slots de diseños', description: 'Cantidad de diseños guardados disponibles.', expandable: true, sortOrder: 410 },
  { key: 'limit.guide_slots', scope: 'channel', valueType: 'integer', category: 'limits', name: 'Slots de guías', description: 'Cantidad de guías guardadas disponibles.', expandable: true, sortOrder: 420 },
  { key: 'limit.quick_sound_slots', scope: 'channel', valueType: 'integer', category: 'limits', name: 'Slots de sonidos rápidos', description: 'Cantidad de accesos rápidos de audio disponibles.', expandable: true, sortOrder: 430 },
  { key: 'limit.custom_sound_slots', scope: 'channel', valueType: 'integer', category: 'limits', name: 'Sonidos personalizados', description: 'Cantidad de sonidos propios que puede almacenar el lienzo.', expandable: true, sortOrder: 440 },
  { key: 'limit.launchpad_pads', scope: 'channel', valueType: 'integer', category: 'limits', name: 'Pads de Launchpad', description: 'Cantidad de pads disponibles en el Launchpad.', expandable: true, hardMax: 24, sortOrder: 450 }
]);

export const ENTITLEMENT_BUNDLES = Object.freeze([
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ACCOUNT_FREE,
    scope: 'account',
    kind: 'baseline',
    name: 'Cuenta Free',
    description: 'Capacidades base que recibe cualquier cuenta de TRAZIO.',
    priority: 0,
    grants: {
      'account.canvas_slots': 1
    }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.CANVAS_FREE,
    scope: 'channel',
    kind: 'baseline',
    name: 'Lienzo Free',
    description: 'Capacidades base que recibe cualquier lienzo de TRAZIO.',
    priority: 0,
    grants: {
      'editor.select': true,
      'editor.pan': true,
      'editor.brush': true,
      'editor.eraser': true,
      'editor.image': true,
      'editor.snap': true,
      'editor.overlay': true,
      'overlay.remove_watermark': false,
      'editor.collaboration': true,
      'editor.guides': false,
      'editor.designs': false,
      'editor.text': false,
      'editor.live_studio': false,
      'editor.quick_sounds': false,
      'editor.custom_sounds': false,
      'editor.timer': false,
      'editor.line': false,
      'editor.shape': false,
      'editor.launchpad': false,
      'limit.layers': 5,
      'limit.design_slots': 0,
      'limit.guide_slots': 0,
      'limit.quick_sound_slots': 0,
      'limit.custom_sound_slots': 0,
      'limit.launchpad_pads': 0
    }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.CANVAS_PLUS,
    scope: 'channel',
    kind: 'plan',
    name: 'Lienzo Plus',
    description: 'Desbloquea todas las funciones del lienzo y aplica los límites base de Plus.',
    priority: 100,
    grants: {
      'editor.select': true,
      'editor.pan': true,
      'editor.brush': true,
      'editor.eraser': true,
      'editor.image': true,
      'editor.snap': true,
      'editor.overlay': true,
      'overlay.remove_watermark': true,
      'editor.collaboration': true,
      'editor.guides': true,
      'editor.designs': true,
      'editor.text': true,
      'editor.live_studio': true,
      'editor.quick_sounds': true,
      'editor.custom_sounds': true,
      'editor.timer': true,
      'editor.line': true,
      'editor.shape': true,
      'editor.launchpad': true,
      'limit.layers': 5,
      'limit.design_slots': 3,
      'limit.guide_slots': 3,
      'limit.quick_sound_slots': 3,
      'limit.custom_sound_slots': 5,
      'limit.launchpad_pads': 24
    }
  }
,
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ACCOUNT_CANVAS_SLOT_1,
    scope: 'account',
    kind: 'addon',
    name: '+1 lienzo',
    description: 'Añade un slot adicional de lienzo activo a la cuenta.',
    priority: 200,
    grants: {
      'account.canvas_slots': { operation: 'add', value: 1 }
    }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_TEXT,
    scope: 'channel',
    kind: 'tool',
    name: 'Texto',
    description: 'Desbloquea la herramienta Texto en un lienzo.',
    priority: 50,
    grants: { 'editor.text': true }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_SHAPES,
    scope: 'channel',
    kind: 'tool',
    name: 'Línea + Forma',
    description: 'Desbloquea las herramientas Línea y Forma en un lienzo.',
    priority: 50,
    grants: { 'editor.line': true, 'editor.shape': true }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_TIMER,
    scope: 'channel',
    kind: 'tool',
    name: 'Temporizador',
    description: 'Desbloquea Temporizador en un lienzo.',
    priority: 50,
    grants: { 'editor.timer': true }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_GUIDES,
    scope: 'channel',
    kind: 'tool',
    name: 'Guías Lite',
    description: 'Desbloquea Guías con 3 slots base.',
    priority: 50,
    grants: { 'editor.guides': true, 'limit.guide_slots': 3 }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_DESIGNS,
    scope: 'channel',
    kind: 'tool',
    name: 'Diseños Lite',
    description: 'Desbloquea Diseños con 3 slots base.',
    priority: 50,
    grants: { 'editor.designs': true, 'limit.design_slots': 3 }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_QUICK_SOUNDS,
    scope: 'channel',
    kind: 'tool',
    name: 'Sonidos rápidos Lite',
    description: 'Desbloquea Sonidos rápidos con 3 slots base.',
    priority: 50,
    grants: { 'editor.quick_sounds': true, 'limit.quick_sound_slots': 3 }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_CUSTOM_SOUNDS,
    scope: 'channel',
    kind: 'tool',
    name: 'Sonidos propios Lite',
    description: 'Desbloquea Sonidos personalizados con 5 slots base.',
    priority: 50,
    grants: { 'editor.custom_sounds': true, 'limit.custom_sound_slots': 5 }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_LAUNCHPAD,
    scope: 'channel',
    kind: 'tool',
    name: 'Launchpad Lite',
    description: 'Desbloquea Launchpad con 8 pads y acceso a la biblioteca de sonidos.',
    priority: 50,
    grants: { 'editor.launchpad': true, 'limit.launchpad_pads': 8 }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_LIVE_STUDIO,
    scope: 'channel',
    kind: 'tool',
    name: 'Live / Studio',
    description: 'Desbloquea el modo Estudio y la publicación manual hacia el Overlay.',
    priority: 50,
    grants: { 'editor.live_studio': true }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.TOOL_REMOVE_WATERMARK,
    scope: 'channel',
    kind: 'tool',
    name: 'Quitar marca de agua',
    description: 'Retira la marca TRAZIO del Overlay público de un lienzo.',
    priority: 50,
    grants: { 'overlay.remove_watermark': true }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ADDON_LAYERS_5,
    scope: 'channel',
    kind: 'addon',
    name: '+5 capas',
    description: 'Añade cinco capas al límite del lienzo.',
    priority: 200,
    grants: { 'limit.layers': { operation: 'add', value: 5 } }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ADDON_DESIGN_SLOTS_3,
    scope: 'channel',
    kind: 'addon',
    name: '+3 diseños',
    description: 'Añade tres slots para Diseños guardados.',
    priority: 200,
    grants: { 'limit.design_slots': { operation: 'add', value: 3 } }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ADDON_GUIDE_SLOTS_3,
    scope: 'channel',
    kind: 'addon',
    name: '+3 guías',
    description: 'Añade tres slots para Guías guardadas.',
    priority: 200,
    grants: { 'limit.guide_slots': { operation: 'add', value: 3 } }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ADDON_QUICK_SOUND_SLOTS_3,
    scope: 'channel',
    kind: 'addon',
    name: '+3 sonidos rápidos',
    description: 'Añade tres slots de acceso rápido de audio.',
    priority: 200,
    grants: { 'limit.quick_sound_slots': { operation: 'add', value: 3 } }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ADDON_CUSTOM_SOUND_SLOTS_5,
    scope: 'channel',
    kind: 'addon',
    name: '+5 sonidos propios',
    description: 'Añade cinco slots de sonidos personalizados.',
    priority: 200,
    grants: { 'limit.custom_sound_slots': { operation: 'add', value: 5 } }
  },
  {
    key: ENTITLEMENT_BUNDLE_KEYS.ADDON_LAUNCHPAD_PADS_8,
    scope: 'channel',
    kind: 'addon',
    name: '+8 pads',
    description: 'Añade ocho pads al Launchpad del lienzo hasta el máximo técnico permitido.',
    priority: 200,
    grants: { 'limit.launchpad_pads': { operation: 'add', value: 8 } }
  }
]);
