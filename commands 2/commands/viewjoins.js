const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getJoinsByInviter } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('viewjoins')
    .setDescription('View users who joined via a specific inviter (owner only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Inviter to check').setRequired(true)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user');
    const joins = getJoinsByInviter(target.id).slice(0, 20);

    if (joins.length === 0) return interaction.editReply(`📭 <@${target.id}> has no tracked joins.`);

    const lines = joins.map(j => `<@${j.user_id}> • \`${j.code}\` • <t:${j.joined_at}:R>`);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`📨 Joins via @${target.username}`)
      .setDescription(lines.join('\n').substring(0, 4096))
      .setFooter({ text: `${joins.length} shown • Generator` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
