const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addStockBulk, dropStockCount } = require('../database');
const { ownerOnly } = require('../utils');
const https = require('https');
const http = require('http');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('adddropstock')
    .setDescription('Add stock to the drop pool (owner only)')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Account category')
        .setRequired(true)
        .addChoices(
          { name: 'Free', value: 'free' },
          { name: 'Free+', value: 'free+' },
          { name: 'Premium', value: 'premium' }
        )
    )
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('.txt file — one account per line')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const category = interaction.options.getString('category');
    const attachment = interaction.options.getAttachment('file');

    if (!attachment.name.endsWith('.txt')) {
      return interaction.editReply('❌ Please attach a `.txt` file.');
    }

    try {
      const text = await fetchUrl(attachment.url);
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) return interaction.editReply('❌ The file is empty.');

      const added = addStockBulk(category, lines, 'drop_stock');
      const total = dropStockCount(category);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Drop Stock Added')
        .addFields(
          { name: 'Category', value: category, inline: true },
          { name: 'Added', value: String(added), inline: true },
          { name: 'Total in Drop Pool', value: String(total), inline: true }
        )
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ Failed to read file: ${err.message}`);
    }
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}
