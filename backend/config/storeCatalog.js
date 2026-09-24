import { ENTITLEMENT_BUNDLE_KEYS } from './entitlementCatalog.js';

export const STORE_PRODUCT_KEYS = Object.freeze({
  CANVAS_PLUS: 'canvas.plus',
  CANVAS_SLOT: 'account.canvas_slot.1',
  TOOL_TEXT: 'tool.text',
  TOOL_SHAPES: 'tool.shapes',
  TOOL_TIMER: 'tool.timer',
  TOOL_GUIDES: 'tool.guides',
  TOOL_DESIGNS: 'tool.designs',
  TOOL_QUICK_SOUNDS: 'tool.quick_sounds',
  TOOL_CUSTOM_SOUNDS: 'tool.custom_sounds',
  ADDON_LAYERS_5: 'addon.layers.5',
  ADDON_DESIGNS_3: 'addon.design_slots.3',
  ADDON_GUIDES_3: 'addon.guide_slots.3',
  ADDON_QUICK_SOUNDS_3: 'addon.quick_sound_slots.3',
  ADDON_CUSTOM_SOUNDS_5: 'addon.custom_sound_slots.5'
});

const plusRequirement = {
  groupKey: 'plus',
  subjectType: 'bundle',
  subjectKey: ENTITLEMENT_BUNDLE_KEYS.CANVAS_PLUS,
  operator: 'active',
  description: 'Requiere Lienzo Plus.'
};

const featureRequirement = (subjectKey, description) => ({
  groupKey: 'feature',
  subjectType: 'capability',
  subjectKey,
  operator: 'truthy',
  description
});

