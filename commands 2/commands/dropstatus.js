const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDropConfig, dropStockCount } = require('../database');
const { ownerOnly, CATEGORIES } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropstatus')
    .setDescription('Check the drop system status (owner only)'),

  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const active = client.isDropActive();
    const channelId = getDropConfig('channel_id', null);
    const cooldown = getDropConfig('cooldown', '300');
    const total = CATEGORIES.reduce((s, c) => s + dropStockCount(c), 0);

    const embed = new EmbedBuilder()
      .setColor(active ? 0x57F287 : 0xED4245)
      .setTitle('🎁 Drop Status')
      .addFields(
        { name: 'Status', value: active ? '🟢 Active' : '🔴 Inactive', inline: true },
        { name: 'Channel', value: channelId ? `<#${channelId}>` : 'Not set', inline: true },
        { name: 'Interval', value: `${cooldown}s`, inline: true },
        { name: 'Drop Stock', value: `${total} total accounts`, inline: false }
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
