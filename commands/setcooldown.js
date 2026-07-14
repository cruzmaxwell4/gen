const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig } = require('../database');
const { ownerOnly } = require('../utils');

const CATS = [
  { name: 'All Categories', value: 'all' },
  { name: '🟢 Free',        value: 'free' },
  { name: '🔵 Free+',       value: 'free+' },
  { name: '⭐ Premium',     value: 'premium' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setcooldown')
    .setDescription('Set the generate cooldown per category (owner only)')
    .addIntegerOption(opt =>
      opt.setName('seconds')
        .setDescription('Cooldown in seconds (0 = no cooldown)')
        .setRequired(true)
        .setMinValue(0)
        .setMaxValue(86400)
    )
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Which category to apply it to (default: all)')
        .setRequired(false)
        .addChoices(...CATS)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const seconds = interaction.options.getInteger('seconds');
    const category = interaction.options.getString('category') || 'all';

    if (category === 'all') {
      setConfig('gen_cooldown', String(seconds));
      setConfig('cooldown_free', String(seconds));
      setConfig('cooldown_freeplus', String(seconds));
      setConfig('cooldown_premium', String(seconds));
    } else {
      setConfig(`cooldown_${category.replace('+', 'plus')}`, String(seconds));
    }

    const pretty = seconds === 0 ? 'No cooldown' : `${seconds}s (${(seconds / 60).toFixed(1)} min)`;
    const label = CATS.find(c => c.value === category)?.name || category;

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('⏱️ Generate Cooldown Set')
      .addFields(
        { name: 'Category', value: label,  inline: true },
        { name: 'Cooldown', value: pretty, inline: true }
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
