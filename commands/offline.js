const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { setConfig } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('offline')
    .setDescription('Put the generator in "thinking" offline mode (owner only)')
    .addStringOption(opt =>
      opt.setName('mode')
        .setDescription('Turn offline mode on or off')
        .setRequired(true)
        .addChoices(
          { name: 'On — /generate sits at "thinking…"', value: 'on' },
          { name: 'Off — generator works normally', value: 'off' }
        )
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;

    const on = interaction.options.getString('mode') === 'on';
    setConfig('gen_offline', on ? 'true' : 'false');

    const embed = new EmbedBuilder()
      .setColor(on ? 0xED4245 : 0x57F287)
      .setTitle(on ? '🔌 Offline Mode Enabled' : '✅ Offline Mode Disabled')
      .setDescription(
        on
          ? 'Every `/generate` will now sit at **"Generator is thinking…"** in the channel and never finish.\n\n⚠️ The bot must stay running for this to show — if the process actually goes down, Discord shows "did not respond" instead.'
          : 'The generator is back to normal — `/generate` will deliver accounts again.'
      )
      .setFooter({ text: 'Generator' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
