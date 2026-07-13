const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setDropConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropstop')
    .setDescription('Stop the auto drop system (owner only)'),

  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    setDropConfig('active', 'false');
    client.stopDrop();

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🛑 Drop Stopped')
      .setDescription('The auto drop system has been stopped.')
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
