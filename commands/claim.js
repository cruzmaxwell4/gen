const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getConfig, getUser, updateUser, popStock, restoreStock, stockCount, getBannerFile } = require('../database');
const { hasGenerateAccess, isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

const CATEGORY_COLORS = { premium: 0xFEE75C, free: 0x57F287 };
const CATEGORY_LABELS = { premium: '🌟⭐Premium Account⭐🌟', free: '🌊🟢Free Account🟢🌊' };

const wait = (ms) => new Promise(res => setTimeout(res, ms));

function parseAccount(raw) {
  if (typeof raw !== 'string') {
    if (raw && typeof raw === 'object') {
      raw = raw.credentials ?? raw.account ?? raw.data ?? raw.value ?? raw.text ?? JSON.stringify(raw);
    } else {
      raw = String(raw ?? '');
    }
  }
  const parts = raw.split('|').map(p => p.trim()).filter(p => p.length > 0);
  const credentials = parts[0] || raw.trim();
  let skinLink = null;
  let username = null;
  const detailLines = [];
  const currencyFields = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.startsWith('http://') || part.startsWith('https://')) {
      skinLink = part;
      continue;
    }
    if (part.includes(' / ')) {
      const subs = part.split(' / ').map(s => s.trim()).filter(Boolean);
      if (subs.length > 1 && subs.every(s => s.includes(':') || s.includes('➡'))) {
        for (const sub of subs) {
          const ai = sub.indexOf('➡');
          const idx = ai !== -1 ? ai : sub.indexOf(':');
          const name = sub.substring(0, idx).trim();
          const val = sub.substring(idx + 1).trim();
          if (val.startsWith('http://') || val.startsWith('https://')) { skinLink = val; continue; }
          currencyFields.push({ name, value: val || '\u200b', inline: true });
        }
        continue;
      }
    }
    let label = null, value = null;
    const arrowIdx = part.indexOf('➡');
    const colonIdx = part.indexOf(':');
    if (arrowIdx !== -1) {
      label = part.substring(0, arrowIdx).trim();
      value = part.substring(arrowIdx + 1).trim();
    } else if (colonIdx !== -1) {
      label = part.substring(0, colonIdx).trim();
      value = part.substring(colonIdx + 1).trim();
    } else {
      detailLines.push(part);
      continue;
    }
    if (value.startsWith('http://') || value.startsWith('https://')) {
      skinLink = value;
      continue;
    }
    if (label.toLowerCase() === 'username' && !username) username = value;
    detailLines.push(`**${label}** ➡️ ${value}`);
  }

  return { credentials, skinLink, username, detailLines, currencyFields };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claim')
    .setDescription('Claim a premium or free account with your code')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('What type of account to claim')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium Account', value: 'premium' },
          { name: '🌊 Free Account', value: 'free' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('type');

    // Check offline mode
    if (getConfig('gen_offline', 'false') === 'true') {
      return interaction.deferReply().catch(() => {});
    }

    // Check channel restrictions based on claim mode
    const claimChannelMode = getConfig('claim_channel_mode', 'all');
    
    if (claimChannelMode !== 'all') {
      let allowedChannelId = null;
      const typeLabels = { premium: '⭐ Premium', free: '🌊 Free' };

      if (claimChannelMode === 'custom') {
        if (type === 'premium') {
          allowedChannelId = getConfig('premium_claim_channel', '');
        } else if (type === 'free') {
          allowedChannelId = getConfig('free_claim_channel', '');
        }
      } else if (claimChannelMode === 'premium_only' && type === 'premium') {
        allowedChannelId = getConfig('premium_claim_channel', '');
      } else if (claimChannelMode === 'free_only' && type === 'free') {
        allowedChannelId = getConfig('free_claim_channel', '');
      }

      if (allowedChannelId && interaction.channelId !== allowedChannelId) {
        return interaction.reply({ content: `❌ You can only claim **${typeLabels[type]}** accounts in <#${allowedChannelId}>`, ephemeral: true });
      }

      if (claimChannelMode === 'premium_only' && type !== 'premium') {
        return interaction.reply({ content: `❌ Only **⭐ Premium** accounts can be claimed in this server!`, ephemeral: true });
      }
      if (claimChannelMode === 'free_only' && type !== 'free') {
        return interaction.reply({ content: `❌ Only **🌊 Free** accounts can be claimed in this server!`, ephemeral: true });
      }
    }

    // Check access
    if (!hasGenerateAccess(interaction.member, type)) {
      const roleId = getConfig(`role_${type}`);
      const roleRef = roleId ? `<@&${roleId}>` : `**${type}**`;
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ No Access')
        .setDescription(`You need the ${roleRef} role to claim **${type}** accounts.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = getUser(interaction.user.id);
    const cooldown = parseInt(getConfig(`cooldown_${type}`, getConfig('claim_cooldown', '0')));
    const now = Math.floor(Date.now() / 1000);
    const lastClaim = user[`last_claim_${type}`] || 0;
    const remaining = (lastClaim + cooldown) - now;

    if (cooldown > 0 && remaining > 0 && !isOwner(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⏳ Cooldown Active')
        .setDescription(`You must wait **${remaining}s** before claiming again.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await interaction.deferReply();

    // Check stock
    if (stockCount(type) <= 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Out of Stock')
        .setDescription(`✖️ OUT OF STOCK COME BACK LATER! ✖️`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // Try to DM first
    let statusMsg;
    try {
      statusMsg = await interaction.user.send({ content: '⌛ **Processing account...** Fetching details...' });
    } catch {
      const failEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⚠️ Could Not Send DM')
        .setDescription(`<@${interaction.user.id}> your DMs are closed. Enable **"Allow Direct Messages from Server Members"** in Privacy Settings and try again.`)
        .setTimestamp();
      return interaction.editReply({ embeds: [failEmbed] });
    }

    const raw = popStock(type);
    if (!raw) {
      await statusMsg.edit({ content: `❌ **${CATEGORY_LABELS[type]}** just sold out — someone grabbed the last one!` }).catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Out of Stock')
        .setDescription(`✖️ OUT OF STOCK COME BACK LATER! ✖️`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    updateUser(interaction.user.id, { [`last_claim_${type}`]: now, last_claim: now });

    const { credentials, skinLink, username, detailLines, currencyFields } = parseAccount(raw);

    const guildIconURL = interaction.guild.iconURL({ dynamic: true });
    const userAvatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });
    const color = CATEGORY_COLORS[type];

    const genImage = getConfig('claim_image') || '';
    const bannerFile = genImage.startsWith('local:') ? getBannerFile() : null;
    const bannerURL = bannerFile ? `attachment://${bannerFile.name}` : (/^https?:\/\//.test(genImage) ? genImage : null);

    const left = stockCount(type);
    const maxBlocks = 10;
    const fullBlocks = Math.min(maxBlocks, Math.max(0, Math.round((left / 100) * maxBlocks)));
    const emptyBlocks = maxBlocks - fullBlocks;
    const stockBar = '▰'.repeat(fullBlocks) + '▪'.repeat(emptyBlocks);
    const borderLeft = type === 'free' ? '🟢' : '🟡';
    const borderRight = type === 'free' ? '🟢' : '🟡';

    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const channelEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'Account Claimed', iconURL: guildIconURL || undefined })
      .setThumbnail(userAvatarURL)
      .setDescription(
        `**<@${interaction.user.id}> Claimed A Account!! Tier: ${type === 'free' ? '🌊Free' : '⭐Premium'}**\n\n**Check your dms for login details! 📬**` +
        `\n\n**📦 Stock Remaining**\n**${borderLeft}${stockBar}${borderRight} (${left}) left**`
      )
      .setFooter({ text: `Claim Bot • Use /claim to get your own • Today at ${time}` });

    if (bannerURL) channelEmbed.setImage(bannerURL);

    const dmDescription = detailLines.length > 0 ? detailLines.join('\n') : '\u200b';

    const dmEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: interaction.guild.name, iconURL: guildIconURL || undefined })
      .setThumbnail(userAvatarURL)
      .setTitle(username ? `${CATEGORY_LABELS[type]} — ${username}` : `${CATEGORY_LABELS[type]}`)
      .setDescription(dmDescription)
      .setFooter({ text: 'Do NOT share your credentials with anyone' })
      .setTimestamp();

    if (currencyFields.length > 0) dmEmbed.addFields(...currencyFields.slice(0, 3));
    dmEmbed.addFields({ name: '🔑 Login Credentials', value: `\`\`\`${credentials}\`\`\``, inline: false });
    if (skinLink) dmEmbed.addFields({ name: '🎨 Skin Link', value: skinLink, inline: false });

    if (bannerURL) dmEmbed.setImage(bannerURL);

    const buttons = [
      new ButtonBuilder()
        .setCustomId('copy_creds')
        .setLabel('Copy Email:Pass')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId('how_to_link')
        .setLabel('How to Link')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('❓')
    ];

    if (skinLink) {
      buttons.splice(1, 0,
        new ButtonBuilder()
          .setLabel('Copy Skin Link')
          .setStyle(ButtonStyle.Link)
          .setEmoji('🎨')
          .setURL(skinLink)
      );
    }

    const row = new ActionRowBuilder().addComponents(buttons.slice(0, 5));

    const dmPayload = { embeds: [dmEmbed], components: [row] };
    const channelPayload = { embeds: [channelEmbed] };
    if (bannerFile) {
      dmPayload.files = [new AttachmentBuilder(bannerFile.path, { name: bannerFile.name })];
      channelPayload.files = [new AttachmentBuilder(bannerFile.path, { name: bannerFile.name })];
    }

    // Processing cascade
    await wait(1300);
    await statusMsg.edit({ content: '⌛ **Processing account...** This may take 30-60 seconds...' }).catch(() => {});
    await wait(10000);
    await statusMsg.edit({ content: '✅ **Account ready!** Here are your details below 👇' }).catch(() => {});

    let delivered = true;
    try {
      await interaction.user.send(dmPayload);
    } catch {
      delivered = false;
    }

    if (delivered) {
      await interaction.editReply(channelPayload);
    } else {
      restoreStock(type, raw);
      updateUser(interaction.user.id, { [`last_claim_${type}`]: lastClaim, last_claim: user.last_claim || 0 });
      await statusMsg.edit({ content: '⚠️ Couldn\'t deliver your account (your DMs may have just closed). It was returned to stock — please run `/claim` again.' }).catch(() => {});
      const failEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⚠️ Delivery Failed')
        .setDescription(`<@${interaction.user.id}> we couldn't finish delivering your account, so it was returned to stock. Please try **/claim** again.`)
        .setTimestamp();
      await interaction.editReply({ embeds: [failEmbed] });
    }
  }
};

