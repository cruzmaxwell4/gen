const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setDropConfig, getDropConfig, dropStockCount } = require('../database');
const { ownerOnly, CATEGORIES } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropstart')
    .setDescription('Start the auto drop system (owner only)')
    .addChannelOption(opt =>
      opt.setName('channel')
        .setDescription('Channel to drop accounts in')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const total = CATEGORIES.reduce((s, c) => s + dropStockCount(c), 0);

    if (total === 0) {
      return interaction.editReply('❌ No drop stock loaded. Use `/adddropstock` first.');
    }

    setDropConfig('active', 'true');
    setDropConfig('channel_id', channel.id);
    setDropConfig('guild_id', interaction.guild.id);

    client.startDrop(client);

    const cooldown = parseInt(getDropConfig('cooldown', '300'));

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Drop Started')
      .addFields(
        { name: 'Channel', value: `<#${channel.id}>`, inline: true },
        { name: 'Interval', value: `${cooldown}s`, inline: true },
        { name: 'Total Drop Stock', value: String(total), inline: true }
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
