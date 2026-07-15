const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { clearStock, stockCount } = require('../database');
const { isOwner } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clearstock')
    .setDescription('Clear all stock for a category (owner only)')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Which category to clear')
        .setRequired(true)
        .addChoices(
          { name: '🌊 Free',    value: 'free' },
          { name: '🌊 Free+',   value: 'free+' },
          { name: '🌟 Premium', value: 'premium' }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ No Permission')
        .setDescription('Only the bot owner can use this command.')
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const category = interaction.options.getString('category');
    const before = stockCount(category);
    const cleared = clearStock(category);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🗑️ Stock Cleared')
      .addFields(
        { name: 'Category', value: category, inline: true },
        { name: 'Cleared', value: `${cleared} accounts`, inline: true },
        { name: 'Remaining', value: `${stockCount(category)} accounts`, inline: true }
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};

