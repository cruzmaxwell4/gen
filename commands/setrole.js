const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { getConfig, setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setrole')
    .setDescription('Set the premium role ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('The premium role to assign to users')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const role = interaction.options.getRole('role');

      // Validate role
      if (!role) {
        return interaction.reply({ content: '❌ Invalid role selected.', ephemeral: true });
      }

      if (role.managed) {
        return interaction.reply({ content: '❌ Cannot use managed roles (bot roles, integration roles, etc).', ephemeral: true });
      }

      // Save role ID
      setConfig('role_premium', role.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Premium Role Set')
        .setDescription(`Successfully set premium role to ${role}`)
        .addFields({
          name: '📋 Details',
          value: `**Role:** ${role.name}\n**Role ID:** ${role.id}`,
          inline: false
        })
        .addFields({
          name: '📝 Note',
          value: 'This role will be automatically assigned when users claim premium codes.',
          inline: false
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error setting role:', err);
      return interaction.reply({ content: '❌ Failed to set premium role.', ephemeral: true });
    }
  }
};