export const STORE_PRODUCTS = Object.freeze([
  {
    key: STORE_PRODUCT_KEYS.CANVAS_PLUS,
    kind: 'plan',
    targetScope: 'channel',
    name: 'Lienzo Plus',
    description: 'Desbloquea todas las herramientas premium del lienzo para el propietario y todos sus colaboradores.',
    priceCents: 400,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'TODO EL LIENZO',
    featured: true,
    sortOrder: 10,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.CANVAS_PLUS],
    metadata: {
      section: 'plus',
      icon: 'sparkles',
      accent: 'gold',
      highlights: ['Todas las herramientas', '3 diseños', '3 guías', '3 sonidos rápidos', '5 sonidos propios', '5 capas', '24 pads', 'Sin marca de agua']
    }
  },
  {
    key: STORE_PRODUCT_KEYS.CANVAS_SLOT,
    kind: 'capacity',
    targetScope: 'account',
    name: 'Nuevo lienzo',
    description: 'Añade un slot de lienzo activo a tu cuenta. La mejora vive en tu cuenta, no en un lienzo concreto.',
    priceCents: 300,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'CUENTA',
    sortOrder: 20,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.ACCOUNT_CANVAS_SLOT_1],
    metadata: { section: 'canvases', icon: 'panels-top-left', accent: 'sage', highlights: ['+1 lienzo activo'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_TEXT,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Texto',
    description: 'Desbloquea Texto en un lienzo sin contratar Lienzo Plus.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 100,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_TEXT],
    metadata: { section: 'tools', icon: 'type', accent: 'neutral', highlights: ['Herramienta Texto'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_SHAPES,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Línea + Forma',
    description: 'Desbloquea Línea y Forma como paquete individual.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 110,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_SHAPES],
    metadata: { section: 'tools', icon: 'shapes', accent: 'neutral', highlights: ['Línea', 'Forma'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_TIMER,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Temporizador',
    description: 'Desbloquea objetos de Temporizador en un lienzo.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 120,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_TIMER],
    metadata: { section: 'tools', icon: 'timer', accent: 'neutral', highlights: ['Temporizadores en Overlay'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_GUIDES,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Guías Lite',
    description: 'Desbloquea Guías y sus primeros 3 slots sin necesidad de Plus.',
    priceCents: 150,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 130,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_GUIDES],
    metadata: { section: 'tools', icon: 'scan-line', accent: 'neutral', highlights: ['Guías', '3 slots'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_DESIGNS,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Diseños Lite',
    description: 'Desbloquea Diseños y 3 espacios para guardar estados del lienzo.',
    priceCents: 150,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 135,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_DESIGNS],
    metadata: { section: 'tools', icon: 'layout-template', accent: 'neutral', highlights: ['Diseños', '3 slots'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_QUICK_SOUNDS,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Sonidos rápidos Lite',
    description: 'Desbloquea Sonidos rápidos con 3 slots en un lienzo.',
    priceCents: 150,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 140,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_QUICK_SOUNDS],
    metadata: { section: 'tools', icon: 'audio-lines', accent: 'neutral', highlights: ['Sonidos rápidos', '3 slots'] }
  },
  {
    key: STORE_PRODUCT_KEYS.TOOL_CUSTOM_SOUNDS,
    kind: 'tool',
    targetScope: 'channel',
    name: 'Sonidos propios Lite',
    description: 'Desbloquea la subida de sonidos propios con 5 espacios base.',
    priceCents: 200,
    currency: 'USD',
    billingInterval: 'month',
    sortOrder: 145,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.TOOL_CUSTOM_SOUNDS],
    metadata: { section: 'tools', icon: 'upload', accent: 'neutral', highlights: ['Sonidos propios', '5 slots'] }
  },
  {
    key: STORE_PRODUCT_KEYS.ADDON_LAYERS_5,
    kind: 'addon',
    targetScope: 'channel',
    name: '+5 capas',
    description: 'Amplía el límite del lienzo con cinco capas adicionales.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'EXPANSIÓN',
    sortOrder: 200,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.ADDON_LAYERS_5],
    requirements: [plusRequirement],
    metadata: { section: 'expansions', icon: 'layers-3', accent: 'spectral', highlights: ['+5 capas'] }
  },
  {
    key: STORE_PRODUCT_KEYS.ADDON_DESIGNS_3,
    kind: 'addon',
    targetScope: 'channel',
    name: '+3 diseños',
    description: 'Añade tres espacios para guardar Diseños.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'EXPANSIÓN',
    sortOrder: 210,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.ADDON_DESIGN_SLOTS_3],
    requirements: [plusRequirement, featureRequirement('editor.designs', 'Requiere Lienzo Plus o Diseños desbloqueados.')],
    metadata: { section: 'expansions', icon: 'layout-template', accent: 'spectral', highlights: ['+3 slots de diseños'] }
  },
  {
    key: STORE_PRODUCT_KEYS.ADDON_GUIDES_3,
    kind: 'addon',
    targetScope: 'channel',
    name: '+3 guías',
    description: 'Añade tres espacios para guardar Guías.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'EXPANSIÓN',
    sortOrder: 220,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.ADDON_GUIDE_SLOTS_3],
    requirements: [plusRequirement, featureRequirement('editor.guides', 'Requiere Lienzo Plus o Guías desbloqueadas.')],
    metadata: { section: 'expansions', icon: 'scan-line', accent: 'spectral', highlights: ['+3 slots de guías'] }
  },
  {
    key: STORE_PRODUCT_KEYS.ADDON_QUICK_SOUNDS_3,
    kind: 'addon',
    targetScope: 'channel',
    name: '+3 sonidos rápidos',
    description: 'Añade tres accesos rápidos de sonido al toolbar.',
    priceCents: 100,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'EXPANSIÓN',
    sortOrder: 230,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.ADDON_QUICK_SOUND_SLOTS_3],
    requirements: [plusRequirement, featureRequirement('editor.quick_sounds', 'Requiere Lienzo Plus o Sonidos rápidos desbloqueados.')],
    metadata: { section: 'expansions', icon: 'volume-2', accent: 'spectral', highlights: ['+3 slots rápidos'] }
  },
  {
    key: STORE_PRODUCT_KEYS.ADDON_CUSTOM_SOUNDS_5,
    kind: 'addon',
    targetScope: 'channel',
    name: '+5 sonidos propios',
    description: 'Amplía el almacenamiento funcional con cinco sonidos personalizados adicionales.',
    priceCents: 200,
    currency: 'USD',
    billingInterval: 'month',
    badge: 'EXPANSIÓN',
    sortOrder: 240,
    bundles: [ENTITLEMENT_BUNDLE_KEYS.ADDON_CUSTOM_SOUND_SLOTS_5],
    requirements: [plusRequirement, featureRequirement('editor.custom_sounds', 'Requiere Lienzo Plus o Sonidos personalizados desbloqueados.')],
    metadata: { section: 'expansions', icon: 'upload', accent: 'spectral', highlights: ['+5 sonidos propios'] }
  }
]);
