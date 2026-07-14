const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setDropConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dropcooldown')
    .setDescription('Set the interval between drops in seconds (owner only)')
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Seconds between each drop (e.g. 300 = 5 minutes)')
        .setRequired(true)
        .setMinValue(10)
        .setMaxValue(86400)
    ),

  async execute(interaction, client) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const seconds = interaction.options.getInteger('seconds');
    setDropConfig('cooldown', String(seconds));

    if (client.isDropActive()) {
      client.stopDrop();
      client.startDrop(client);
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('⏱️ Drop Interval Updated')
      .addFields({ name: 'New Interval', value: `${seconds}s (${(seconds / 60).toFixed(1)} min)`, inline: true })
      .setFooter({ text: 'Changes take effect immediately' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
