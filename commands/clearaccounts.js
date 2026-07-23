const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearaccounts')
    .setDescription('Clear all accounts (Premium or Free)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which accounts to clear')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium Accounts', value: 'premium' },
          { name: '🌊 Free Accounts', value: 'free' }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const type = interaction.options.getString('type');
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
      const filePath = path.join(dataDir, `accounts_${type.toUpperCase()}.json`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return interaction.reply({ content: `❌ No ${type} accounts file found.`, ephemeral: true });
      }

      // Read current accounts
      let accountsData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const accountsKey = type;
      const accountCount = (accountsData[accountsKey] || []).length;

      // Clear accounts but keep file structure
      accountsData[accountsKey] = [];
      fs.writeFileSync(filePath, JSON.stringify(accountsData, null, 2));

      const typeLabel = type === 'premium' ? '⭐ Premium' : '🌊 Free';

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('✅ Accounts Cleared')
        .setDescription(`All ${typeLabel} accounts have been deleted!`)
        .addFields({
          name: '📊 Details',
          value: `**Type:** ${typeLabel}\n**Accounts Deleted:** ${accountCount}\n**Remaining:** 0`,
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Codes are still safe' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error clearing accounts:', err);
      return interaction.reply({ content: '❌ Failed to clear accounts.', ephemeral: true });
    }
  }
};

