const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { addStockBulk } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcodes')
    .setDescription('Create promotional codes from a file')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration type for the codes')
        .setRequired(true)
        .addChoices(
          { name: '⏳ 1 Day', value: '1DAY' },
          { name: '📅 3 Days', value: '3DAY' },
          { name: '📆 1 Week', value: '1WEEK' },
          { name: '📊 1 Month', value: '1MONTH' },
          { name: '♾️ Lifetime', value: 'LIFETIME' }
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

    const duration = interaction.options.getString('duration');
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

      // Store codes in stock - category is duration, table is codes_DURATION
      const table = `codes_${duration}`;
      const added = addStockBulk(duration, codes, table);

      if (added === 0) {
        return interaction.editReply({ content: '❌ Failed to save codes.' });
      }

      const durationLabel = {
        '1DAY': '⏳ 1 Day',
        '3DAY': '📅 3 Days',
        '1WEEK': '📆 1 Week',
        '1MONTH': '📊 1 Month',
        'LIFETIME': '♾️ Lifetime'
      }[duration];

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Codes Added Successfully')
        .setDescription(`Added **${added}** code(s) to **${durationLabel}** tier`)
        .addFields({
          name: '📊 Details',
          value: `**File:** ${attachment.name}\n**Duration:** ${durationLabel}\n**Codes Imported:** ${added}`,
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

