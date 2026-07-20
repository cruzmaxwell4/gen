const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getConfig, setConfig, getUser, updateUser } = require('../database');

// Duration in seconds
const DURATION_SECONDS = {
  '1DAY': 86400,      // 1 day
  '3DAY': 259200,     // 3 days
  '1WEEK': 604800,    // 1 week
  '1MONTH': 2592000   // ~30 days
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimcodepanel')
    .setDescription('Show the promotional code claim panel'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎁 Claim Premium Access')
      .setDescription('Have a promotional code? Use the button below to claim premium access for a limited time or permanently!')
      .addFields({
        name: '✨ What do I get?',
        value: '🌟 Premium account generation rights\n📦 Access to premium stock\n🎨 Premium-only features',
        inline: false
      })
      .setFooter({ text: 'Generator • One claim per code' })
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
    // Load all codes
    const allCodes = JSON.parse(getConfig('promo_codes', '[]'));
    const codeObj = allCodes.find(c => c.code === code);

    if (!codeObj) {
      return interaction.reply({ content: '❌ Invalid promotional code.', ephemeral: true });
    }

    if (codeObj.used) {
      return interaction.reply({ content: '❌ This code has already been claimed.', ephemeral: true });
    }

    // Mark code as used
    codeObj.used = true;
    codeObj.used_by = interaction.user.id;
    codeObj.used_at = Math.floor(Date.now() / 1000);
    setConfig('promo_codes', JSON.stringify(allCodes));

    // Grant premium access
    const user = getUser(interaction.user.id);
    let newExpires = 0;

    if (codeObj.duration === 'LIFETIME') {
      // Set to year 2100 (never expires in practice)
      newExpires = Math.floor(new Date(2100, 0, 1).getTime() / 1000);
    } else {
      // Add duration seconds to now
      const durationSeconds = DURATION_SECONDS[codeObj.duration] || 86400;
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

    // Send success message
    const durationLabel = {
      '1DAY': '1️⃣ Day',
      '3DAY': '3️⃣ Days',
      '1WEEK': '📆 Week',
      '1MONTH': '📅 Month',
      'LIFETIME': '♾️ Lifetime'
    }[codeObj.duration];

    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Premium Access Granted!')
      .setDescription(`You now have **${durationLabel}** of premium access!`)
      .addFields({
        name: '📦 Benefits',
        value: '🌟 Generate premium accounts\n📊 Access premium stock\n⚡ Priority support',
        inline: false
      })
      .setFooter({ text: 'Generator • Enjoy your premium access!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });
  } catch (err) {
    console.error('Error claiming code:', err);
    return interaction.reply({ content: '❌ An error occurred while claiming your code.', ephemeral: true });
  }
}

module.exports.handleClaimCodeButton = handleClaimCodeButton;
module.exports.handleClaimCodeModal = handleClaimCodeModal;

