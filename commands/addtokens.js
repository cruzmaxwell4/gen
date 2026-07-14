const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, incrementUserField } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addtokens')
    .setDescription('Add tokens to a user (owner only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Target user').setRequired(true)
    )
    .addIntegerOption(opt =>
      opt.setName('amount').setDescription('Number of tokens to add').setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');

    incrementUserField(target.id, 'tokens', amount);
    const updated = getUser(target.id);

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🪙 Tokens Added')
      .addFields(
        { name: 'User', value: `<@${target.id}>`, inline: true },
        { name: 'Added', value: String(amount), inline: true },
        { name: 'New Balance', value: String(updated.tokens), inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
