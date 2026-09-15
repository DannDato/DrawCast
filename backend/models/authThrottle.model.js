import { DataTypes } from 'sequelize';

export default (db) => db.define('AuthThrottle', {
  identifierHash: { type: DataTypes.STRING(64), primaryKey: true, field: 'identifier_hash' },
  failures: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  firstFailureAt: { type: DataTypes.DATE, allowNull: true, field: 'first_failure_at' },
  lastFailureAt: { type: DataTypes.DATE, allowNull: true, field: 'last_failure_at' },
  lockedUntil: { type: DataTypes.DATE, allowNull: true, field: 'locked_until' }
}, { tableName: 'auth_throttles' });
