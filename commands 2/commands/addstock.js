const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addStockBulk, stockCount, getConfig } = require('../database');
const { ownerOnly, CATEGORIES } = require('../utils');
const https = require('https');
const http = require('http');

const CAT_LABELS = { free: '🟢 Free', 'free+': '🔵 Free+', premium: '⭐ Premium' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addstock')
    .setDescription('Add stock from a .txt file (owner only)')
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
        .setDescription('.txt file — one account per line (email:password)')
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

      const added = addStockBulk(category, lines, 'stock');
      const total = stockCount(category);
      const categoryLabel = CAT_LABELS[category] || category;
      const stockSummary = ['free', 'free+', 'premium']
        .map(c => `${CAT_LABELS[c]} **${stockCount(c)}**`)
        .join('   •   ');

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Stock Added')
        .addFields(
          { name: 'Category', value: categoryLabel, inline: true },
          { name: 'Added', value: String(added), inline: true },
          { name: 'Total', value: String(total), inline: true },
          { name: '📊 All Stock', value: stockSummary, inline: false }
        )
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });

      // Public restock announcement to the configured log channel
      const logChannelId = getConfig('log_channel');
      if (logChannelId) {
        const ch = await interaction.client.channels.fetch(logChannelId).catch(() => null);
        if (ch && ch.isTextBased()) {
          const bannerURL = getConfig('gen_image') || null;
          const announce = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📦 Stock Restocked!')
            .setDescription(`**${added}** new ${categoryLabel} account${added === 1 ? '' : 's'} just dropped!`)
            .addFields(
              { name: 'Category',      value: categoryLabel, inline: true },
              { name: 'Just Added',    value: String(added), inline: true },
              { name: 'Now in Stock',  value: String(total), inline: true },
              { name: '📊 Available Now', value: stockSummary, inline: false }
            )
            .setFooter({ text: 'Generator • Use /generate to claim one' })
            .setTimestamp();
          if (bannerURL) announce.setImage(bannerURL);
          await ch.send({ embeds: [announce] }).catch(() => {});
        }
      }
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
