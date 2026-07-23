const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearcodes')
    .setDescription('Clear all promotional codes (Premium or Free)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which codes to clear')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium Codes', value: 'premium' },
          { name: '🌊 Free Codes', value: 'free' }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const type = interaction.options.getString('type');
      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
      const filePath = path.join(dataDir, `codes_${type.toUpperCase()}.json`);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return interaction.reply({ content: `❌ No ${type} codes file found.`, ephemeral: true });
      }

      // Read current codes
      let codesData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const codesKey = type;
      const codeCount = (codesData[codesKey] || []).length;

      // Clear codes but keep file structure
      codesData[codesKey] = [];
      fs.writeFileSync(filePath, JSON.stringify(codesData, null, 2));

      const typeLabel = type === 'premium' ? '⭐ Premium' : '🌊 Free';

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('✅ Codes Cleared')
        .setDescription(`All ${typeLabel} codes have been deleted!`)
        .addFields({
          name: '📊 Details',
          value: `**Type:** ${typeLabel}\n**Codes Deleted:** ${codeCount}\n**Remaining:** 0`,
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Accounts are still safe' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error clearing codes:', err);
      return interaction.reply({ content: '❌ Failed to clear codes.', ephemeral: true });
    }
  }
};

