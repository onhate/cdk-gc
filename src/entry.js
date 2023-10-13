const { defineCommand, runMain } = require('citty');
const { gc } = require('./gc');

const profile = { type: 'string', description: 'AWS profile', required: true };
const region = { type: 'string', description: 'AWS region', required: true };
const yes = { type: 'boolean', description: 'Confirm removal' };

const command = defineCommand({
  subCommands: {
    gc: {
      args: { profile, region, yes },
      async run(ctx) {
        await gc(ctx);
      }
    }
  }
});

runMain(command).then();