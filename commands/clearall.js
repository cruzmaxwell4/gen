const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearall')
    .setDescription('Clear ALL codes, accounts, and stock (WARNING: Cannot be undone!)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

      let clearedItems = 0;

      // Clear premium codes
      const premiumCodesPath = path.join(dataDir, 'codes_PREMIUM.json');
      if (fs.existsSync(premiumCodesPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(premiumCodesPath, 'utf8'));
          clearedItems += (data.premium || []).length;
          fs.writeFileSync(premiumCodesPath, JSON.stringify({ premium: [] }, null, 2));
        } catch (err) {
          console.error('Error clearing premium codes:', err);
        }
      }

      // Clear free codes
      const freeCodesPath = path.join(dataDir, 'codes_FREE.json');
      if (fs.existsSync(freeCodesPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(freeCodesPath, 'utf8'));
          clearedItems += (data.free || []).length;
          fs.writeFileSync(freeCodesPath, JSON.stringify({ free: [] }, null, 2));
        } catch (err) {
          console.error('Error clearing free codes:', err);
        }
      }

      // Clear premium accounts
      const premiumAccountsPath = path.join(dataDir, 'accounts_PREMIUM.json');
      if (fs.existsSync(premiumAccountsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(premiumAccountsPath, 'utf8'));
          clearedItems += (data.premium || []).length;
          fs.writeFileSync(premiumAccountsPath, JSON.stringify({ premium: [] }, null, 2));
        } catch (err) {
          console.error('Error clearing premium accounts:', err);
        }
      }

      // Clear free accounts
      const freeAccountsPath = path.join(dataDir, 'accounts_FREE.json');
      if (fs.existsSync(freeAccountsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(freeAccountsPath, 'utf8'));
          clearedItems += (data.free || []).length;
          fs.writeFileSync(freeAccountsPath, JSON.stringify({ free: [] }, null, 2));
        } catch (err) {
          console.error('Error clearing free accounts:', err);
        }
      }

      // Clear stock
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
        .setColor(0xED4245)
        .setTitle('✅ Everything Cleared!')
        .setDescription('**⚠️ WARNING: All data has been permanently deleted!**')
        .addFields({
          name: '🗑️ Cleared Items',
          value: `**Total items deleted:** ${clearedItems}`,
          inline: false
        })
        .addFields({
          name: '📋 What Was Deleted',
          value: '✅ All premium codes\n✅ All free codes\n✅ All premium accounts\n✅ All free accounts\n✅ All stock',
          inline: false
        })
        .addFields({
          name: '⚠️ Status',
          value: 'All inventories are now **EMPTY**',
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Clear All' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error clearing all:', err);
      return interaction.reply({ content: '❌ Failed to clear all data.', ephemeral: true });
    }
  }
};

