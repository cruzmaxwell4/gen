const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premiumcheck')
    .setDescription('Check your premium subscription status')
    .addUserOption(opt =>
      opt.setName('user')
        .setDescription('User to check (leave blank for yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const user = getUser(targetUser.id);

      if (!user) {
        return interaction.reply({ content: '❌ Could not retrieve user data.', ephemeral: true });
      }

      const now = Math.floor(Date.now() / 1000);
      const isPremium = user.subscription === 'premium' && user.sub_expires > now;

      if (!isPremium) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ No Active Premium')
          .setDescription(`${targetUser.username} does not have an active premium subscription.`)
          .addFields({
            name: '💳 Current Status',
            value: `**Tier:** ${user.subscription || 'None'}\n**Expires:** Never`,
            inline: false
          })
          .setFooter({ text: 'Generator • Claim a code to get premium access!' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Premium is active
      const expiryDate = new Date(user.sub_expires * 1000);
      const daysRemaining = Math.ceil((user.sub_expires - now) / 86400);
      const isLifetime = user.sub_expires > Math.floor(new Date(2099, 0, 1).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Premium Active')
        .setDescription(`${targetUser.username} has an active premium subscription!`)
        .addFields({
          name: '💳 Subscription Details',
          value: `**Tier:** Premium\n**Duration:** ${isLifetime ? '♾️ Lifetime' : daysRemaining + ' day(s)'}`,
          inline: false
        })
        .addFields({
          name: '⏰ Expiration',
          value: isLifetime ? 'Never' : expiryDate.toLocaleString(),
          inline: false
        })
        .setFooter({ text: 'Generator • Enjoy your premium benefits!' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error checking premium:', err);
      return interaction.reply({ content: '❌ Failed to check premium status.', ephemeral: true });
    }
  }
};

