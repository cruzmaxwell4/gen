const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { stockCount } = require('../database');
const { CATEGORIES } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stockview')
    .setDescription('View how many accounts are available in each tier'),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const free    = stockCount('free');
    const freeplus = stockCount('free+');
    const premium = stockCount('premium');
    const total   = free + freeplus + premium;

    const bar = (count) => {
      if (count === 0) return '🔴 Out of Stock';
      if (count < 5)  return '🟡 Low Stock';
      return '🟢 In Stock';
    };

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📦 Account Stock')
      .setDescription(`**${total}** total accounts available`)
      .addFields(
        { name: '🟢 Free',    value: `${bar(free)}\n${free} accounts`,     inline: true },
        { name: '🔵 Free+',   value: `${bar(freeplus)}\n${freeplus} accounts`, inline: true },
        { name: '⭐ Premium', value: `${bar(premium)}\n${premium} accounts`, inline: true }
      )
      .setFooter({ text: 'Generator • Use /generate to claim an account' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
