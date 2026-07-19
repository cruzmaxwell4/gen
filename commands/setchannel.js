const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig, getConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set channel tier restrictions for /generate (owner only)')
    .addStringOption(opt =>
      opt.setName('tier')
        .setDescription('Which tier(s) can use /generate in this channel')
        .setRequired(true)
        .addChoices(
          { name: '🌊 Free Only', value: 'free' },
          { name: '🌊 Free+ Only', value: 'free+' },
          { name: '🌟 Premium Only', value: 'premium' },
          { name: '🌊 Free & Free+ (no Premium)', value: 'free,free+' },
          { name: '🌊 Free & Premium (no Free+)', value: 'free,premium' },
          { name: '🌊 Free+ & Premium (no Free)', value: 'free+,premium' },
          { name: '🌊 All Tiers (no restriction)', value: 'all' }
        )
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to restrict (leave blank = all channels)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const tier = interaction.options.getString('tier');
    const channel = interaction.options.getChannel('channel');

    // Save tier restriction
    setConfig('gen_channel_tier', tier === 'all' ? '' : tier);
    
    // Save channel ID
    setConfig('gen_channel', channel ? channel.id : '');

    let description = '';

    if (!channel) {
      description = '✅ **Tier restriction applies to all channels**';
    } else {
      description = `✅ **Tier restriction applies to <#${channel.id}>**`;
    }

    description += '\n\n**Tier Access:**\n';

    if (!tier || tier === 'all') {
      description += '🌊 Free\n🌊 Free+\n🌟 Premium\n(All tiers can use /generate)';
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
      .setTitle('✅ Tier Restriction Set')
      .setDescription(description)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

