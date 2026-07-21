const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { isOwner } = require('../utils');
const { setConfig, getConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('genchannels')
    .setDescription('Set channels where specific account types can be generated')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Channel restriction mode')
        .setRequired(true)
        .addChoices(
          { name: '🌊 Free Only', value: 'free_only' },
          { name: '🔵 Free+ Only', value: 'freeplus_only' },
          { name: '⭐ Premium Only', value: 'premium_only' },
          { name: '📋 Custom Setup', value: 'custom' },
          { name: '🔓 All Channels', value: 'all' }
        )
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    const mode = interaction.options.getString('mode');

    try {
      if (mode === 'all') {
        // Allow generation in all channels
        setConfig('gen_channel_tiers', 'all');
        setConfig('free_channel', '');
        setConfig('freeplus_channel', '');
        setConfig('premium_channel', '');

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Generation Allowed Everywhere')
          .setDescription('Users can now generate any account type in ANY channel!')
          .addFields({
            name: '📊 Mode',
            value: '🔓 All Channels (No Restrictions)',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (mode === 'free_only') {
        setConfig('gen_channel_tiers', 'free_only');
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Free Only Mode')
          .setDescription('Now use `/setchannel free #channel` to set the free generation channel')
          .addFields({
            name: '📋 Next Step',
            value: 'Run: `/setchannel free #your-channel`',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (mode === 'freeplus_only') {
        setConfig('gen_channel_tiers', 'freeplus_only');
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Free+ Only Mode')
          .setDescription('Now use `/setchannel freeplus #channel` to set the free+ generation channel')
          .addFields({
            name: '📋 Next Step',
            value: 'Run: `/setchannel freeplus #your-channel`',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (mode === 'premium_only') {
        setConfig('gen_channel_tiers', 'premium_only');
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Premium Only Mode')
          .setDescription('Now use `/setchannel premium #channel` to set the premium generation channel')
          .addFields({
            name: '📋 Next Step',
            value: 'Run: `/setchannel premium #your-channel`',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (mode === 'custom') {
        setConfig('gen_channel_tiers', 'custom');
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('✅ Custom Setup Mode')
          .setDescription('Set separate channels for each tier. You can set one, two, or all three!')
          .addFields({
            name: '📋 Next Steps',
            value: '1. `/setchannel free #free-channel`\n2. `/setchannel freeplus #freeplus-channel`\n3. `/setchannel premium #premium-channel`\n\n(Run only the ones you want to enable)',
            inline: false
          })
          .addFields({
            name: '💡 Example',
            value: 'Free: #gen-free\nFree+: #gen-plus\nPremium: #gen-premium',
            inline: false
          })
          .setFooter({ text: 'Generator' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      console.error('Error setting generation channels:', err);
      return interaction.reply({ content: '❌ Failed to set generation channels.', ephemeral: true });
    }
  }
};

