const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');
const { getConfig, setConfig } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setimageforpanel')
    .setDescription('Set the image for the claim code panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('image_url')
        .setDescription('Direct URL to the image (https://...)')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const imageUrl = interaction.options.getString('image_url');

      // Validate URL
      if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        return interaction.reply({ content: '❌ Invalid URL. Must start with http:// or https://', ephemeral: true });
      }

      // Save the image URL
      setConfig('panel_image', imageUrl);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Panel Image Set')
        .setDescription('The claim code panel image has been updated!')
        .addFields({
          name: '🖼️ Image URL',
          value: imageUrl,
          inline: false
        })
        .addFields({
          name: '📝 Note',
          value: 'The image will appear on the `/claimcodepanel` embed.\n\nRun `/claimcodepanel` again to see the updated panel.',
          inline: false
        })
        .setImage(imageUrl)
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err) {
      console.error('Error setting panel image:', err);
      return interaction.reply({ content: '❌ Failed to set panel image.', ephemeral: true });
    }
  }
};

