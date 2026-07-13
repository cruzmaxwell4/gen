const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the generate command channel (owner only)')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel where /generate is allowed (leave blank = all channels)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    setConfig('gen_channel', channel ? channel.id : '');

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Gen Channel Set')
      .setDescription(channel ? `Generate restricted to <#${channel.id}>.` : 'Generate allowed in all channels.')
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
