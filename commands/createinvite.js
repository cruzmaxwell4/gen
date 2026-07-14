const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { saveInvite } = require('../database');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createinvite')
    .setDescription('Create a tracked server invite')
    .setDefaultMemberPermissions(PermissionFlagsBits.CreateInstantInvite)
    .addIntegerOption(opt =>
      opt.setName('max_uses')
        .setDescription('Max uses (0 = unlimited)')
        .setRequired(false)
        .setMinValue(0)
    )
    .addIntegerOption(opt =>
      opt.setName('max_age')
        .setDescription('Expiry in seconds (0 = never)')
        .setRequired(false)
        .setMinValue(0)
    ),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const maxUses = interaction.options.getInteger('max_uses') ?? 0;
    const maxAge = interaction.options.getInteger('max_age') ?? 0;

    try {
      const invite = await interaction.channel.createInvite({ maxUses, maxAge, reason: `Created by ${interaction.user.tag}` });
      saveInvite(invite.code, interaction.user.id, maxUses);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Invite Created')
        .addFields(
          { name: 'Link', value: `https://discord.gg/${invite.code}`, inline: false },
          { name: 'Max Uses', value: maxUses === 0 ? 'Unlimited' : String(maxUses), inline: true },
          { name: 'Expires', value: maxAge === 0 ? 'Never' : `in ${maxAge}s`, inline: true }
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply(`❌ Could not create invite: ${err.message}`);
    }
  }
};
