const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../database');
const { ownerOnly, getCategoryRoleId, TIER_RANK } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setsubscription')
    .setDescription('Set subscription tier for a user (owner only)')
    .addUserOption(opt =>
      opt.setName('user').setDescription('Target user').setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('tier')
        .setDescription('Subscription tier')
        .setRequired(true)
        .addChoices(
          { name: 'None', value: 'none' },
          { name: 'Free', value: 'free' },
          { name: 'Free+', value: 'free+' },
          { name: 'Premium', value: 'premium' }
        )
    )
    .addStringOption(opt =>
      opt.setName('duration')
        .setDescription('Subscription duration')
        .setRequired(true)
        .addChoices(
          { name: '30 Minutes', value: '1800' },
          { name: '1 Hour',     value: '3600' },
          { name: '3 Hours',    value: '10800' },
          { name: '6 Hours',    value: '21600' },
          { name: '1 Day',      value: '86400' },
          { name: '3 Days',     value: '259200' },
          { name: '1 Week',     value: '604800' },
          { name: '1 Month',    value: '2592000' },
          { name: '3 Months',   value: '7776000' },
          { name: 'Lifetime',   value: '0' }
        )
    ),

  async execute(interaction) {
    try {
      if (!ownerOnly(interaction)) return;
      await interaction.deferReply({ ephemeral: true });

      const target = interaction.options.getUser('user');
      const tier = interaction.options.getString('tier');
      const durationStr = interaction.options.getString('duration');

      if (!target || !tier || !durationStr) {
        await interaction.editReply({ content: '❌ Invalid user, tier, or duration.' });
        return;
      }

      // Get or create user
      const user = getUser(target.id);
      if (!user) {
        await interaction.editReply({ content: '❌ Could not load user data.' });
        return;
      }

      // Calculate expiration timestamp
      const durationSeconds = parseInt(durationStr);
      const now = Math.floor(Date.now() / 1000);
      const expires = durationSeconds === 0 ? 0 : (now + durationSeconds);

      // Update subscription
      updateUser(target.id, { subscription: tier, sub_expires: expires });

      // Sync Discord roles so the subscription actually grants generate access
      let roleNote = '';
      const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
      if (member) {
        const roles = {
          free:    getCategoryRoleId('free'),
          'free+': getCategoryRoleId('free+'),
          premium: getCategoryRoleId('premium'),
          none:    null
        };

        // Remove higher tier roles if setting to a lower tier
        const tierRank = TIER_RANK[tier] ?? 0;
        const allTiers = ['free', 'free+', 'premium'];
        
        for (const t of allTiers) {
          const rid = roles[t];
          if (!rid) continue;
          
          const tRank = TIER_RANK[t] ?? 0;
          const shouldRemove = t !== tier && (tier === 'none' || tRank > tierRank);
          
          if (shouldRemove && member.roles?.cache?.has(rid)) {
            await member.roles.remove(rid).catch(() => {});
          }
        }

        // Add new tier role if not 'none'
        if (tier !== 'none') {
          const roleId = roles[tier];
          if (roleId) {
            const ok = await member.roles.add(roleId).then(() => true).catch(() => false);
            roleNote = ok ? `Granted <@&${roleId}>` : '⚠️ Could not assign role — check the bot has **Manage Roles** and its role is **above** the tier role.';
          } else {
            roleNote = '⚠️ No role set for this tier yet — run `/setroles` so subscribers get access.';
          }
        } else {
          roleNote = 'All tier roles removed.';
        }
      }

      // Format duration display
      const durationLabel = {
        '1800': '30 Minutes',
        '3600': '1 Hour',
        '10800': '3 Hours',
        '21600': '6 Hours',
        '86400': '1 Day',
        '259200': '3 Days',
        '604800': '1 Week',
        '2592000': '1 Month',
        '7776000': '3 Months',
        '0': 'Lifetime'
      }[durationStr] || 'Unknown';

      const embed = new EmbedBuilder()
        .setColor(tier === 'none' ? 0x99AAB5 : 0x57F287)
        .setTitle('✅ Subscription Updated')
        .addFields(
          { name: 'User',     value: `<@${target.id}>`, inline: true },
          { name: 'Tier',     value: tier === 'none' ? 'None' : tier,  inline: true },
          { name: 'Duration', value: durationLabel, inline: true },
          { name: 'Expires',  value: expires > 0 ? `<t:${expires}:R>` : 'Never', inline: true }
        )
        .setFooter({ text: 'Generator • Subscription applied' })
        .setTimestamp();

      if (roleNote) embed.addFields({ name: 'Role Sync', value: roleNote, inline: false });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('❌ Error in /setsubscription:', err?.message || err);
      await interaction.editReply({ content: '❌ An error occurred setting the subscription.' }).catch(() => {});
    }
  }
};

