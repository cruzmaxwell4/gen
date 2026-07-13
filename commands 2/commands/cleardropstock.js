const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { clearDropStock } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cleardropstock')
    .setDescription('Clear the drop stock pool (owner only)')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Category to clear (leave blank for all)')
        .setRequired(false)
        .addChoices(
          { name: 'Free', value: 'free' },
          { name: 'Free+', value: 'free+' },
          { name: 'Premium', value: 'premium' }
        )
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getString('category') || null;
    const removed = clearDropStock(category);

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🗑️ Drop Stock Cleared')
      .setDescription(category ? `Cleared drop stock for **${category}**.` : 'Cleared **all** drop stock.')
      .addFields({ name: 'Removed', value: String(removed), inline: true })
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
