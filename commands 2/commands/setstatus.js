const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig } = require('../database');
const { ownerOnly } = require('../utils');

const TYPE_LABELS = {
  playing: 'Playing',
  watching: 'Watching',
  listening: 'Listening to',
  competing: 'Competing in',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstatus')
    .setDescription("Set the bot's profile status text (owner only)")
    .addStringOption(opt =>
      opt.setName('text')
        .setDescription('e.g. VIGIL SOFTWORKS discord.gg/vigil')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Activity type (default: Playing)')
        .setRequired(false)
        .addChoices(
          { name: 'Playing', value: 'playing' },
          { name: 'Watching', value: 'watching' },
          { name: 'Listening', value: 'listening' },
          { name: 'Competing', value: 'competing' }
        )
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;

    const text = interaction.options.getString('text');
    const type = interaction.options.getString('type') || 'playing';

    setConfig('status_text', text);
    setConfig('status_type', type);

    if (typeof interaction.client.applyPresence === 'function') {
      interaction.client.applyPresence(interaction.client);
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Status Updated')
      .setDescription(`The bot now shows:\n**${TYPE_LABELS[type]}** ${text}`)
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
