const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const fs = require('fs');
const path = require('path');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('addcodeaccounts')
    .setDescription('Link accounts to codes (Premium or Free)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Code type')
        .setRequired(true)
        .addChoices(
          { name: '⭐ Premium (One code = One account)', value: 'premium' },
          { name: '🌊 Free (Reusable code shared with accounts)', value: 'free' }
        )
    )
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('Text file with accounts (one per line, format: email|pass)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    const type = interaction.options.getString('type');
    const attachment = interaction.options.getAttachment('file');

    // Validate file type
    if (!attachment.name.endsWith('.txt')) {
      return interaction.reply({ content: '❌ Please upload a `.txt` file.', ephemeral: true });
    }

    // Validate file size (max 10MB to be safe)
    if (attachment.size > 10 * 1024 * 1024) {
      return interaction.reply({ content: '❌ File is too large. Max 10MB.', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Download file content
      const response = await fetch(attachment.url);
      const text = await response.text();

      // Parse accounts (one per line, trim whitespace)
      const accounts = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      if (accounts.length === 0) {
        return interaction.editReply({ content: '❌ No valid accounts found in the file.' });
      }

      const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
      const accountsFilePath = path.join(dataDir, `accounts_${type.toUpperCase()}.json`);

      // Read existing accounts
      let accountsData = {};
      if (fs.existsSync(accountsFilePath)) {
        try {
          accountsData = JSON.parse(fs.readFileSync(accountsFilePath, 'utf8'));
        } catch (err) {
          console.error('Error reading accounts file:', err);
          accountsData = {};
        }
      }

      const accountsKey = type;
      if (!accountsData[accountsKey]) {
        accountsData[accountsKey] = [];
      }

      // Add all new accounts
      const addedCount = accounts.length;
      accountsData[accountsKey].push(...accounts);

      // Save to file
      fs.writeFileSync(accountsFilePath, JSON.stringify(accountsData, null, 2));

      const typeLabel = type === 'premium' ? '⭐ Premium' : '🌊 Free';

      const embed = new EmbedBuilder()
        .setColor(type === 'premium' ? 0xFEE75C : 0x57F287)
        .setTitle('✅ Accounts Added Successfully')
        .setDescription(`Added **${addedCount}** ${typeLabel} account(s)`)
        .addFields({
          name: '📊 Details',
          value: `**File:** ${attachment.name}\n**Type:** ${typeLabel}\n**Accounts Imported:** ${addedCount}`,
          inline: false
        })
        .addFields({
          name: '📝 Account Info',
          value: type === 'free' 
            ? '🔄 Reusable (shared account for all who claim the free code)'
            : '🔐 One-to-one (each code gets paired with one account)',
          inline: false
        })
        .setFooter({ text: 'Code & Claim • Accounts are ready to deliver!' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error processing accounts file:', err);
      return interaction.editReply({ content: '❌ Failed to process the file. Make sure it\'s a valid text file.' });
    }
  }
};

