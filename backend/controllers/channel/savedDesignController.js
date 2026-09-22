import { models } from '../../models/index.js';
import logger from '../../helpers/winston.js';
import { isPublicUuid } from '../../services/channelAccessService.js';

const DESIGN_VERSION = 1;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_DESIGNS = 100;

function maxBytes() {
  return Math.max(256 * 1024, Number(process.env.SAVED_DESIGN_MAX_BYTES || DEFAULT_MAX_BYTES));
}

function maxDesigns() {
  return Math.max(1, Number(process.env.SAVED_DESIGN_LIMIT || DEFAULT_MAX_DESIGNS));
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function decodeState(value) {
  let current = value;
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { return null; }
  }

  if (Array.isArray(current)) return { version: DESIGN_VERSION, scene: { objects: current }, editor: {} };
  if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
  if (Array.isArray(current.scene?.objects)) return current;
  if (Array.isArray(current.objects)) {
    return {
      version: Number(current.version || DESIGN_VERSION),
      scene: { objects: current.objects },
      editor: current.editor && typeof current.editor === 'object' ? current.editor : {}
    };
  }
  return current;
}

function validateState(value) {
  const state = decodeState(value);
  if (!state) return { error: 'El diseño no tiene un estado válido', state: null };
  if (Number(state.version || DESIGN_VERSION) !== DESIGN_VERSION) return { error: 'Esta versión del diseño no es compatible', state: null };
  const objects = state.scene?.objects;
  if (!Array.isArray(objects)) return { error: 'El diseño no contiene una escena válida', state: null };
  if (objects.length > 500) return { error: 'El diseño supera el límite de 500 capas', state: null };
  for (const object of objects) {
    if (!object || typeof object !== 'object' || typeof object.id !== 'string' || object.id.length > 120) return { error: 'El diseño contiene una capa inválida', state: null };
  }
  return { error: null, state: { ...state, version: DESIGN_VERSION } };
}

function serializedSize(state) {
  return Buffer.byteLength(JSON.stringify(state), 'utf8');
}

function publicDesign(row, includeState = false, stateOverride = undefined) {
  const data = {
    uuid: row.uuid,
    name: row.name,
    sizeBytes: row.sizeBytes,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
  if (includeState) data.state = stateOverride === undefined ? decodeState(row.state) : stateOverride;
  return data;
}

async function findDesign(channelId, designUuid) {
  if (!isPublicUuid(designUuid)) return null;
  return models.SavedDesign.findOne({ where: { uuid: designUuid, channelId: Number(channelId) } });
}

export class SavedDesignController {
  static async list(req, res) {
    const rows = await models.SavedDesign.findAll({
      where: { channelId: req.channel.id },
      attributes: { exclude: ['state'] },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']]
    });
    res.json(rows.map((row) => publicDesign(row)));
  }

  static async get(req, res) {
    const design = await findDesign(req.channel.id, req.params.designUuid);
    if (!design) return res.status(404).json({ message: 'Diseño no encontrado' });

    const { error, state } = validateState(design.state);
    if (error) {
      logger.warn('Diseño guardado con estado inválido', { designId: design.id, channelId: req.channel.id, error });
      return res.status(422).json({ message: 'La copia guardada está dañada o usa un formato que TRAZIO no puede cargar.' });
    }

    res.json(publicDesign(design, true, state));
  }

  static async create(req, res) {
    const name = normalizeName(req.body.name);
    if (!name) return res.status(400).json({ message: 'Ponle un nombre al diseño' });

    const { error: stateError, state } = validateState(req.body.state);
    if (stateError) return res.status(400).json({ message: stateError });

    const count = await models.SavedDesign.count({ where: { channelId: req.channel.id } });
    if (count >= maxDesigns()) return res.status(409).json({ message: `Este canal ya llegó al límite de ${maxDesigns()} diseños guardados` });

    const sizeBytes = serializedSize(state);
    if (sizeBytes > maxBytes()) return res.status(413).json({ message: `El diseño pesa demasiado. Máximo permitido: ${Math.round(maxBytes() / 1024 / 1024)} MB` });

    const duplicate = await models.SavedDesign.findOne({ where: { channelId: req.channel.id, name } });
    if (duplicate) return res.status(409).json({ message: 'Ya tienes un diseño con ese nombre' });

    const design = await models.SavedDesign.create({
      channelId: req.channel.id,
      createdBy: req.user.id,
      name,
      state,
      sizeBytes,
      version: DESIGN_VERSION
    });

    logger.info('Diseño guardado', { designId: design.id, channelId: req.channel.id, userId: req.user.id, sizeBytes });
    res.status(201).json(publicDesign(design));
  }

  static async update(req, res) {
    const design = await findDesign(req.channel.id, req.params.designUuid);
    if (!design) return res.status(404).json({ message: 'Diseño no encontrado' });

    const patch = {};
    if (req.body.name != null) {
      const name = normalizeName(req.body.name);
      if (!name) return res.status(400).json({ message: 'Ponle un nombre al diseño' });
      const duplicate = await models.SavedDesign.findOne({ where: { channelId: req.channel.id, name } });
      if (duplicate && Number(duplicate.id) !== Number(design.id)) return res.status(409).json({ message: 'Ya tienes un diseño con ese nombre' });
      patch.name = name;
    }

    if (req.body.state != null) {
      const { error: stateError, state } = validateState(req.body.state);
      if (stateError) return res.status(400).json({ message: stateError });
      const sizeBytes = serializedSize(state);
      if (sizeBytes > maxBytes()) return res.status(413).json({ message: `El diseño pesa demasiado. Máximo permitido: ${Math.round(maxBytes() / 1024 / 1024)} MB` });
      patch.state = state;
      patch.sizeBytes = sizeBytes;
      patch.version = DESIGN_VERSION;
    }

    if (!Object.keys(patch).length) return res.status(400).json({ message: 'No hay cambios para guardar' });
    await design.update(patch);
    logger.info('Diseño actualizado', { designId: design.id, channelId: req.channel.id, userId: req.user.id, sizeBytes: design.sizeBytes });
    res.json(publicDesign(design));
  }

  static async remove(req, res) {
    const design = await findDesign(req.channel.id, req.params.designUuid);
    if (!design) return res.status(404).json({ message: 'Diseño no encontrado' });
    await design.destroy();
    logger.info('Diseño eliminado', { designId: design.id, channelId: req.channel.id, userId: req.user.id });
    res.status(204).end();
  }
}
