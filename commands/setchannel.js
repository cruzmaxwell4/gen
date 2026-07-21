const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { setConfig, getConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set a channel (log channel or generation channel)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which channel to set')
        .setRequired(true)
        .addChoices(
          { name: '📋 Code Claim Logs', value: 'logs' },
          { name: '🌊 Free Generation', value: 'free' },
          { name: '🔵 Free+ Generation', value: 'freeplus' },
          { name: '⭐ Premium Generation', value: 'premium' }
        )
    )
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to set')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const type = interaction.options.getString('type');
      const channel = interaction.options.getChannel('channel');

      // Validate channel is text-based
      if (!channel?.isTextBased?.()) {
        return interaction.reply({ content: '❌ Channel must be a text channel.', ephemeral: true });
      }

      // Validate bot has permission to send messages
      if (!channel.permissionsFor(interaction.client.user)?.has('SendMessages')) {
        return interaction.reply({ content: '❌ Bot does not have permission to send messages in that channel.', ephemeral: true });
      }

      // Save based on type
      if (type === 'logs') {
        setConfig('log_channel', channel.id);
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Log Channel Set')
          .setDescription(`Code claim logs will now be sent to ${channel}`)
          .addFields({
            name: '📋 Details',
            value: `**Channel:** ${channel.name}\n**Channel ID:** ${channel.id}`,
            inline: false
          })
          .addFields({
            name: '📝 What Gets Logged',
            value: 'When someone claims a code:\n• User profile picture\n• Username\n• Subscription duration\n• Code used\n• Timestamp',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (type === 'free') {
        const mode = getConfig('gen_channel_tiers', '');
        if (!mode || mode === 'all') {
          return interaction.reply({ content: '❌ First run `/genchannels custom` to enable custom channel setup!', ephemeral: true });
        }

        setConfig('free_channel', channel.id);
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Free Channel Set')
          .setDescription(`🌊 Free accounts can now only be generated in ${channel}`)
          .addFields({
            name: '📋 Details',
            value: `**Channel:** ${channel.name}\n**Channel ID:** ${channel.id}`,
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (type === 'freeplus') {
        const mode = getConfig('gen_channel_tiers', '');
        if (!mode || mode === 'all') {
          return interaction.reply({ content: '❌ First run `/genchannels custom` to enable custom channel setup!', ephemeral: true });
        }

        setConfig('freeplus_channel', channel.id);
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Free+ Channel Set')
          .setDescription(`🔵 Free+ accounts can now only be generated in ${channel}`)
          .addFields({
            name: '📋 Details',
            value: `**Channel:** ${channel.name}\n**Channel ID:** ${channel.id}`,
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (type === 'premium') {
        const mode = getConfig('gen_channel_tiers', '');
        if (!mode || mode === 'all') {
          return interaction.reply({ content: '❌ First run `/genchannels custom` to enable custom channel setup!', ephemeral: true });
        }

        setConfig('premium_channel', channel.id);
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Premium Channel Set')
          .setDescription(`⭐ Premium accounts can now only be generated in ${channel}`)
          .addFields({
            name: '📋 Details',
            value: `**Channel:** ${channel.name}\n**Channel ID:** ${channel.id}`,
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      console.error('Error setting channel:', err);
      return interaction.reply({ content: '❌ Failed to set channel.', ephemeral: true });
    }
  }
};

