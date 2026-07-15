const { EmbedBuilder } = require('discord.js');
const { getConfig, getUser } = require('./database');

const CATEGORIES = ['free', 'free+', 'premium'];
const TIER_RANK = { none: 0, free: 1, 'free+': 2, premium: 3 };

function isOwner(userId) {
  return userId === process.env.OWNER_ID;
}

function ownerOnly(interaction) {
  if (!isOwner(interaction.user.id)) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ No Permission')
      .setDescription('Only the bot owner can use this command.')
      .setTimestamp();
    interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    return false;
  }
  return true;
}

function getCategoryRoleId(category) {
  return getConfig(`role_${category.replace('+', 'plus')}`, null);
}

function hasActiveSub(userId, category) {
  const user = getUser(userId);
  if (!user.subscription || user.subscription === 'none') return false;
  const now = Math.floor(Date.now() / 1000);
  if (user.sub_expires > 0 && user.sub_expires < now) return false;
  return (TIER_RANK[user.subscription] || 0) >= (TIER_RANK[category] || 99);
}

function hasGenerateAccess(member, category) {
  if (isOwner(member.id)) return true;

  const roleId = getCategoryRoleId(category);
  const roleName = category === 'free+' ? 'free+' : category;
  const hasRole = roleId
    ? member.roles.cache.has(roleId)
    : member.roles.cache.some(r => r.name.toLowerCase() === roleName.toLowerCase());

  if (category === 'free') {
    // Free tier: role is sufficient; subscription alone does not grant access
    return hasRole;
  }

  if (category === 'premium') {
    // Premium tier: BOTH the premium role AND an active subscription are required
    return hasRole && hasActiveSub(member.id, category);
  }

  // free+ (and any future mid-tiers): role OR active subscription
  return hasRole || hasActiveSub(member.id, category);
}

module.exports = { CATEGORIES, TIER_RANK, isOwner, ownerOnly, getCategoryRoleId, hasGenerateAccess, hasActiveSub };
