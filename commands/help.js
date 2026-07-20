const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all available bot commands'),

  async execute(interaction) {
    try {
      const ownerCommands = [
        {
          name: '/addcodes [duration] [file]',
          description: 'Import promotional codes from a text file (one per line, no limit)',
          emoji: '📤'
        },
        {
          name: '/clearcodes',
          description: 'Clear all promotional codes from all duration tiers',
          emoji: '🗑️'
        },
        {
          name: '/setrole [role]',
          description: 'Set the premium role to assign when users claim codes',
          emoji: '🎭'
        },
        {
          name: '/grantpremium [user] [duration]',
          description: 'Manually grant premium access to a user',
          emoji: '💎'
        },
        {
          name: '/revokepremium [user]',
          description: 'Revoke premium access from a user',
          emoji: '🚫'
        },
        {
          name: '/codesinfo',
          description: 'View promotional code stock status per tier',
          emoji: '📊'
        },
        {
          name: '/setimageforpanel [url]',
          description: 'Set custom image for the claim code panel',
          emoji: '🖼️'
        }
      ];

      const userCommands = [
        {
          name: '/claimcodepanel',
          description: 'Show the promotional code claim panel with button',
          emoji: '🎁'
        },
        {
          name: '/premiumcheck [user]',
          description: 'Check your or someone else\'s premium subscription status',
          emoji: '💳'
        },
        {
          name: '/generate [category]',
          description: 'Generate an account (Free, Free+, or Premium)',
          emoji: '⚙️'
        },
        {
          name: '/help',
          description: 'Show this help message',
          emoji: '❓'
        },
        {
          name: '/botinfo',
          description: 'Show bot statistics and information',
          emoji: '🤖'
        }
      ];

      const ownerEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('👑 Owner Commands')
        .setDescription('Commands for bot owner only')
        .addFields(
          ownerCommands.map(cmd => ({
            name: `${cmd.emoji} ${cmd.name}`,
            value: cmd.description,
            inline: false
          }))
        );

      const userEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('👤 User Commands')
        .setDescription('Commands available to all users')
        .addFields(
          userCommands.map(cmd => ({
            name: `${cmd.emoji} ${cmd.name}`,
            value: cmd.description,
            inline: false
          }))
        );

      const configEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⚙️ Environment Variables')
        .setDescription('Set these in your .env file for full functionality:')
        .addFields({
          name: 'BOT_LOG_CHANNEL',
          value: 'Channel ID where code claims are logged. Get the ID via: Settings → Advanced → Enable Developer Mode → Right-click channel → Copy ID',
          inline: false
        })
        .addFields({
          name: 'Example .env',
          value: '```\nBOT_TOKEN=your_token\nOWNER_ID=your_id\nCLIENT_ID=your_client_id\nBOT_LOG_CHANNEL=123456789012345678\n```',
          inline: false
        });

      const infoEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('ℹ️ Premium Code Tiers')
        .setDescription('Available duration options when creating codes:')
        .addFields({
          name: 'Durations',
          value: '⏳ **1 Day** - 24 hours of premium\n📅 **3 Days** - 72 hours of premium\n📆 **1 Week** - 7 days of premium\n📊 **1 Month** - 30 days of premium\n♾️ **Lifetime** - Permanent premium access',
          inline: false
        })
        .setFooter({ text: 'Generator • Use /help to see all commands' });

      await interaction.reply({ embeds: [ownerEmbed, userEmbed, configEmbed, infoEmbed], ephemeral: true });
    } catch (err) {
      console.error('Error showing help:', err);
      return interaction.reply({ content: '❌ Failed to display help.', ephemeral: true });
    }
  }
};

