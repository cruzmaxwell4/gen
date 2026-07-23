const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkstockcode')
    .setDescription('Check all codes and accounts in stock')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

      // Count premium codes
      const premiumCodesPath = path.join(dataDir, 'codes_PREMIUM.json');
      let premiumCodesCount = 0;
      if (fs.existsSync(premiumCodesPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(premiumCodesPath, 'utf8'));
          premiumCodesCount = (data.premium || []).length;
        } catch (err) {
          console.error('Error reading premium codes:', err);
        }
      }

      // Count free codes
      const freeCodesPath = path.join(dataDir, 'codes_FREE.json');
      let freeCodesCount = 0;
      if (fs.existsSync(freeCodesPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(freeCodesPath, 'utf8'));
          freeCodesCount = (data.free || []).length;
        } catch (err) {
          console.error('Error reading free codes:', err);
        }
      }

      // Count premium accounts
      const premiumAccountsPath = path.join(dataDir, 'accounts_PREMIUM.json');
      let premiumAccountsCount = 0;
      if (fs.existsSync(premiumAccountsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(premiumAccountsPath, 'utf8'));
          premiumAccountsCount = (data.premium || []).length;
        } catch (err) {
          console.error('Error reading premium accounts:', err);
        }
      }

      // Count free accounts
      const freeAccountsPath = path.join(dataDir, 'accounts_FREE.json');
      let freeAccountsCount = 0;
      if (fs.existsSync(freeAccountsPath)) {
        try {
          const data = JSON.parse(fs.readFileSync(freeAccountsPath, 'utf8'));
          freeAccountsCount = (data.free || []).length;
        } catch (err) {
          console.error('Error reading free accounts:', err);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📊 Stock Check - Codes & Accounts')
        .setDescription('Current inventory status')
        .addFields({
          name: '⭐ Premium Codes',
          value: `📦 **${premiumCodesCount}** codes remaining`,
          inline: true
        })
        .addFields({
          name: '🌊 Free Codes',
          value: `📦 **${freeCodesCount}** codes available`,
          inline: true
        })
        .addFields({
          name: '⭐ Premium Accounts',
          value: `👤 **${premiumAccountsCount}** accounts in stock`,
          inline: true
        })
        .addFields({
          name: '🌊 Free Accounts',
          value: `👤 **${freeAccountsCount}** accounts available`,
          inline: true
        })
        .addFields({
          name: '📋 Summary',
          value: `**Premium:** ${premiumCodesCount} codes + ${premiumAccountsCount} accounts\n**Free:** ${freeCodesCount} codes + ${freeAccountsCount} accounts`,
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Stock Check' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error checking stock:', err);
      return interaction.reply({ content: '❌ Failed to check stock.', ephemeral: true });
    }
  }
};

