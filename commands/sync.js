const { SlashCommandBuilder, EmbedBuilder, REST, Routes } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Owner only: Force sync all slash commands globally'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Owner only.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });

    try {
      const commands = [];
      const files = fs.readdirSync(__dirname).filter(f => f.endsWith('.js'));
      for (const file of files) {
        const cmd = require(path.join(__dirname, file));
        if (cmd.data) commands.push(cmd.data.toJSON());
      }

      const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Commands Synced')
        .addFields({ name: 'Commands Registered', value: String(commands.length), inline: true })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ Sync failed: ${err.message}`);
    }
  }
};
