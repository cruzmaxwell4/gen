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
          { name: '1 Day',     value: '1' },
          { name: '3 Days',    value: '3' },
          { name: '1 Week',    value: '7' },
          { name: '1 Month',   value: '30' },
          { name: '3 Months',  value: '90' },
          { name: 'Lifetime',  value: 'lifetime' }
        )
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user');
    const tier = interaction.options.getString('tier');
    const duration = interaction.options.getString('duration');
    const days = duration === 'lifetime' ? null : parseInt(duration, 10);

    getUser(target.id);
    const expires = days ? Math.floor(Date.now() / 1000) + days * 86400 : 0;
    updateUser(target.id, { subscription: tier, sub_expires: expires });

    // Sync Discord roles so the subscription actually grants generate access
    let roleNote = '';
    const member = interaction.guild ? await interaction.guild.members.fetch(target.id).catch(() => null) : null;
    if (member) {
      const tierRoles = {
        free:    getCategoryRoleId('free'),
        'free+': getCategoryRoleId('free+'),
        premium: getCategoryRoleId('premium'),
      };
      for (const [t, rid] of Object.entries(tierRoles)) {
        if (!rid || !member.roles.cache.has(rid)) continue;
        // Always keep the free role unless we're explicitly setting tier to 'none'
        if (t === 'free' && tier !== 'none') continue;
        // Only remove roles that are strictly higher than the new tier
        if (t !== tier && (tier === 'none' || TIER_RANK[t] > TIER_RANK[tier])) {
          await member.roles.remove(rid).catch(() => {});
        }
      }
      if (tier !== 'none' && tierRoles[tier]) {
        const ok = await member.roles.add(tierRoles[tier]).then(() => true).catch(() => false);
        roleNote = ok ? `Granted <@&${tierRoles[tier]}>` : '⚠️ Could not assign role — check the bot has **Manage Roles** and its role is **above** the tier role.';
      } else if (tier !== 'none' && !tierRoles[tier]) {
        roleNote = '⚠️ No role set for this tier yet — run `/setroles` so subscribers get access.';
      } else if (tier === 'none') {
        roleNote = 'All tier roles removed.';
      }
    }

    const embed = new EmbedBuilder()
      .setColor(tier === 'none' ? 0x99AAB5 : 0x57F287)
      .setTitle('✅ Subscription Updated')
      .addFields(
        { name: 'User',    value: `<@${target.id}>`, inline: true },
        { name: 'Tier',    value: tier,              inline: true },
        { name: 'Expires', value: days ? `<t:${expires}:R>` : 'Never', inline: true }
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    if (roleNote) embed.addFields({ name: 'Role Sync', value: roleNote, inline: false });

    await interaction.editReply({ embeds: [embed] });
  }
};
