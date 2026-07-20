const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllUsers, stockCount } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Show bot statistics and information'),

  async execute(interaction) {
    try {
      const client = interaction.client;
      const users = getAllUsers();
      
      // Count premium users
      const now = Math.floor(Date.now() / 1000);
      const premiumUsers = users.filter(u => u.subscription === 'premium' && u.sub_expires > now).length;

      // Count codes
      const durations = ['1DAY', '3DAY', '1WEEK', '1MONTH', 'LIFETIME'];
      let totalCodes = 0;
      durations.forEach(dur => {
        totalCodes += stockCount(`codes_${dur}`);
      });

      const uptime = client.uptime;
      const hours = Math.floor(uptime / 3600000);
      const minutes = Math.floor((uptime % 3600000) / 60000);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🤖 Bot Information')
        .setThumbnail(client.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields({
          name: '👾 Bot Details',
          value: `**Name:** ${client.user.username}\n**ID:** ${client.user.id}\n**Ping:** ${client.ws.ping}ms`,
          inline: false
        })
        .addFields({
          name: '📊 Statistics',
          value: `**Guilds:** ${client.guilds.cache.size}\n**Users Tracked:** ${users.length}\n**Premium Users:** ${premiumUsers}`,
          inline: false
        })
        .addFields({
          name: '🎁 Codes',
          value: `**Total Codes:** ${totalCodes}`,
          inline: false
        })
        .addFields({
          name: '⏱️ Uptime',
          value: `${hours}h ${minutes}m`,
          inline: true
        })
        .setFooter({ text: 'Generator • Account Generation Bot' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error getting bot info:', err);
      return interaction.reply({ content: '❌ Failed to retrieve bot information.', ephemeral: true });
    }
  }
};

