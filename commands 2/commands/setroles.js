const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig, getConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setroles')
    .setDescription('Set which roles can access each generate category (owner only)')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Category to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Free', value: 'free' },
          { name: 'Free+', value: 'free+' },
          { name: 'Premium', value: 'premium' }
        )
    )
    .addRoleOption(opt =>
      opt.setName('role')
        .setDescription('Role required to generate this category')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getString('category');
    const role = interaction.options.getRole('role');
    const key = `role_${category.replace('+', 'plus')}`;

    setConfig(key, role.id);

    const freeRole    = getConfig('role_free');
    const freeplusRole = getConfig('role_freeplus');
    const premiumRole = getConfig('role_premium');

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Role Set')
      .setDescription(`**${category}** is now gated to <@&${role.id}>.`)
      .addFields(
        { name: '🟢 Free', value: freeRole ? `<@&${freeRole}>` : 'By role name "freegen"', inline: true },
        { name: '🔵 Free+', value: freeplusRole ? `<@&${freeplusRole}>` : 'By role name "free+"', inline: true },
        { name: '⭐ Premium', value: premiumRole ? `<@&${premiumRole}>` : 'By role name "premium"', inline: true }
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
