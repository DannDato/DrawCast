import { audit } from '../../helpers/audit.js';
import { getUserSettings, resetEditorPreferences, saveEditorPreferences, saveLaunchpadSlots, saveSoundSlots } from '../../services/userSettingsService.js';

class SettingsController {
  get = async (req, res) => res.json(await getUserSettings(req.user.id));

  updateEditor = async (req, res) => {
    const editor = await saveEditorPreferences(req.user.id, req.body || {});
    await audit(req, { event: 'settings.editor_updated', category: 'user', userId: req.user.id });
    return res.json({ editor });
  };

  updateSoundSlots = async (req, res) => {
    const soundSlots = await saveSoundSlots(req.user.id, req.body?.slots);
    await audit(req, { event: 'settings.sound_slots_updated', category: 'user', userId: req.user.id });
    return res.json({ soundSlots });
  };

  updateLaunchpadSlots = async (req, res) => {
    const launchpadSlots = await saveLaunchpadSlots(req.user.id, req.body?.slots);
    await audit(req, { event: 'settings.launchpad_slots_updated', category: 'user', userId: req.user.id });
    return res.json({ launchpadSlots });
  };

  resetEditor = async (req, res) => {
    const editor = await resetEditorPreferences(req.user.id);
    await audit(req, { event: 'settings.editor_reset', category: 'user', userId: req.user.id });
    return res.json({ editor });
  };
}

export const ctrlSettings = new SettingsController();
