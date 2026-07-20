const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { popStock, getUser, updateUser, getConfig } = require('../database');

// Duration in seconds
const DURATION_SECONDS = {
  '1DAY': 86400,      // 1 day
  '3DAY': 259200,     // 3 days
  '1WEEK': 604800,    // 1 week
  '1MONTH': 2592000   // ~30 days
};

const DURATION_DISPLAY = {
  '1DAY': '1️⃣ Day',
  '3DAY': '3️⃣ Days',
  '1WEEK': '📆 Week',
  '1MONTH': '📅 Month',
  'LIFETIME': '♾️ Lifetime'
};

// Map code duration to account tier
const DURATION_TO_TIER = {
  '1DAY': 'premium',
  '3DAY': 'premium',
  '1WEEK': 'premium',
  '1MONTH': 'premium',
  'LIFETIME': 'premium'
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimcodepanel')
    .setDescription('Show the promotional code claim panel'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎁 Claim Premium Access')
      .setDescription('Have a promotional code? Use the button below to claim premium access AND a premium account!')
      .addFields({
        name: '✨ What do I get?',
        value: '🌟 Premium subscription with set duration\n📦 One premium account instantly\n🎨 Premium-only features',
        inline: false
      })
      .setFooter({ text: 'Generator • One claim per code - Includes account + subscription!' })
      .setTimestamp();

    const button = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('claim_code_btn')
        .setLabel('Claim Code')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎁')
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  }
};

// Handle button click
async function handleClaimCodeButton(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('claim_code_modal')
    .setTitle('Enter Your Promotional Code')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('promo_code_input')
          .setLabel('Promotional Code')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., PREM1234567ABC')
          .setRequired(true)
          .setMaxLength(50)
      )
    );

  await interaction.showModal(modal);
}

// Handle modal submit
async function handleClaimCodeModal(interaction, client) {
  const code = interaction.fields.getTextInputValue('promo_code_input')?.toUpperCase().trim();

  if (!code) {
    return interaction.reply({ content: '❌ Please enter a valid code.', ephemeral: true });
  }

  try {
    // Check all duration tiers for the code
    const durations = ['1DAY', '3DAY', '1WEEK', '1MONTH', 'LIFETIME'];
    let foundCode = null;
    let usedDuration = null;

    // Try to find and pop the code from each duration tier
    for (const dur of durations) {
      const table = `codes_${dur}`;
      const popped = popStock(dur, table);
      
      if (popped === code) {
        foundCode = popped;
        usedDuration = dur;
        break;
      } else if (popped) {
        // Code wasn't found in this tier, restore it
        const { restoreStock } = require('../database');
        restoreStock(dur, popped, table);
      }
    }

    if (!foundCode) {
      return interaction.reply({ content: '❌ Invalid or already claimed promotional code.', ephemeral: true });
    }

    // Now try to get an account from the premium stock
    const accountTier = DURATION_TO_TIER[usedDuration];
    const account = popStock(accountTier, 'stock');

    if (!account) {
      // Code was valid but no account available - restore the code
      const { restoreStock } = require('../database');
      restoreStock(usedDuration, foundCode, `codes_${usedDuration}`);
      return interaction.reply({ content: '❌ Code is valid but no accounts available in stock. Try again later!', ephemeral: true });
    }

    // Grant premium access
    let newExpires = 0;

    if (usedDuration === 'LIFETIME') {
      // Set to year 2100 (never expires in practice)
      newExpires = Math.floor(new Date(2100, 0, 1).getTime() / 1000);
    } else {
      // Add duration seconds to now
      const durationSeconds = DURATION_SECONDS[usedDuration] || 86400;
      newExpires = Math.floor(Date.now() / 1000) + durationSeconds;
    }

    updateUser(interaction.user.id, {
      subscription: 'premium',
      sub_expires: newExpires
    });

    // Try to assign premium role
    const roleId = getConfig('role_premium');
    if (roleId && interaction.guild) {
      try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (member && !member.roles.cache.has(roleId)) {
          await member.roles.add(roleId);
        }
      } catch (err) {
        console.error('⚠️ Failed to assign premium role:', err?.message || err);
      }
    }

    // Parse account like in /generate command
    const { credentials, skinLink, username, detailLines, currencyFields } = parseAccount(account);
    const userAvatarURL = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });
    const guildIconURL = interaction.guild?.iconURL({ dynamic: true });

    // Send account details embed
    const dmDescription = detailLines.length > 0 ? detailLines.join('\n') : '\u200b';

    const dmEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: interaction.guild?.name || 'Generator', iconURL: guildIconURL || undefined })
      .setThumbnail(userAvatarURL)
      .setTitle(`${DURATION_DISPLAY[usedDuration]} Premium Account`)
      .setDescription(dmDescription)
      .setFooter({ text: 'Generator • Do NOT share your credentials with anyone' })
      .setTimestamp();

    if (currencyFields.length > 0) dmEmbed.addFields(...currencyFields.slice(0, 3));
    dmEmbed.addFields({ name: '🔑 Login Credentials', value: `\`\`\`${credentials}\`\`\``, inline: false });
    if (skinLink) dmEmbed.addFields({ name: '🎨 Skin Link', value: skinLink, inline: false });

    // Send account to DM
    try {
      await interaction.user.send({ embeds: [dmEmbed] });
    } catch (err) {
      console.error('Failed to send account via DM:', err);
    }

    // Send success message to user
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Code Claimed Successfully!')
      .setDescription(`You now have **${DURATION_DISPLAY[usedDuration]}** of premium access!`)
      .addFields({
        name: '📦 What You Got',
        value: `🌟 Premium subscription (${DURATION_DISPLAY[usedDuration]})\n📱 One premium account (sent to DMs)\n🎯 Instant access to premium features`,
        inline: false
      })
      .setFooter({ text: 'Generator • Account details sent to your DMs' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (err) {
    console.error('Error claiming code:', err);
    return interaction.reply({ content: '❌ An error occurred while claiming your code.', ephemeral: true });
  }
}

// Account parsing function (from /generate command)
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

module.exports.handleClaimCodeButton = handleClaimCodeButton;
module.exports.handleClaimCodeModal = handleClaimCodeModal;

