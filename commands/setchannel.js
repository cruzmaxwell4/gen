const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the channel for code claim logs')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to send code claim logs to')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const channel = interaction.options.getChannel('channel');

      // Validate channel is text-based
      if (!channel?.isTextBased?.()) {
        return interaction.reply({ content: '❌ Channel must be a text channel.', ephemeral: true });
      }

      // Validate bot has permission to send messages
      if (!channel.permissionsFor(interaction.client.user)?.has('SendMessages')) {
        return interaction.reply({ content: '❌ Bot does not have permission to send messages in that channel.', ephemeral: true });
      }

      // Save channel ID to config
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
          value: 'When someone claims a code:\n• User profile picture\n• Username\n• Subscription duration claimed\n• Code used\n• Timestamp',
          inline: false
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error setting log channel:', err);
      return interaction.reply({ content: '❌ Failed to set log channel.', ephemeral: true });
    }
  }
};

