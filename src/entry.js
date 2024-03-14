const { defineCommand, runMain } = require('citty');
const { gc } = require('./gc');

const region = { type: 'string', description: 'AWS region', required: true };
const profile = { type: 'string', description: 'AWS profile' };
const templates = { type: 'boolean', description: 'Should also exclude the .json files (templates)', default: false };
const yes = { type: 'boolean', description: 'Confirm removal' };

const command = defineCommand({
  subCommands: {
    gc: {
      args: { profile, region, yes, templates },
      async run(ctx) {
        await gc(ctx);
      }
    }
  }
});

runMain(command).then();