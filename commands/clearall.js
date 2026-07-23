const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearall')
    .setDescription('Clear all stock')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

      let clearedItems = 0;

      // Clear stock only
      const stockPath = path.join(dataDir, 'stock.json');
      if (fs.existsSync(stockPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
          for (const key of Object.keys(data)) {
            clearedItems += (data[key] || []).length;
          }
          fs.writeFileSync(stockPath, JSON.stringify({}, null, 2));
        } catch (err) {
          console.error('Error clearing stock:', err);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Stock Cleared!')
        .setDescription('All stock has been cleared.')
        .addFields({
          name: '🗑️ Cleared Items',
          value: `**Total stock items deleted:** ${clearedItems}`,
          inline: false
        })
        .addFields({
          name: '📋 Status',
          value: 'Stock inventory is now **EMPTY**\n✅ Codes are safe\n✅ Accounts are safe',
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Clear Stock' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error clearing stock:', err);
      return interaction.reply({ content: '❌ Failed to clear stock.', ephemeral: true });
    }
  }
};

