require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

async function registerCommands() {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const cmd = require(path.join(commandsPath, file));
    if (cmd.data) commands.push(cmd.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);

  console.log(`🔄 Registering ${commands.length} slash commands globally...`);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ Commands registered successfully!');
}

module.exports = { registerCommands };

// Allow running directly: node deploy-commands.js
if (require.main === module) {
  registerCommands().catch(err => {
    console.error('❌ Failed to register commands:', err);
    process.exit(1);
  });
}
