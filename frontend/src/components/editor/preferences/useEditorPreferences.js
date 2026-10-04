import { useEffect, useMemo, useRef, useState } from 'react';
import { getUserSettings, saveEditorSettings } from '../../../api/settings';
import { normalizeEditorPreferences } from '../editorDefaults';
import { DEFAULT_DRAW_CONFIG } from '../tools/drawing/drawingTool';
import { DEFAULT_LINE_CONFIG } from '../tools/lines/lineTool';
import { DEFAULT_SHAPE_CONFIG } from '../tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG } from '../tools/images/imageTool';
import { DEFAULT_TEXT_CONFIG, resolveTextFontFamily } from '../tools/text/textTool';
import { DEFAULT_TIMER_CONFIG } from '../tools/timer/timerTool';
import { DEFAULT_ROULETTE_CONFIG } from '../tools/roulette/rouletteTool';

const AUTOSAVE_DELAY_MS = 450;

export default function useEditorPreferences() {
  const [userSettings, setUserSettings] = useState(undefined);
  const [drawConfig, setDrawConfig] = useState(DEFAULT_DRAW_CONFIG);
  const [lineConfig, setLineConfig] = useState(DEFAULT_LINE_CONFIG);
  const [shapeConfig, setShapeConfig] = useState(DEFAULT_SHAPE_CONFIG);
  const [imageConfig, setImageConfig] = useState(DEFAULT_IMAGE_CONFIG);
  const [textConfig, setTextConfig] = useState(DEFAULT_TEXT_CONFIG);
  const [timerConfig, setTimerConfig] = useState(DEFAULT_TIMER_CONFIG);
  const [rouletteConfig, setRouletteConfig] = useState(DEFAULT_ROULETTE_CONFIG);
  const hydratedRef = useRef(false);
  const lastSavedRef = useRef('');
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;

    const loadEditorSettings = async () => {
      let settings = null;
      try {
        settings = await getUserSettings();
        if (!active) return;
        const preferences = normalizeEditorPreferences(settings.editor);
        lastSavedRef.current = JSON.stringify(preferences);
        setDrawConfig({ ...DEFAULT_DRAW_CONFIG, ...preferences.drawing });
        setLineConfig({ ...DEFAULT_LINE_CONFIG, ...preferences.line });
        setShapeConfig({ ...DEFAULT_SHAPE_CONFIG, ...preferences.shape });
        setImageConfig({ ...DEFAULT_IMAGE_CONFIG, ...preferences.image });
        setTextConfig({ ...DEFAULT_TEXT_CONFIG, ...preferences.text, fontFamily: resolveTextFontFamily(preferences.text.fontKey) });
        setTimerConfig({ ...DEFAULT_TIMER_CONFIG, ...preferences.timer, fontFamily: resolveTextFontFamily(preferences.timer.fontKey) });
        setRouletteConfig({ ...DEFAULT_ROULETTE_CONFIG, ...preferences.roulette });
      } catch {
        // El editor puede seguir funcionando con sus defaults aunque falle la configuración de cuenta.
      }
      if (active) {
        setUserSettings(settings);
        hydratedRef.current = Boolean(settings);
      }
    };

    loadEditorSettings();
    return () => { active = false; };
  }, []);

  const editorPreferences = useMemo(() => normalizeEditorPreferences({
    drawing: drawConfig,
    line: lineConfig,
    shape: shapeConfig,
    image: imageConfig,
    text: textConfig,
    timer: timerConfig,
    roulette: rouletteConfig
  }), [drawConfig, lineConfig, shapeConfig, imageConfig, textConfig, timerConfig, rouletteConfig]);

  useEffect(() => {
    if (!hydratedRef.current) return undefined;
    const serialized = JSON.stringify(editorPreferences);
    if (serialized === lastSavedRef.current) return undefined;

    const timer = window.setTimeout(() => {
      const pending = editorPreferences;
      const pendingSerialized = serialized;
      saveQueueRef.current = saveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          if (pendingSerialized === lastSavedRef.current) return;
          try {
            const data = await saveEditorSettings(pending);
            const normalized = normalizeEditorPreferences(data?.editor || pending);
            lastSavedRef.current = JSON.stringify(normalized);
          } catch (error) {
            console.warn('No se pudieron guardar automáticamente las preferencias del editor.', error);
          }
        });
    }, AUTOSAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [editorPreferences]);

  return {
    userSettings,
    drawConfig, setDrawConfig,
    lineConfig, setLineConfig,
    shapeConfig, setShapeConfig,
    imageConfig, setImageConfig,
    textConfig, setTextConfig,
    timerConfig, setTimerConfig,
    rouletteConfig, setRouletteConfig
  };
}
