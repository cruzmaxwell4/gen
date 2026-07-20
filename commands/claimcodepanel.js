const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, updateUser, getConfig } = require('../database');
const fs = require('fs');
const path = require('path');

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

// Helper to find and remove a code from stock
function findAndRemoveCode(code) {
  const durations = ['1DAY', '3DAY', '1WEEK', '1MONTH', 'LIFETIME'];
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

  for (const dur of durations) {
    const filePath = path.join(dataDir, `codes_${dur}.json`);
    try {
      if (!fs.existsSync(filePath)) continue;

      let stock = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (!stock[dur]) stock[dur] = [];

      const index = stock[dur].indexOf(code);
      if (index !== -1) {
        // Found it! Remove and save
        stock[dur].splice(index, 1);
        fs.writeFileSync(filePath, JSON.stringify(stock, null, 2));
        return dur;
      }
    } catch (err) {
      console.error(`Error checking codes for ${dur}:`, err);
    }
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimcodepanel')
    .setDescription('Show the promotional code claim panel'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎁 Claim your prem gen here!')
      .setDescription('Have a promotional code? Use the button below to unlock premium access!')
      .addFields({
        name: '✨ What do I get?',
        value: '🌟 Premium subscription for set duration\n📦 Access to /generate premium accounts\n🎨 Premium-only features',
        inline: false
      })
      .setFooter({ text: 'Generator • One claim per code' })
      .setTimestamp();

    // Try to load custom image if set
    const panelImage = getConfig('panel_image');
    if (panelImage) {
      if (panelImage.startsWith('http://') || panelImage.startsWith('https://')) {
        embed.setImage(panelImage);
      }
    }

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
    // Find and remove the code
    const usedDuration = findAndRemoveCode(code);

    if (!usedDuration) {
      return interaction.reply({ content: '❌ Invalid or already claimed promotional code.', ephemeral: true });
    }

    // Grant premium subscription access
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

    // Send success message to user
    const expiryDate = newExpires > Math.floor(new Date(2099, 0, 1).getTime() / 1000) 
      ? 'Never (Lifetime)' 
      : new Date(newExpires * 1000).toLocaleString();

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Premium Access Granted!')
      .setDescription(`You now have **${DURATION_DISPLAY[usedDuration]}** of premium subscription!`)
      .addFields({
        name: '📊 Subscription Details',
        value: `**Duration:** ${DURATION_DISPLAY[usedDuration]}\n**Expires:** ${expiryDate}`,
        inline: false
      })
      .addFields({
        name: '🎯 Next Steps',
        value: 'Use `/generate premium` to generate premium accounts!\n\nYou now have full access to premium features and account generation.',
        inline: false
      })
      .setFooter({ text: 'Generator • Enjoy your premium subscription!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (err) {
    console.error('Error claiming code:', err);
    return interaction.reply({ content: '❌ An error occurred while claiming your code.', ephemeral: true });
  }
}

module.exports.handleClaimCodeButton = handleClaimCodeButton;
module.exports.handleClaimCodeModal = handleClaimCodeModal;

