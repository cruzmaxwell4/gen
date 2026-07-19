const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig, getConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set channel tier restrictions for /generate (owner only)')
    .addStringOption(opt =>
      opt.setName('tier')
        .setDescription('Which tier can ONLY use /generate in this channel')
        .setRequired(true)
        .addChoices(
          { name: '🌊 Free Only', value: 'free' },
          { name: '🌊 Free+ Only', value: 'free+' },
          { name: '🌟 Premium Only', value: 'premium' }
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
    setConfig('gen_channel_tier', tier);
    
    // Save channel ID
    setConfig('gen_channel', channel ? channel.id : '');

    const tierEmoji = {
      free: '🌊',
      'free+': '🌊',
      premium: '🌟'
    }[tier];

    const tierLabel = {
      free: 'Free',
      'free+': 'Free+',
      premium: 'Premium'
    }[tier];

    let description = '';

    if (!channel) {
      description = `✅ **Only ${tierEmoji} ${tierLabel} can use /generate (all channels)**`;
    } else {
      description = `✅ **Only ${tierEmoji} ${tierLabel} can use /generate in <#${channel.id}>**`;
    }

    description += '\n\n**Access:**\n';
    
    if (tier === 'free') {
      description += '🌊 Free ✅\n🌊 Free+ ❌\n🌟 Premium ❌';
    } else if (tier === 'free+') {
      description += '🌊 Free ❌\n🌊 Free+ ✅\n🌟 Premium ❌';
    } else if (tier === 'premium') {
      description += '🌊 Free ❌\n🌊 Free+ ❌\n🌟 Premium ✅';
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Channel Tier Restriction Set')
      .setDescription(description)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};

