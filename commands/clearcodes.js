const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { clearStock } = require('../database');

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
      const durations = ['1DAY', '3DAY', '1WEEK', '1MONTH', 'LIFETIME'];
      let totalCleared = 0;

      for (const dur of durations) {
        const count = clearStock(dur, `codes_${dur}`);
        totalCleared += count;
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ All Codes Cleared')
        .setDescription(`Cleared **${totalCleared}** promotional code(s) across all tiers`)
        .addFields({
          name: '📊 Breakdown',
          value: durations.map(d => `**${d}**: Cleared`).join('\n'),
          inline: false
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error clearing codes:', err);
      return interaction.reply({ content: '❌ Failed to clear codes.', ephemeral: true });
    }
  }
};

