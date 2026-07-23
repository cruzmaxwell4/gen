const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isOwner } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restock')
    .setDescription('Send a restock notification for products')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
      opt.setName('product_name')
        .setDescription('Name of the product (e.g., Mystery Diamond (NFA))')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('variants_json')
        .setDescription('JSON format: [{"name":"Xbox Mystery","price":"£6.75","stock":"20"},...]')
        .setRequired(true)
    )
    .addStringOption(opt =>
      opt.setName('supplier')
        .setDescription('Supplier/Source name (e.g., Flores)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ content: '❌ Only the bot owner can use this command.', ephemeral: true });
    }

    try {
      const productName = interaction.options.getString('product_name');
      const variantsJson = interaction.options.getString('variants_json');
      const supplier = interaction.options.getString('supplier') || 'Supplier';

      // Parse JSON variants
      let variants;
      try {
        variants = JSON.parse(variantsJson);
        if (!Array.isArray(variants)) {
          return interaction.reply({ content: '❌ Variants must be a JSON array!', ephemeral: true });
        }
      } catch (err) {
        return interaction.reply({ content: `❌ Invalid JSON format: ${err.message}`, ephemeral: true });
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(0x00D26A) // Green for restock
        .setTitle('🎁 Product Restocked!')
        .setDescription(`**${productName}** has just been restocked!\n\n**Buy Now →**`)
        .setThumbnail('https://media.discordapp.net/attachments/1234567890/restocked.png')
        .setFooter({ text: supplier })
        .setTimestamp();

      // Add variants as fields (3 per row)
      for (let i = 0; i < variants.length; i += 3) {
        const variantsChunk = variants.slice(i, i + 3);
        const fieldValue = variantsChunk
          .map(v => `**${v.name}**\n💰 ${v.price}\n📦 Stock: ${v.stock}`)
          .join('\n\n');

        embed.addFields({
          name: i === 0 ? 'Variant' : '\u200b',
          value: fieldValue,
          inline: true
        });
      }

      // Send to channel
      await interaction.channel.send({ embeds: [embed] });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Restock Notification Sent')
        .setDescription(`**${productName}** restock message posted!\n\nVariants: ${variants.length}`)
        .addFields({
          name: '📊 Details',
          value: `**Product:** ${productName}\n**Supplier:** ${supplier}\n**Total Variants:** ${variants.length}`,
          inline: false
        })
        .setFooter({ text: 'Generator' })
        .setTimestamp();

      await interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (err) {
      console.error('Error sending restock notification:', err);
      return interaction.reply({ content: '❌ Failed to send restock notification.', ephemeral: true });
    }
  }
};

