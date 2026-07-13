const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { setConfig, saveBanner, clearBanner } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setimage')
    .setDescription('Set the banner image shown in generate embeds (owner only)')
    .addAttachmentOption(opt =>
      opt.setName('image')
        .setDescription('Upload an image file (recommended — never expires)')
        .setRequired(false)
    )
    .addStringOption(opt =>
      opt.setName('url')
        .setDescription('OR paste a direct image URL (jpg/png/gif)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!ownerOnly(interaction)) return;
    await interaction.deferReply({ ephemeral: true });

    const attachment = interaction.options.getAttachment('image');
    const url = (interaction.options.getString('url') || '').trim();

    // 1) Uploaded file — download & store on disk so the link never expires
    if (attachment) {
      const ct = attachment.contentType || '';
      if (!ct.startsWith('image/')) {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Not an Image')
            .setDescription('That file is not an image. Please upload a `.png`, `.jpg`, or `.gif`.')
            .setTimestamp()]
        });
      }

      let buffer;
      try {
        const res = await fetch(attachment.url);
        buffer = Buffer.from(await res.arrayBuffer());
      } catch {
        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('❌ Download Failed')
            .setDescription('Could not download that image. Please try the command again.')
            .setTimestamp()]
        });
      }

      const ext = ct.split('/')[1] || (attachment.name || '').split('.').pop() || 'png';
      const filename = saveBanner(buffer, ext);
      setConfig('gen_image', `local:${filename}`);

      const file = new AttachmentBuilder(buffer, { name: filename });
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🖼️ Banner Image Set')
          .setDescription('Saved! This image will appear in every generate embed (channel + DM) and will **not** expire.')
          .setImage(`attachment://${filename}`)
          .setFooter({ text: 'Generator' })
          .setTimestamp()],
        files: [file]
      });
    }

    // 2) Direct URL
    if (url) {
      clearBanner();
      setConfig('gen_image', url);
      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🖼️ Banner Image Set')
          .setDescription('This image will now appear in both the channel embed and DM when an account is generated.\n\n⚠️ Heads up: links copied from Discord uploads **expire after ~24h**. For a permanent banner, re-run `/setimage` and use the **image** upload option instead.')
          .setImage(url)
          .setFooter({ text: 'Generator' })
          .setTimestamp()]
      });
    }

    // 3) Nothing provided — remove the banner
    clearBanner();
    setConfig('gen_image', '');
    return interaction.editReply({
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🖼️ Banner Image Removed')
        .setDescription('Generate embeds will no longer show a banner image.')
        .setTimestamp()]
    });
  }
};
