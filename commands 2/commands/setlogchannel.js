const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { setConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlogchannel')
    .setDescription('Set the channel for restock announcements (owner only)')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel for restock announcements (leave blank to disable)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    setConfig('log_channel', channel ? channel.id : '');

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Restock Channel Set')
      .setDescription(channel
        ? `Restock announcements will be posted in <#${channel.id}> whenever you add stock.`
        : 'Restock announcements are now disabled.')
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
