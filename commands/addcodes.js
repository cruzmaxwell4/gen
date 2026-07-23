const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { addStockBulk } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcodes')
    .setDescription('Add promotional codes (Premium or Free)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Code type')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium Codes (One-time use)', value: 'premium' },
          { name: '🌊 Free Codes (Reusable)', value: 'free' }
        )
    )
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('Text file with codes (one per line)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const attachment = interaction.options.getAttachment('file');

    // Validate file type
    if (!attachment.name.endsWith('.txt')) {
      return interaction.reply({ content: '❌ Please upload a `.txt` file.', ephemeral: true });
    }

    // Validate file size (max 10MB to be safe)
    if (attachment.size > 10 * 1024 * 1024) {
      return interaction.reply({ content: '❌ File is too large. Max 10MB.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Download file content
      const response = await fetch(attachment.url);
      const text = await response.text();

      // Parse codes (one per line, trim whitespace)
      const codes = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (codes.length === 0) {
        return interaction.editReply({ content: '❌ No valid codes found in the file.' });
      }

      // Store codes in stock - table is codes_PREMIUM or codes_FREE
      const table = `codes_${type.toUpperCase()}`;
      const added = addStockBulk(type, codes, table);

      if (added === 0) {
        return interaction.editReply({ content: '❌ Failed to save codes.' });
      }

      const typeLabel = type === 'premium' ? '⭐ Premium' : '🌊 Free';
      const reuseInfo = type === 'free' ? '🔄 Reusable (can be claimed multiple times)' : '🔐 One-time use (deleted after claim)';

      const embed = new EmbedBuilder()
        .setColor(type === 'premium' ? 0xFEE75C : 0x57F287)
        .setTitle('✅ Codes Added Successfully')
        .setDescription(`Added **${added}** ${typeLabel} code(s)`)
        .addFields({
          name: '📊 Details',
          value: `**File:** ${attachment.name}\n**Type:** ${typeLabel}\n**Codes Imported:** ${added}`,
          inline: false
        })
        .addFields({
          name: '📝 Code Info',
          value: reuseInfo,
          inline: false
        })
        .setFooter({ text: 'Generator • Codes are ready to claim!' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error processing codes file:', err);
      return interaction.editReply({ content: '❌ Failed to process the file. Make sure it\'s a valid text file.' });
    }
  }
};

