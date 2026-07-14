const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { dropStockCount } = require('../database');
const { ownerOnly, CATEGORIES } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewdropstock')
    .setDescription('View current drop stock pool (owner only)'),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const fields = CATEGORIES.map(cat => ({
      name: cat, value: `${dropStockCount(cat)} accounts`, inline: true
    }));
    const total = CATEGORIES.reduce((s, c) => s + dropStockCount(c), 0);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎁 Drop Stock Overview')
      .setDescription(`**${total}** total accounts in drop pool`)
      .addFields(fields)
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
