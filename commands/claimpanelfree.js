const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getConfig, setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimpanelfree')
    .setDescription('Show the free code claim panel'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎁 Claim your free code here!')
      .setDescription('Have a free code? Use the button below to unlock free account access!')
      .addFields({
        name: '✨ What do I get?',
        value: '🌊 Free account access\n📦 Basic account features\n🎉 Free stuff!',
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
        .setCustomId('claim_code_btn_free')
        .setLabel('Claim Code')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎁')
    );

    await interaction.reply({ embeds: [embed], components: [button] });
  }
};

// Handle button click for free claims
async function handleClaimCodeButtonFree(interaction, client) {
  const modal = new ModalBuilder()
    .setCustomId('claim_code_modal_free')
    .setTitle('Enter Your Free Code')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('free_code_input')
          .setLabel('Free Code')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('e.g., FREECODE123')
          .setRequired(true)
          .setMaxLength(50)
      )
    );

  await interaction.showModal(modal);
}

// Handle modal submit for free claims
async function handleClaimCodeModalFree(interaction, client) {
  const code = interaction.fields.getTextInputValue('free_code_input')?.toUpperCase().trim();

  if (!code) {
    return interaction.reply({ content: '❌ Please enter a valid code.', ephemeral: true });
  }

  try {
    const fs = require('fs');
    const path = require('path');

    // Check if code exists in free codes
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    const freeCodesPath = path.join(dataDir, 'codes_FREE.json');

    if (!fs.existsSync(freeCodesPath)) {
      return interaction.reply({ content: '❌ No free codes available.', ephemeral: true });
    }

    let freeCodesData = JSON.parse(fs.readFileSync(freeCodesPath, 'utf8'));
    const freeCodesList = freeCodesData.free || [];

    // Check if code exists (case insensitive)
    const foundCode = freeCodesList.find(c => c.toUpperCase() === code.toUpperCase());

    if (!foundCode) {
      return interaction.reply({ content: '❌ Invalid free code. Code does not exist.', ephemeral: true });
    }

    // SUCCESS - Code is valid and reusable (never deleted)
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Free Code Claimed!')
      .setDescription(`Your free code **${code}** has been claimed!\n\nYou now have free account access.`)
      .addFields({
        name: '🎯 Next Steps',
        value: 'Use `/claim type:Free` to generate your free account!',
        inline: false
      })
      .setFooter({ text: 'Generator • Enjoy your free account!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    // Send log message to log channel if configured
    const { getConfig: getConfigFunc } = require('../database');
    const logChannelId = getConfigFunc('log_channel');
    if (logChannelId && client) {
      try {
        const logChannel = await client.channels.fetch(logChannelId);
        
        if (logChannel?.isTextBased?.()) {
          const logEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🎁 Free Code Claimed')
            .setDescription(`${interaction.user} claimed a free code!`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields({
              name: '👤 User',
              value: `${interaction.user.username}#${interaction.user.discriminator}`,
              inline: true
            })
            .addFields({
              name: '🔑 Code Used',
              value: `\`${code}\``,
              inline: true
            })
            .addFields({
              name: '⏰ Claimed At',
              value: new Date().toLocaleString(),
              inline: false
            })
            .addFields({
              name: '📝 Note',
              value: 'This code is reusable and can be claimed again',
              inline: false
            })
            .setFooter({ text: 'Generator • Free Code Claim Logs' })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error('⚠️ Failed to send log message:', err?.message || err);
      }
    }
  } catch (err) {
    console.error('Error claiming free code:', err);
    return interaction.reply({ content: '❌ An error occurred while claiming your code.', ephemeral: true });
  }
}

module.exports.handleClaimCodeButtonFree = handleClaimCodeButtonFree;
module.exports.handleClaimCodeModalFree = handleClaimCodeModalFree;

