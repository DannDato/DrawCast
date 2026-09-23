import { useEffect, useState } from 'react';
import { getUserSettings } from '../../../api/settings';
import { normalizeEditorPreferences } from '../editorDefaults';
import { DEFAULT_DRAW_CONFIG } from '../tools/drawing/drawingTool';
import { DEFAULT_SHAPE_CONFIG } from '../tools/shapes/shapeTool';
import { DEFAULT_IMAGE_CONFIG } from '../tools/images/imageTool';
import { DEFAULT_TEXT_CONFIG, resolveTextFontFamily } from '../tools/text/textTool';
import { DEFAULT_TIMER_CONFIG } from '../tools/timer/timerTool';

export default function useEditorPreferences() {
  const [userSettings, setUserSettings] = useState(undefined);
  const [drawConfig, setDrawConfig] = useState(DEFAULT_DRAW_CONFIG);
  const [shapeConfig, setShapeConfig] = useState(DEFAULT_SHAPE_CONFIG);
  const [imageConfig, setImageConfig] = useState(DEFAULT_IMAGE_CONFIG);
  const [textConfig, setTextConfig] = useState(DEFAULT_TEXT_CONFIG);
  const [timerConfig, setTimerConfig] = useState(DEFAULT_TIMER_CONFIG);

  useEffect(() => {
    let active = true;

    const loadEditorSettings = async () => {
      let settings = null;
      try {
        settings = await getUserSettings();
        if (!active) return;
        const preferences = normalizeEditorPreferences(settings.editor);
        setDrawConfig({ ...DEFAULT_DRAW_CONFIG, ...preferences.drawing });
        setShapeConfig({ ...DEFAULT_SHAPE_CONFIG, ...preferences.shape });
        setImageConfig({ ...DEFAULT_IMAGE_CONFIG, ...preferences.image });
        setTextConfig({ ...DEFAULT_TEXT_CONFIG, ...preferences.text, fontFamily: resolveTextFontFamily(preferences.text.fontKey) });
        setTimerConfig({ ...DEFAULT_TIMER_CONFIG, ...preferences.timer, fontFamily: resolveTextFontFamily(preferences.timer.fontKey) });
      } catch {
        // El editor puede seguir funcionando con sus defaults aunque falle la configuración de cuenta.
      }
      if (active) setUserSettings(settings);
    };

    loadEditorSettings();
    return () => { active = false; };
  }, []);

  return { userSettings, drawConfig, setDrawConfig, shapeConfig, setShapeConfig, imageConfig, setImageConfig, textConfig, setTextConfig, timerConfig, setTimerConfig };
}
