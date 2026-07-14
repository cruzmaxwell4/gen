const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkchannel')
    .setDescription('Check the current generate channel setting (owner only)'),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const channelId = getConfig('gen_channel');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📋 Gen Channel')
      .setDescription(channelId ? `Generate restricted to <#${channelId}>` : 'Generate allowed in all channels')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
