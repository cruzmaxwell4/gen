const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { getConfig, getUser, updateUser, popStock, restoreStock, stockCount, getBannerFile } = require('../database');
const { hasGenerateAccess, isOwner } = require('../utils');

const CATEGORY_COLORS = { free: 0x57F287, premium: 0xFEE75C };
const CATEGORY_LABELS = { free: '🌟🟢Free Account Made🟢🌟', premium: '🌟⭐Premium Account Made⭐🌟' };

const wait = (ms) => new Promise(res => setTimeout(res, ms));

function parseAccount(raw) {
  // Normalise to string — stock items may have been persisted as objects
  // (e.g. { credentials: "...", ... }) rather than plain strings.
  if (typeof raw !== 'string') {
    if (raw && typeof raw === 'object') {
      // Prefer known string-carrying keys, fall back to JSON
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
    // Currency-style segment: "Credits: 119 / Renown: 5972" -> side-by-side fields
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
    // A field whose value is a URL (e.g. "Profile: https://...") becomes the Skin Link
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
    .setName('generate')
    .setDescription('Generate an account from stock')
    .addStringOption(opt =>
      opt.setName('category')
        .setDescription('Which account type to generate')
        .setRequired(true)
        .addChoices(
          { name: '🟢 Free',    value: 'free' },
          { name: '⭐ Premium', value: 'premium' }
        )
    ),

  async execute(interaction) {
    const category = interaction.options.getString('category');

    // Offline / "thinking" mode. When the owner flips this on with /offline,
    // every /generate just defers and never replies, so it sits at
    // "Generator is thinking…" in the channel (matches a paused generator).
    // NOTE: the bot process must still be running for this to show — a fully
    // crashed/offline bot shows "did not respond" instead.
    if (getConfig('gen_offline', 'false') === 'true') {
      return interaction.deferReply().catch(() => {});
    }

    const genChannelId = getConfig('gen_channel');
    if (genChannelId && interaction.channelId !== genChannelId) {
      return interaction.reply({ content: `❌ Head to <#${genChannelId}> to generate accounts.`, ephemeral: true });
    }

    if (!hasGenerateAccess(interaction.member, category)) {
      const roleId = getConfig(`role_${category.replace('+', 'plus')}`);
      const roleRef = roleId ? `<@&${roleId}>` : `**${category}**`;
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ No Access')
        .setDescription(`You need the ${roleRef} role to generate **${category}** accounts.\n\nUpgrade your membership to unlock this tier.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const user = getUser(interaction.user.id);
    const catKey = category.replace('+', 'plus');
    const cooldown = parseInt(getConfig(`cooldown_${catKey}`, getConfig('gen_cooldown', '0')));
    const now = Math.floor(Date.now() / 1000);
    const lastGen = user[`last_gen_${catKey}`] || 0;
    const remaining = (lastGen + cooldown) - now;

    if (cooldown > 0 && remaining > 0 && !isOwner(interaction.user.id)) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⏳ Cooldown Active')
        .setDescription(`You must wait **${remaining}s** before generating again.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    await interaction.deferReply();

    // Out of stock? Tell them before we DM anything
    if (stockCount(category) <= 0) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Out of Stock')
        .setDescription(`✖️ OUT OF STOCK COME BACK LATER! ✖️`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    // Open the DM with a processing message FIRST — if their DMs are closed we
    // bail out here WITHOUT burning a stock account or the cooldown.
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

    const raw = popStock(category);
    if (!raw) {
      await statusMsg.edit({ content: `❌ **${CATEGORY_LABELS[category]}** just sold out — someone grabbed the last one!` }).catch(() => {});
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Out of Stock')
        .setDescription(`✖️ OUT OF STOCK COME BACK LATER! ✖️`)
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }

    updateUser(interaction.user.id, { [`last_gen_${catKey}`]: now, last_gen: now });

    const { credentials, skinLink, username, detailLines, currencyFields } = parseAccount(raw);

    const guildIconURL = interaction.guild.iconURL({ dynamic: true });
    const userAvatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });
    const color        = CATEGORY_COLORS[category];

    // Banner: either an uploaded file stored on disk (local:) or a direct URL
    const genImage   = getConfig('gen_image') || '';
    const bannerFile = genImage.startsWith('local:') ? getBannerFile() : null;
    const bannerURL  = bannerFile
      ? `attachment://${bannerFile.name}`
      : (/^https?:\/\//.test(genImage) ? genImage : null);

    // ---- CHANNEL EMBED (matches screenshot: minimal + big image) ----
    const left = stockCount(category);

    // Visual stock progress bar (assumes max stock of ~100 for percentage calc)
    const maxBlocks = 10;
    const fullBlocks = Math.min(maxBlocks, Math.max(0, Math.round((left / 100) * maxBlocks)));
    const emptyBlocks = maxBlocks - fullBlocks;
    const stockBar = '▰'.repeat(fullBlocks) + '▪'.repeat(emptyBlocks);
    const borderLeft = category === 'free' ? '🟢' : '🟡';
    const borderRight = category === 'free' ? '🟢' : '🟡';

    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const channelEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'Account Generated', iconURL: guildIconURL || undefined })
      .setThumbnail(userAvatarURL)
      .setDescription(
        (category === 'free'
          ? `<@${interaction.user.id}> Claimed A Account!! Tier: 🟢Free\nCheck your dms for login details! 📩`
          : `<@${interaction.user.id}> Claimed A Account!! Tier: 🌟Premium\nCheck your dms for login details! 📩`
        ) + `\n\n📦 Stock Remaining\n${borderLeft}${stockBar}${borderRight} (${left}) left`
      )
      .setFooter({ text: `Generator • Use /generate to claim your own • Today at ${time}` });

    if (bannerURL) channelEmbed.setImage(bannerURL);

    // Onami Gen 3D box branding — shown below the tier info in the channel embed.
    // Configure via /config (or the config store) with key "onami_box_image" set
    // to a direct image URL of the 3D box graphic.
    const onamiBoxImage = getConfig('onami_box_image') || '';
    if (onamiBoxImage) {
      channelEmbed.addFields({ name: '\u200b', value: '\u200b', inline: false });
      channelEmbed.addFields({ name: '📦 Onami Gen', value: `[View 3D Box](${onamiBoxImage})`, inline: false });
      if (!bannerURL) channelEmbed.setImage(onamiBoxImage);
    }

    // ---- DM EMBED (matches screenshot: detail block + currency columns + credentials + skin link) ----
    const dmDescription = detailLines.length > 0 ? detailLines.join('\n') : '\u200b';

    const dmEmbed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: interaction.guild.name, iconURL: guildIconURL || undefined })
      .setThumbnail(userAvatarURL)
      .setTitle(username ? `${CATEGORY_LABELS[category]} — ${username}` : `${CATEGORY_LABELS[category]}`)
      .setDescription(dmDescription)
      .setFooter({ text: 'Generator • Do NOT share your credentials with anyone' })
      .setTimestamp();

    // Currency shown as side-by-side columns (e.g. Credits | Renown)
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
        .setEmoji('❓'),
      new ButtonBuilder()
        .setLabel('Upgrade Premium')
        .setStyle(ButtonStyle.Link)
        .setEmoji('⬆️')
        .setURL('https://discord.com/channels/' + interaction.guild.id)
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

    // Play the "processing" cascade in the DM, then deliver the account embed
    await wait(1300);
    await statusMsg.edit({ content: '⌛ **Adding account to API...** This may take 30-60 seconds...' }).catch(() => {});
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
      // Delivery failed after we popped the account — put it back & refund the cooldown
      restoreStock(category, raw);
      updateUser(interaction.user.id, { [`last_gen_${catKey}`]: lastGen, last_gen: user.last_gen || 0 });
      await statusMsg.edit({ content: '⚠️ Couldn\'t deliver your account (your DMs may have just closed). It was returned to stock — please run `/generate` again.' }).catch(() => {});
      const failEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('⚠️ Delivery Failed')
        .setDescription(`<@${interaction.user.id}> we couldn't finish delivering your account, so it was returned to stock. Please try **/generate** again.`)
        .setTimestamp();
      await interaction.editReply({ embeds: [failEmbed] });
    }
  }
};
