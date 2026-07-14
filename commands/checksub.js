const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../database');

const tierColors = { none: 0x99AAB5, basic: 0x57F287, plus: 0x5865F2, premium: 0xFEE75C };
const tierEmojis = { none: '⬜', basic: '🟢', plus: '🔵', premium: '⭐' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checksub')
    .setDescription('Check your subscription status')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to check (admin only)').setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const target = interaction.options.getUser('user') || interaction.user;
    const user = getUser(target.id);
    const now = Math.floor(Date.now() / 1000);

    const expired = user.sub_expires > 0 && user.sub_expires < now;
    const tier = expired ? 'none' : user.subscription;
    const color = tierColors[tier] || 0x5865F2;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`${tierEmojis[tier] || '⬜'} Subscription — ${tier.charAt(0).toUpperCase() + tier.slice(1)}`)
      .addFields(
        { name: 'User', value: `<@${target.id}>`, inline: true },
        { name: 'Tier', value: tier.charAt(0).toUpperCase() + tier.slice(1), inline: true },
        { name: 'Expires', value: user.sub_expires > 0 ? `<t:${user.sub_expires}:R>` : 'Never', inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
