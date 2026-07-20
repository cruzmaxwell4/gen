const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { getConfig, setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearcodes')
    .setDescription('Clear all promotional codes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const allCodes = JSON.parse(getConfig('promo_codes', '[]'));
      const count = allCodes.length;

      setConfig('promo_codes', JSON.stringify([]));

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Codes Cleared')
        .setDescription(`Cleared **${count}** promotional code(s)`)
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error clearing codes:', err);
      return interaction.reply({ content: '❌ Failed to clear codes.', ephemeral: true });
    }
  }
};

