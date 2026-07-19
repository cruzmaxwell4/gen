/**
 * Safety utilities for bulletproof error handling across all commands
 */

// Safe string conversion
function safeString(value, maxLength = 2000) {
  try {
    let str = String(value || '');
    if (maxLength && str.length > maxLength) {
      str = str.slice(0, maxLength - 3) + '...';
    }
    return str;
  } catch {
    return '';
  }
}

// Safe number conversion
function safeNumber(value, fallback = 0) {
  try {
    const num = Number(value);
    return isNaN(num) ? fallback : num;
  } catch {
    return fallback;
  }
}

// Safe array conversion
function safeArray(value) {
  try {
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// Safe object access
function safeGet(obj, path, fallback = null) {
  try {
    const keys = String(path).split('.');
    let current = obj;
    for (const key of keys) {
      current = current?.[key];
    }
    return current !== undefined ? current : fallback;
  } catch {
    return fallback;
  }
}

// Safe Discord ID validation
function isValidDiscordId(id) {
  try {
    return /^\d{17,19}$/.test(String(id));
  } catch {
    return false;
  }
}

// Safe interaction reply (never crashes, always responds)
async function safeReply(interaction, content) {
  try {
    if (!interaction) return;
    const reply = { content, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  } catch (err) {
    console.error('⚠️ Failed to send reply:', err?.message || err);
  }
}

// Safe embed reply
async function safeEmbedReply(interaction, embed) {
  try {
    if (!interaction || !embed) return;
    const reply = { embeds: [embed], ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  } catch (err) {
    console.error('⚠️ Failed to send embed reply:', err?.message || err);
  }
}

// Safe defer reply
async function safeDefer(interaction, ephemeral = true) {
  try {
    if (!interaction) return false;
    if (!interaction.deferred) {
      await interaction.deferReply({ ephemeral }).catch(() => {});
    }
    return true;
  } catch (err) {
    console.error('⚠️ Failed to defer:', err?.message || err);
    return false;
  }
}

// Safe message edit
async function safeEditReply(interaction, content) {
  try {
    if (!interaction) return;
    if (interaction.replied || interaction.deferred) {
      await interaction.editReply(content).catch(() => {});
    } else {
      await interaction.reply(content).catch(() => {});
    }
  } catch (err) {
    console.error('⚠️ Failed to edit reply:', err?.message || err);
  }
}

// Safe command option getting
function getSafeOption(interaction, name, type = 'string') {
  try {
    if (!interaction?.options) return null;
    switch (type) {
      case 'string':
        return interaction.options.getString?.(name) || null;
      case 'number':
        return interaction.options.getNumber?.(name) || null;
      case 'integer':
        return interaction.options.getInteger?.(name) || null;
      case 'boolean':
        return interaction.options.getBoolean?.(name) ?? false;
      case 'user':
        return interaction.options.getUser?.(name) || null;
      case 'member':
        return interaction.options.getMember?.(name) || null;
      case 'channel':
        return interaction.options.getChannel?.(name) || null;
      case 'role':
        return interaction.options.getRole?.(name) || null;
      default:
        return null;
    }
  } catch (err) {
    console.error(`⚠️ Error getting option ${name}:`, err?.message || err);
    return null;
  }
}

module.exports = {
  safeString,
  safeNumber,
  safeArray,
  safeGet,
  isValidDiscordId,
  safeReply,
  safeEmbedReply,
  safeDefer,
  safeEditReply,
  getSafeOption
};

