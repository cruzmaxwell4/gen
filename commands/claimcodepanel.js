const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { getUser, updateUser, getConfig } = require('../database');
const fs = require('fs');
const path = require('path');

// Helper to find and remove a code from stock
function findAndRemoveCode(code) {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const filePath = path.join(dataDir, 'codes_PREMIUM.json');

  try {
    if (!fs.existsSync(filePath)) return null;

    let stock = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!stock.premium) stock.premium = [];

    const index = stock.premium.indexOf(code);
    if (index !== -1) {
      // Found it! Remove and save
      stock.premium.splice(index, 1);
      fs.writeFileSync(filePath, JSON.stringify(stock, null, 2));
      return true;
    }
  } catch (err) {
    console.error(`Error checking codes:`, err);
  }

  return null;
}

// Helper to pop a premium account
function popPremiumAccount() {
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const accountsPath = path.join(dataDir, 'accounts_PREMIUM.json');

  try {
    if (!fs.existsSync(accountsPath)) return null;

    let accountsData = JSON.parse(fs.readFileSync(accountsPath, 'utf8'));
    if (!accountsData.premium || accountsData.premium.length === 0) return null;

    // Pop first account
    const account = accountsData.premium.shift();
    fs.writeFileSync(accountsPath, JSON.stringify(accountsData, null, 2));
    return account;
  } catch (err) {
    console.error('Error getting premium account:', err);
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('claimcodepanel')
    .setDescription('Show the promotional code claim panel'),

  async execute(interaction) {
    // Get the panel type from config (default to premium)
    const panelType = getConfig('claim_panel_type', 'premium');

    let embed;

    if (panelType === 'free') {
      // Free claim panel
      embed = new EmbedBuilder()
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
    } else {
      // Premium claim panel (default)
      embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🌟Claim your Premium code here!')
        .setDescription('Have a Premium code? Use the button below to unlock free account access!')
        .addFields({
          name: '✨ What do I get?',
          value: '🌊 Really good accounts\n📦 If bad make a ticket for replacement\n🎉 Comes with 1 free link',
          inline: false
        })
        .setFooter({ text: 'Code & Claim • One claim per code' })
        .setTimestamp();
    }

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
    return interaction.reply({ content: '❌ Invaild Code❌', ephemeral: true });
  }

  try {
    // Find and remove the code
    const codeFound = findAndRemoveCode(code);

    if (!codeFound) {
      return interaction.reply({ content: '❌ Invaild Code❌', ephemeral: true });
    }

    // Get premium account
    const account = popPremiumAccount();

    // Grant premium subscription access
    const premiumExpires = Math.floor(new Date(2100, 0, 1).getTime() / 1000);
    updateUser(interaction.user.id, {
      subscription: 'premium',
      sub_expires: premiumExpires
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
    const successEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Premium Access Granted!')
      .setDescription(`You now have premium subscription!`)
      .addFields({
        name: '📊 Subscription Details',
        value: `**Status:** Premium\n**Expires:** Never (Lifetime)`,
        inline: false
      })
      .addFields({
        name: '🎯 Next Steps',
        value: account
          ? `Your premium account has been sent to your DMs!`
          : 'Please contact support for your account.',
        inline: false
      })
      .setFooter({ text: 'Code & Claim • Enjoy your premium subscription!' })
      .setTimestamp();

    await interaction.reply({ embeds: [successEmbed], ephemeral: true });

    // If account exists, send it to user DM
    if (account) {
      try {
        const accountEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('✅ Premium Account Details')
          .setDescription('Here are your premium account credentials:')
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
    }

    // Send log message to log channel if configured
    const logChannelId = getConfig('log_channel');
    if (logChannelId && client) {
      try {
        const logChannel = await client.channels.fetch(logChannelId);
        
        if (logChannel?.isTextBased?.()) {
          const logEmbed = new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('🎁 Code Claimed')
            .setDescription(`${interaction.user} claimed a premium code!`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .addFields({
              name: '👤 User',
              value: `${interaction.user.username}#${interaction.user.discriminator}`,
              inline: true
            })
            .addFields({
              name: '⭐ Type',
              value: 'Premium',
              inline: true
            })
            .addFields({
              name: '🔑 Code Used',
              value: `\`${code}\``,
              inline: false
            })
            .addFields({
              name: '⏰ Claimed At',
              value: new Date().toLocaleString(),
              inline: false
            })
            .setFooter({ text: 'Code & Claim • Code Claim Logs' })
            .setTimestamp();

          await logChannel.send({ embeds: [logEmbed] });
        }
      } catch (err) {
        console.error('⚠️ Failed to send log message:', err?.message || err);
      }
    }
  } catch (err) {
    console.error('Error claiming code:', err);
    return interaction.reply({ content: '❌ An error occurred while claiming your code.', ephemeral: true });
  }
}

module.exports.handleClaimCodeButton = handleClaimCodeButton;
module.exports.handleClaimCodeModal = handleClaimCodeModal;

