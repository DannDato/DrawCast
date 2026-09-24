import { models, db } from '../models/index.js';
import { resolveChannelEntitlements } from '../services/entitlementCatalogService.js';
import { publicChannelEntitlements } from '../services/channelEntitlementAccessService.js';

const [command, channelUuid, bundleKey = 'canvas.plus'] = process.argv.slice(2);

function usage() {
  console.log('Uso:');
  console.log('  npm run entitlement -- show <channelUuid>');
  console.log('  npm run entitlement -- grant <channelUuid> [bundleKey]');
  console.log('  npm run entitlement -- revoke <channelUuid> [bundleKey]');
}

async function main() {
  if (!['show', 'grant', 'revoke'].includes(command) || !channelUuid) {
    usage();
    process.exitCode = 1;
    return;
  }

  const channel = await models.Channel.findOne({ where: { uuid: channelUuid } });
  if (!channel) throw new Error(`No existe un lienzo con UUID ${channelUuid}`);

  if (command !== 'show') {
    const bundle = await models.EntitlementBundle.findOne({ where: { key: bundleKey, scope: 'channel', active: true } });
    if (!bundle) throw new Error(`No existe el bundle activo ${bundleKey}`);
    const sourceRef = `dev-cli:${bundleKey}`;

    if (command === 'grant') {
      const [assignment] = await models.ChannelEntitlement.findOrCreate({
        where: { channelId: channel.id, bundleId: bundle.id, sourceType: 'admin', sourceRef },
        defaults: { status: 'ACTIVE', metadata: { source: 'dev-cli' } }
      });
      if (assignment.status !== 'ACTIVE' || assignment.endsAt) await assignment.update({ status: 'ACTIVE', startsAt: null, endsAt: null });
      console.log(`✓ ${bundleKey} aplicado a ${channel.name} (${channel.uuid})`);
    } else {
      const deleted = await models.ChannelEntitlement.destroy({ where: { channelId: channel.id, bundleId: bundle.id, sourceType: 'admin', sourceRef } });
      console.log(deleted ? `✓ ${bundleKey} retirado de ${channel.name}` : `· No había una asignación dev-cli de ${bundleKey} en este lienzo`);
    }
  }

  const resolved = publicChannelEntitlements(await resolveChannelEntitlements(channel.id));
  console.log(JSON.stringify({ channel: { uuid: channel.uuid, name: channel.name }, ...resolved }, null, 2));
}

main().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
}).finally(async () => {
  await db.close();
});
