const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { setConfig, getConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcooldownclaim')
    .setDescription('Set cooldown for free and premium claims')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which claim to set cooldown for')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium Claims', value: 'premium' },
          { name: '🌊 Free Claims', value: 'free' }
        )
    )
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Cooldown in seconds (0 = no cooldown)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(604800) // Max 1 week
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const type = interaction.options.getString('type');
      const seconds = interaction.options.getInteger('seconds');

      // Set cooldown in config
      setConfig(`cooldown_${type}`, String(seconds));

      // Format seconds to readable time
      let readableTime = '';
      if (seconds === 0) {
        readableTime = 'No cooldown';
      } else if (seconds < 60) {
        readableTime = `${seconds} second${seconds !== 1 ? 's' : ''}`;
      } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        readableTime = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
      } else if (seconds < 86400) {
        const hours = Math.floor(seconds / 3600);
        readableTime = `${hours} hour${hours !== 1 ? 's' : ''}`;
      } else {
        const days = Math.floor(seconds / 86400);
        readableTime = `${days} day${days !== 1 ? 's' : ''}`;
      }

      const typeLabel = type === 'premium' ? '⭐ Premium' : '🌊 Free';

      const embed = new EmbedBuilder()
        .setColor(type === 'premium' ? 0xFEE75C : 0x57F287)
        .setTitle('✅ Cooldown Set')
        .setDescription(`${typeLabel} claim cooldown updated!`)
        .addFields({
          name: '📋 Details',
          value: `**Type:** ${typeLabel}\n**Cooldown:** ${readableTime}\n**Seconds:** ${seconds}`,
          inline: false
        })
        .addFields({
          name: '⏱️ How it works',
          value: `Users must wait **${readableTime}** between claims.\n${seconds === 0 ? 'No waiting required!' : 'Timer resets on each claim.'}`,
          inline: false
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error setting cooldown:', err);
      return interaction.reply({ content: '❌ Failed to set cooldown.', ephemeral: true });
    }
  }
};

