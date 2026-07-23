const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getConfig, popStock } = require('../database');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimpanelfree')
    .setDescription('Show the free code claim panel'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('🎁 Claim your free code here!')
      .setDescription('Use the button below to unlock a free account!')
      .addFields({
        name: '✨ What do I get?',
        value: '🌊 Free account access\n📦 Basic account features\n🎉 Free stuff!',
        inline: false
      })
      .setFooter({ text: 'Code & Claim • One claim per code' })
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
    return interaction.reply({ content: '❌ Invaild Code❌', ephemeral: true });
  }

  try {
    const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
    const freeCodesPath = path.join(dataDir, 'codes_FREE.json');

    if (!fs.existsSync(freeCodesPath)) {
      return interaction.reply({ content: '❌ Invaild Code❌', ephemeral: true });
    }

    let freeCodesData = JSON.parse(fs.readFileSync(freeCodesPath, 'utf8'));
    const freeCodesList = freeCodesData.free || [];

    // Check if code exists (case insensitive) - DO NOT REMOVE, codes are reusable
    const foundCode = freeCodesList.find(c => c.toUpperCase() === code.toUpperCase());

    if (!foundCode) {
      return interaction.reply({ content: '❌ Invaild Code❌', ephemeral: true });
    }

    // Get a free account from accounts pool (REMOVE IT - one per claim, not reusable)
    const account = popStock('free', 'accounts_FREE');

    if (!account) {
      return interaction.reply({ 
        content: '❌ No accounts available! Please contact support.', 
        ephemeral: true 
      });
    }

    // SUCCESS - Code is valid and reusable (never deleted), but account IS deleted
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Free Code Claimed!')
      .setDescription(`Your free code **${code}** has been claimed!\n\nYou now have free account access.`)
      .addFields({
        name: '🎯 Next Steps',
        value: `Your account has been sent to your DMs!`,
        inline: false
      })
      .setFooter({ text: 'Code & Claim • Enjoy your free account!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    // Send account to user DM (account has been deleted from pool)
    try {
      const accountEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Free Account Details')
        .setDescription('Here are your free account credentials:')
        .addFields({
          name: '🔑 Account',
          value: `\`\`\`${account}\`\`\``,
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Keep these safe!' })
        .setTimestamp();

      await interaction.user.send({ embeds: [accountEmbed] }).catch(err => {
        console.error('Failed to send account to DM:', err?.message || err);
      });
    } catch (err) {
      console.error('Error sending account:', err);
    }

    // Send to transcript channel
    const transcriptChannelId = getConfig('transcript_channel');
    if (transcriptChannelId && client) {
      try {
        const transcriptChannel = await client.channels.fetch(transcriptChannelId);
        
        if (transcriptChannel?.isTextBased?.()) {
          const guildIcon = interaction.guild?.iconURL({ dynamic: true }) || null;
          const userAvatar = interaction.user.displayAvatarURL({ dynamic: true, size: 256 });

          const transcriptEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('📝 Free Code Claimed - Transcript')
            .setAuthor({ 
              name: interaction.guild?.name || 'Unknown Server',
              iconURL: guildIcon
            })
            .setThumbnail(userAvatar)
            .addFields({
              name: '👤 User',
              value: `${interaction.user.username}#${interaction.user.discriminator}`,
              inline: true
            })
            .addFields({
              name: '🆔 User ID',
              value: interaction.user.id,
              inline: true
            })
            .addFields({
              name: '🔑 Code Claimed',
              value: `\`${code}\``,
              inline: false
            })
            .addFields({
              name: '🎁 Account Received',
              value: `\`\`\`${account}\`\`\``,
              inline: false
            })
            .addFields({
              name: '⏰ Claimed At',
              value: new Date().toLocaleString(),
              inline: false
            })
            .addFields({
              name: '🌊 Tier',
              value: 'Free',
              inline: true
            })
            .setFooter({ text: 'Code & Claim • Transcript Log' })
            .setTimestamp();

          await transcriptChannel.send({ embeds: [transcriptEmbed] });
        }
      } catch (err) {
        console.error('⚠️ Failed to send transcript:', err?.message || err);
      }
    }

    // Send to log channel (old behavior)
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
              value: 'Code is reusable - Account has been delivered and removed from pool',
              inline: false
            })
            .setFooter({ text: 'Code & Claim • Free Code Claim Logs' })
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

