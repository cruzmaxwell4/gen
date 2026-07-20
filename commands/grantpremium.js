const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { getUser, updateUser, getConfig } = require('../database');

const DURATION_SECONDS = {
  '1DAY': 86400,
  '3DAY': 259200,
  '1WEEK': 604800,
  '1MONTH': 2592000
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('grantpremium')
    .setDescription('Manually grant premium access to a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to grant premium to')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Duration of premium access')
        .setRequired(true)
        .addChoices(
          { name: '⏳ 1 Day', value: '1DAY' },
          { name: '📅 3 Days', value: '3DAY' },
          { name: '📆 1 Week', value: '1WEEK' },
          { name: '📊 1 Month', value: '1MONTH' },
          { name: '♾️ Lifetime', value: 'LIFETIME' }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const targetUser = interaction.options.getUser('user');
      const duration = interaction.options.getString('duration');

      // Calculate expiration
      let newExpires = 0;
      if (duration === 'LIFETIME') {
        newExpires = Math.floor(new Date(2100, 0, 1).getTime() / 1000);
      } else {
        const durationSeconds = DURATION_SECONDS[duration] || 86400;
        newExpires = Math.floor(Date.now() / 1000) + durationSeconds;
      }

      // Update user
      updateUser(targetUser.id, {
        subscription: 'premium',
        sub_expires: newExpires
      });

      // Try to assign role
      const roleId = getConfig('role_premium');
      if (roleId && interaction.guild) {
        try {
          const member = await interaction.guild.members.fetch(targetUser.id);
          if (member && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId);
          }
        } catch (err) {
          console.error('⚠️ Failed to assign role:', err?.message || err);
        }
      }

      const durationLabel = {
        '1DAY': '⏳ 1 Day',
        '3DAY': '📅 3 Days',
        '1WEEK': '📆 1 Week',
        '1MONTH': '📊 1 Month',
        'LIFETIME': '♾️ Lifetime'
      }[duration];

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Premium Granted')
        .setDescription(`Successfully granted premium to ${targetUser}`)
        .addFields({
          name: '👤 User',
          value: `${targetUser.username}#${targetUser.discriminator}`,
          inline: true
        })
        .addFields({
          name: '📅 Duration',
          value: durationLabel,
          inline: true
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error granting premium:', err);
      return interaction.reply({ content: '❌ Failed to grant premium.', ephemeral: true });
    }
  }
};

