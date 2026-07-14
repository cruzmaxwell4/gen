const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { stockCount } = require('../database');
const { ownerOnly, CATEGORIES } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewstock')
    .setDescription('View current stock counts (owner only)'),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const fields = CATEGORIES.map(cat => ({
      name: cat, value: `${stockCount(cat)} accounts`, inline: true
    }));
    const total = CATEGORIES.reduce((s, c) => s + stockCount(c), 0);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📦 Stock Overview')
      .setDescription(`**${total}** total accounts across all categories`)
      .addFields(fields)
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
