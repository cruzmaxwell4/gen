const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig, getConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the generate command channel and allowed tier (owner only)')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel where /generate is allowed (leave blank = all channels)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('tier')
        .setDescription('Which tier can use this channel (default: all tiers)')
        .setRequired(false)
        .addChoices(
          { name: '🌊 Free Only', value: 'free' },
          { name: '🌊 Free+ Only', value: 'free+' },
          { name: '🌟 Premium Only', value: 'premium' },
          { name: '🌊 Free & Free+ (no Premium)', value: 'free,free+' },
          { name: '🌊 Free & Premium (no Free+)', value: 'free,premium' },
          { name: '🌊 Free+ & Premium (no Free)', value: 'free+,premium' },
          { name: '🌊 All Tiers (no restriction)', value: 'all' }
        )
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const tier = interaction.options.getString('tier') || 'all';

    // Save channel ID
    setConfig('gen_channel', channel ? channel.id : '');
    
    // Save tier restriction
    setConfig('gen_channel_tier', tier === 'all' ? '' : tier);

    let description = '';

    if (!channel) {
      description = '✅ **Generate allowed in all channels**';
    } else {
      description = `✅ **Generate restricted to <#${channel.id}>**`;
    }

    description += '\n\n**Tier Access:**\n';

    if (!tier || tier === 'all') {
      description += '🌊 Free\n🌊 Free+\n🌟 Premium\n(All tiers can use this channel)';
    } else if (tier === 'free') {
      description += '🌊 Free (only)\n❌ Free+ blocked\n❌ Premium blocked';
    } else if (tier === 'free+') {
      description += '❌ Free blocked\n🌊 Free+ (only)\n❌ Premium blocked';
    } else if (tier === 'premium') {
      description += '❌ Free blocked\n❌ Free+ blocked\n🌟 Premium (only)';
    } else if (tier === 'free,free+') {
      description += '🌊 Free\n🌊 Free+\n❌ Premium blocked';
    } else if (tier === 'free,premium') {
      description += '🌊 Free\n❌ Free+ blocked\n🌟 Premium';
    } else if (tier === 'free+,premium') {
      description += '❌ Free blocked\n🌊 Free+\n🌟 Premium';
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Channel & Tier Set')
      .setDescription(description)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

