/**
 * BULLETPROOF COMMAND TEMPLATE
 * Use this pattern for ALL commands to ensure zero crashes
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../database');
const { ownerOnly } = require('../utils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command with bulletproof error handling'),

  async execute(interaction) {
    // ALWAYS wrap in try-catch
    try {
      // Check interaction exists
      if (!interaction) {
        console.warn('⚠️ Null interaction in example command');
        return;
      }

      // Check permissions if needed
      if (needsOwner && !ownerOnly(interaction)) return;

      // Defer reply early
      try {
        await interaction.deferReply({ ephemeral: true });
      } catch (err) {
        console.error('⚠️ Failed to defer:', err?.message || err);
        return;
      }

      // Get and validate user input
      const userOption = interaction.options?.getUser?.('user');
      if (!userOption?.id) {
        await interaction.editReply({ content: '❌ Invalid user.' }).catch(() => {});
        return;
      }

      // Get database objects safely
      const user = getUser(userOption.id);
      if (!user) {
        await interaction.editReply({ content: '❌ Could not load user data.' }).catch(() => {});
        return;
      }

      // Do the operation
      // ...

      // Send response
      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Success')
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] }).catch(() => {});

    } catch (err) {
      // Log the error
      console.error(`❌ Error in /example:`, err?.message || err);

      // Always send error to user
      try {
        const errorMsg = { content: '❌ An error occurred.', ephemeral: true };
        if (interaction?.replied || interaction?.deferred) {
          await interaction.followUp(errorMsg).catch(() => {});
        } else {
          await interaction.reply(errorMsg).catch(() => {});
        }
      } catch (replyErr) {
        console.error('Failed to send error response:', replyErr?.message || replyErr);
      }
    }
  }
};

/*
KEY PATTERNS:

1. ALWAYS have try-catch at top level
2. Check interaction exists first
3. Defer early to avoid timeout
4. Validate ALL input options
5. Use ?. optional chaining
6. Check database returns aren't null
7. Use .catch(()=>{}) on all Discord calls
8. Send error response in catch block
9. Log errors with readable messages
10. Never assume data structure exists

SAFETY CHECKS:

if (!interaction) return;
if (!user?.id) return;
if (!Array.isArray(stock)) return;
if (!member?.roles?.cache?.has(roleId)) return;

SAFE REPLY:

await interaction.editReply({ ... }).catch(() => {});

IF REPLY STATE UNKNOWN:

if (interaction.replied || interaction.deferred) {
  await interaction.followUp(...).catch(() => {});
} else {
  await interaction.reply(...).catch(() => {});
}
*/

