const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { updateUser } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetplustime')
    .setDescription('Reset plus time for a user (owner only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Target user').setRequired(true)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user');
    updateUser(target.id, { plus_time: 0 });

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔄 Plus Time Reset')
      .setDescription(`Plus time reset for <@${target.id}>.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
