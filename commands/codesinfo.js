const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { stockCount } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('codesinfo')
    .setDescription('View promotional code stock status')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const durations = ['1DAY', '3DAY', '1WEEK', '1MONTH', 'LIFETIME'];
      const durationLabels = {
        '1DAY': '⏳ 1 Day',
        '3DAY': '📅 3 Days',
        '1WEEK': '📆 1 Week',
        '1MONTH': '📊 1 Month',
        'LIFETIME': '♾️ Lifetime'
      };

      let totalCodes = 0;
      const stockInfo = durations.map(dur => {
        const count = stockCount(`codes_${dur}`);
        totalCodes += count;
        const emoji = count > 0 ? '✅' : '⚠️';
        return `${emoji} **${durationLabels[dur]}**: ${count} code(s)`;
      }).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Promotional Code Stock Status')
        .setDescription(stockInfo)
        .addFields({
          name: '📈 Total',
          value: `**${totalCodes}** code(s) available`,
          inline: false
        })
        .setFooter({ text: 'Generator • Use /addcodes to import more codes' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error getting code info:', err);
      return interaction.reply({ content: '❌ Failed to retrieve code information.', ephemeral: true });
    }
  }
};

