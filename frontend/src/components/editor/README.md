# Editor de TRAZIO

`../../pages/Editor.jsx` compone la pantalla y coordina la escena compartida: objetos, selección, capas, historial, dibujo y eventos del socket. Esas operaciones se mantienen juntas porque deben actualizarse de forma consistente.

## Dónde trabajar

| Área | Archivos |
| --- | --- |
| Preferencias iniciales de herramientas y cuenta | `preferences/useEditorPreferences.js`, `editorDefaults.js` |
| Biblioteca, asignaciones, sonidos del lienzo, monitoreo y reproducción hacia OBS | `sounds/useEditorSounds.js` |
| Interfaz de sonidos rápidos y Launchpad | `sounds/SoundSlotsModal.jsx`, `sounds/LaunchpadConfigModal.jsx`, `sounds/LaunchpadSurface.jsx` |
| Guías compartidas del canal y captura del lienzo | `guides/useEditorGuides.js`, `guides/GuidesModal.jsx`, `guides/captureGuide.js` |
| Atajos del lienzo y eventos del portapapeles | `hotkeys/useEditorHotkeys.js`, `hotkeys/shortcuts.js` |
| Carga de imágenes y GIF por archivo o URL | `tools/images/useEditorMedia.js` |
| Lectura de escenas guardadas y capa de dibujo de respaldo | `scene/sceneUtils.js` |
| Interacción con el canvas, pan y zoom | `CanvasStage.jsx` |
| Renderizado, selección, transformaciones y ajuste magnético | `renderer/` |
| Comportamiento de cada herramienta | `tools/` |
| Línea recta, color, grosor y ajuste angular con Shift | `tools/lines/lineTool.js` |
| Operaciones de historial, grupos, capas y portapapeles | `history/`, `groups/`, `layers/`, `clipboard/` |
| Barra de herramientas, propiedades y capas | `Toolbar.jsx`, `Inspector.jsx`, `LayersPanel.jsx` |
| Interfaz para guardar y cargar diseños | `SavedDesignsModal.jsx` |

## Flujos importantes

- `useEditorPreferences` consulta la configuración de cuenta una sola vez. Entrega también `userSettings` a `useEditorSounds`: `undefined` significa que sigue cargando y `null` que falló la consulta y se usarán los defaults.
- `useEditorSounds` conserva los identificadores de las asignaciones guardadas mientras carga la biblioteca personal del lienzo. No hay que filtrarlos únicamente contra la biblioteca global.
- La reproducción usa el `emitChannelAction` del Editor y su conexión existente. El monitoreo local no reemplaza la salida `/overlay/:publicKey` ni crea otra conexión.
- Los atajos del Launchpad pertenecen a `LaunchpadSurface`; los del lienzo, a `useEditorHotkeys`. El hook recibe las operaciones actuales del Editor y retira sus listeners al desmontarse.
- La vista Lienzo/Launchpad se deriva del parámetro `view` en la URL desde `Editor.jsx`.
- Línea (`L`, también en `+`) crea una capa `shape` con `shapeType: 'line'`. Su longitud se representa con `w` y su dirección con `rotation`; se renderiza entre los centros de los extremos izquierdo/derecho del marco. Esto conserva la edición, historial, diseños, guías y Overlay existentes. Tiene dos controles para cambiar la longitud y el control habitual de rotación.
- Las tres guías pertenecen al canal y se almacenan como capturas PNG transparentes de 1920 × 1080. La captura excluye cuadrícula, selección y guía activa; los GIF y temporizadores quedan como una imagen fija. `CanvasStage` las muestra al 20% como las guías anteriores, sin enviarlas al Overlay. La selección local se recuerda por canal; el contenido se actualiza entre editores mediante `guides-changed` y la API autorizada.
- En instalaciones existentes, `npm --prefix backend run migrate:guides` crea únicamente la tabla `channel_guides`; la migración general también incluye el modelo. Los espacios 1–3 y la restricción única canal/espacio impiden guardar una cuarta guía.

## Estilos

`../../styles/editor.css` es el punto de entrada y conserva este orden de carga:

1. `../../styles/editor/base.css`: estilos existentes del lienzo, herramientas, paneles y diseños.
2. `../../styles/editor/sounds.css`: sonidos rápidos, Launchpad, progreso y modales de audio, incluido su responsive.
3. `../../styles/editor/controls.css`: controles compactos de capas, toolbar y barra inferior, incluidos los márgenes que separan los pads de esta barra.
4. `../../styles/editor/guides.css`: modal de guías compartidas y adaptación a paneles pequeños.

El orden mantiene la cascada anterior. Modifica la regla de su área en vez de añadir nuevos bloques al archivo de entrada. Conserva el formato del archivo y evita crear componentes o hooks para simples fragmentos de presentación.
