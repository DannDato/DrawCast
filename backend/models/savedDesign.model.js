import { DataTypes } from 'sequelize';

function decodeJsonValue(value) {
  let current = value;
  for (let i = 0; i < 3 && typeof current === 'string'; i += 1) {
    try { current = JSON.parse(current); } catch { return current; }
  }
  return current;
}

export default (db) => db.define('SavedDesign', {
  id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
  channelId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'channel_id' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: 'created_by' },
  name: { type: DataTypes.STRING(120), allowNull: false },
  state: {
    type: DataTypes.JSON,
    allowNull: false,
    get() { return decodeJsonValue(this.getDataValue('state')); },
    set(value) { this.setDataValue('state', decodeJsonValue(value)); }
  },
  sizeBytes: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: 'size_bytes' },
  version: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 }
}, {
  tableName: 'saved_designs',
  indexes: [
    { fields: ['channel_id'] },
    { fields: ['created_by'] },
    { unique: true, fields: ['channel_id', 'name'] }
  ]
});
