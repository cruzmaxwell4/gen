const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { stockCount } = require('../database');
const { isOwner } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkstock')
    .setDescription('View current stock levels for all categories'),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "❌ You don't have permission to use this command.",
        ephemeral: true
      });
    }

    const free = stockCount('free');
    const freeplus = stockCount('free+');
    const premium = stockCount('premium');

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📦 Stock Levels')
      .setDescription(
        `🟢 **Free Accounts**: ${free}\n` +
        `🔵 **Free+ Accounts**: ${freeplus}\n` +
        `⭐ **Premium Accounts**: ${premium}`
      )
      .setFooter({ text: `Last checked: ${new Date().toLocaleString()}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
