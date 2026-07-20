const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { updateUser, getConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('revokepremium')
    .setDescription('Revoke premium access from a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to revoke premium from')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const targetUser = interaction.options.getUser('user');

      // Revoke premium
      updateUser(targetUser.id, {
        subscription: 'none',
        sub_expires: 0
      });

      // Try to remove role
      const roleId = getConfig('role_premium');
      if (roleId && interaction.guild) {
        try {
          const member = await interaction.guild.members.fetch(targetUser.id);
          if (member && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId);
          }
        } catch (err) {
          console.error('⚠️ Failed to remove role:', err?.message || err);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🚫 Premium Revoked')
        .setDescription(`Successfully revoked premium from ${targetUser}`)
        .addFields({
          name: '👤 User',
          value: `${targetUser.username}#${targetUser.discriminator}`,
          inline: false
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error revoking premium:', err);
      return interaction.reply({ content: '❌ Failed to revoke premium.', ephemeral: true });
    }
  }
};

