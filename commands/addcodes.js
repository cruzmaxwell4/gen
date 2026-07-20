const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { getConfig, setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcodes')
    .setDescription('Create promotional codes for premium access')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration type for the code')
        .setRequired(true)
        .addChoices(
          { name: '⏳ 1 Day', value: '1DAY' },
          { name: '📅 3 Days', value: '3DAY' },
          { name: '📆 1 Week', value: '1WEEK' },
          { name: '📊 1 Month', value: '1MONTH' },
          { name: '♾️ Lifetime', value: 'LIFETIME' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('amount')
        .setDescription('How many codes to generate')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(50)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    const duration = interaction.options.getString('duration');
    const amount = interaction.options.getInteger('amount');

    // Generate codes
    const codes = [];
    for (let i = 0; i < amount; i++) {
      const code = `PREM${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      codes.push({ code, duration, used: false, used_by: null, created_at: Math.floor(Date.now() / 1000) });
    }

    // Store codes in config as a JSON array
    try {
      const existingCodes = JSON.parse(getConfig('promo_codes', '[]'));
      const updated = [...existingCodes, ...codes];
      setConfig('promo_codes', JSON.stringify(updated));
    } catch (err) {
      console.error('Error saving codes:', err);
      return interaction.reply({ content: '❌ Failed to save codes.', ephemeral: true });
    }

    // Display codes in embed (one per line for easy copy)
    const codeList = codes.map(c => `\`${c.code}\``).join('\n');
    const durationLabel = {
      '1DAY': '⏳ 1 Day',
      '3DAY': '📅 3 Days',
      '1WEEK': '📆 1 Week',
      '1MONTH': '📊 1 Month',
      'LIFETIME': '♾️ Lifetime'
    }[duration];

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('✅ Promotional Codes Created')
      .setDescription(`Generated **${amount}** code(s) with duration: **${durationLabel}**`)
      .addFields({
        name: '📋 Codes',
        value: codeList,
        inline: false
      })
      .setFooter({ text: 'Generator • Share these codes with your community!' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

