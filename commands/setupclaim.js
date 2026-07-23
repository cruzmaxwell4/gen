const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupclaim')
    .setDescription('Setup claim panels for premium and free code claims')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Which claim panel to setup')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium Claim Panel', value: 'premium' },
          { name: '🌊 Free Claim Panel', value: 'free' }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const type = interaction.options.getString('type');

      if (type === 'premium') {
        // Set premium claim panel
        setConfig('claim_panel_type', 'premium');

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('✅ Premium Claim Panel Active')
          .setDescription('Running `/claimcodepanel` will now show the premium panel!')
          .addFields({
            name: '📋 Panel Details',
            value: '**Title:** Premium Claim!🌟\n**Message:** Claim 1 Really good account for 5$ each (comes with free link)\n**Color:** Gold',
            inline: false
          })
          .addFields({
            name: '🎯 Next Step',
            value: 'Run `/claimcodepanel` to post the premium panel to this channel!',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (type === 'free') {
        // Set free claim panel
        setConfig('claim_panel_type', 'free');

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Free Claim Panel Active')
          .setDescription('Running `/claimcodepanel` will now show the free panel!')
          .addFields({
            name: '📋 Panel Details',
            value: '**Title:** 🎁 Claim your free code here!\n**Message:** Have a free code? Use the button below to unlock free account access!\n**Color:** Green',
            inline: false
          })
          .addFields({
            name: '🎯 Next Step',
            value: 'Run `/claimcodepanel` to post the free panel to this channel!',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      console.error('Error setting up claim panel:', err);
      return interaction.reply({ content: '❌ Failed to setup claim panel.', ephemeral: true });
    }
  }
};

