require('dotenv').config();
const { Client, GatewayIntentBits, Collection, Partials, EmbedBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { registerCommands } = require('./deploy-commands');
const {
  getDropConfig, setDropConfig, popDropStock, dropCategories, dropStockCount,
  addInviteJoin, saveInvite, incrementUserField,
  getAllUsers, getConfig, updateUser
} = require('./database');

// Validate environment variables on startup
const requiredEnvVars = ['BOT_TOKEN', 'OWNER_ID', 'CLIENT_ID'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.commands = new Collection();

// Safe command loading with error handling
const commandsPath = path.join(__dirname, 'commands');
try {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
  for (const file of commandFiles) {
    try {
      const cmd = require(path.join(commandsPath, file));
      if (cmd && cmd.data && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
      }
    } catch (err) {
      console.error(`⚠️ Failed to load command ${file}:`, err?.message || err);
    }
  }
  console.log(`✅ Loaded ${client.commands.size} commands`);
} catch (err) {
  console.error('❌ Failed to read commands directory:', err?.message || err);
  process.exit(1);
}

let inviteCache = new Map();
let dropInterval = null;

client.once('clientReady', async () => {
  try {
    console.log(`✅ Logged in as ${client.user?.tag || 'unknown'}`);

    try {
      await registerCommands();
    } catch (err) {
      console.error('⚠️ Failed to register commands:', err?.message || err);
    }

    applyPresence(client);

    try {
      for (const [, guild] of client.guilds.cache) {
        try {
          const invites = await guild.invites.fetch().catch(() => null);
          if (invites) {
            inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
          }
        } catch (err) {
          // Silent fail
        }
      }
    } catch (err) {
      console.error('⚠️ Error caching invites:', err?.message || err);
    }

    try {
      const dropActive = getDropConfig('active', 'false') === 'true';
      if (dropActive) startDrop(client);
    } catch (err) {
      console.error('⚠️ Error checking drop config:', err?.message || err);
    }

    try {
      await sweepExpiredSubs(client);
      setInterval(() => sweepExpiredSubs(client).catch(err => {
        console.error('⚠️ Subscription sweep error:', err?.message || err);
      }), 5 * 60 * 1000);
    } catch (err) {
      console.error('⚠️ Failed to initialize subscription sweep:', err?.message || err);
    }
  } catch (err) {
    console.error('❌ Critical error in ready event:', err?.message || err);
  }
});

client.on('guildCreate', async (guild) => {
  try {
    const ownerServerId = process.env.OWNER_SERVER_ID;
    if (ownerServerId && guild?.id !== ownerServerId) {
      try {
        await guild.leave().catch(err => {
          console.error(`⚠️ Failed to leave unauthorized server ${guild?.name}:`, err?.message || err);
        });
        console.log(`Left unauthorized server: ${guild?.name} (${guild?.id})`);
      } catch (err) {
        console.error(`Error leaving server:`, err?.message || err);
      }
    }
  } catch (err) {
    console.error('Error in guildCreate:', err?.message || err);
  }
});

const ACTIVITY_TYPES = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing,
};

function applyPresence(client) {
  try {
    if (!client?.user) return;
    const text = String(getConfig('status_text', 'Code & Claim Bot') || 'Code & Claim Bot').slice(0, 128);
    const typeKey = String(getConfig('status_type', 'playing') || 'playing').toLowerCase();
    const type = ACTIVITY_TYPES[typeKey] ?? ActivityType.Playing;
    try {
      client.user.setPresence({ activities: [{ name: text, type }], status: 'online' });
    } catch (err) {
      console.error('⚠️ Failed to set presence:', err?.message || err);
    }
  } catch (err) {
    console.error('Error setting presence:', err?.message || err);
  }
}

client.applyPresence = applyPresence;

const SUB_ROLE_KEYS = { free: 'role_free', 'free+': 'role_freeplus', premium: 'role_premium' };

async function sweepExpiredSubs(client) {
  try {
    const now = Math.floor(Date.now() / 1000);
    let users;
    try {
      users = getAllUsers();
    } catch (err) {
      console.error('⚠️ Failed to get users for subscription sweep:', err?.message || err);
      return;
    }

    if (!Array.isArray(users)) return;

    for (const u of users) {
      try {
        if (!u?.id || !u?.subscription || u.subscription === 'none') continue;
        if (!u.sub_expires || u.sub_expires === 0) continue;
        if (u.sub_expires > now) continue;

        const roleId = getConfig(SUB_ROLE_KEYS[u.subscription]);
        updateUser(u.id, { subscription: 'none', sub_expires: 0 });

        if (!roleId) continue;

        for (const [, guild] of client.guilds.cache) {
          try {
            const member = await guild.members.fetch(u.id).catch(() => null);
            if (member?.roles?.cache?.has(roleId)) {
              await member.roles.remove(roleId).catch(err => {
                console.error(`⚠️ Failed to remove role from user ${u.id}:`, err?.message || err);
              });
            }
          } catch (err) {
            // Silent fail
          }
        }
      } catch (err) {
        console.error(`⚠️ Error processing user ${u?.id}:`, err?.message || err);
      }
    }
  } catch (err) {
    console.error('❌ Subscription sweep error:', err?.message || err);
  }
}

client.on('guildMemberAdd', async (member) => {
  try {
    if (!member?.guild) return;

    const newInvites = await member.guild.invites.fetch().catch(() => null);
    if (!newInvites) return;

    const cachedInvites = inviteCache.get(member.guild.id) || new Map();

    let usedInvite = null;
    for (const [code, invite] of newInvites) {
      const cached = cachedInvites.get(code) || 0;
      if (invite?.uses > cached) {
        usedInvite = invite;
        break;
      }
    }

    inviteCache.set(member.guild.id, new Map(newInvites.map(i => [i.code, i.uses])));

    if (usedInvite?.inviter?.id && member?.id) {
      try {
        addInviteJoin(member.id, usedInvite.inviter.id, usedInvite.code);
      } catch (err) {
        console.error('⚠️ Failed to log invite join:', err?.message || err);
      }
    }
  } catch (err) {
    console.error('⚠️ Error in guildMemberAdd:', err?.message || err);
  }
});

client.on('messageCreate', async (msg) => {
  try {
    if (msg?.author?.bot || !msg?.guild) return;
    incrementUserField(msg.author.id, 'messages');
  } catch (err) {
    // Silent fail
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction) return;

    if (interaction.isAutocomplete?.()) {
      try {
        const command = client.commands.get(interaction.commandName);
        if (command?.autocomplete) {
          await command.autocomplete(interaction).catch(err => {
            console.error(`⚠️ Autocomplete error for ${interaction.commandName}:`, err?.message || err);
          });
        }
      } catch (err) {
        console.error('⚠️ Autocomplete handler error:', err?.message || err);
      }
      return;
    }

    if (interaction.isButton?.()) {
      try {
        const id = interaction.customId;
        if (id === 'copy_creds') {
          const embed = interaction.message?.embeds?.[0];
          let creds = '';
          if (embed?.fields) {
            const field = embed.fields.find(f => f?.name?.includes('Login Credentials'));
            if (field?.value) creds = String(field.value).replace(/`/g, '').trim();
          }
          if (!creds) {
            await interaction.reply({ content: '❌ Could not find the credentials on this message.', ephemeral: true }).catch(() => {});
            return;
          }
          await interaction.reply({ content: `📋 **Tap and hold (or triple-click) to copy:**\n\`\`\`${creds}\`\`\``, ephemeral: true }).catch(() => {});
        } else if (id === 'claim_code_btn') {
          try {
            const { handleClaimCodeButton } = require('./commands/claimcodepanel');
            await handleClaimCodeButton(interaction, client);
          } catch (err) {
            console.error('⚠️ Error in premium claim button:', err?.message || err);
          }
        } else if (id === 'claim_code_btn_free') {
          try {
            const { handleClaimCodeButtonFree } = require('./commands/claimpanelfree');
            await handleClaimCodeButtonFree(interaction, client);
          } catch (err) {
            console.error('⚠️ Error in free claim button:', err?.message || err);
          }
        } else if (id === 'how_to_link') {
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('❓ How to Link Your Account')
            .setDescription([
              '**1.** Open the platform login page (Ubisoft Connect / console store).',
              '**2.** Sign in with the **email** and **password** above.',
              '**3.** Complete any 2FA prompts — check the account notes for 2FA status.',
              '**4.** Tap **Copy Skin Link** to preview the account inventory.',
              '',
              '⚠️ Only change the password if the account notes confirm it is safe.'
            ].join('\n'))
            .setFooter({ text: 'Code & Claim' })
            .setTimestamp();
          await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }
      } catch (err) {
        console.error('⚠️ Button handler error:', err?.message || err);
      }
      return;
    }

    if (interaction.isModalSubmit?.()) {
      try {
        const customId = interaction.customId;
        if (customId === 'claim_code_modal') {
          try {
            const { handleClaimCodeModal } = require('./commands/claimcodepanel');
            await handleClaimCodeModal(interaction, client);
          } catch (err) {
            console.error('⚠️ Error in premium claim modal:', err?.message || err);
          }
          return;
        } else if (customId === 'claim_code_modal_free') {
          try {
            const { handleClaimCodeModalFree } = require('./commands/claimpanelfree');
            await handleClaimCodeModalFree(interaction, client);
          } catch (err) {
            console.error('⚠️ Error in free claim modal:', err?.message || err);
          }
          return;
        }
      } catch (err) {
        console.error('⚠️ Modal handler error:', err?.message || err);
      }
      return;
    }

    if (!interaction.isChatInputCommand?.()) return;

    try {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.warn(`⚠️ Unknown command: ${interaction.commandName}`);
        return;
      }

      await command.execute(interaction, client);
    } catch (err) {
      console.error(`Error in /${interaction.commandName}:`, err?.message || err);
      const reply = { content: '❌ An error occurred running that command.', ephemeral: true };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      } catch (err) {
        console.error('Failed to send error reply:', err?.message || err);
      }
    }
  } catch (err) {
    console.error('❌ Critical error in interactionCreate:', err?.message || err);
  }
});

function startDrop(client) {
  try {
    if (dropInterval) clearInterval(dropInterval);

    const cooldownStr = getDropConfig('cooldown', '300');
    const cooldownMs = (parseInt(cooldownStr) || 300) * 1000;

    dropInterval = setInterval(async () => {
      try {
        const guildId = getDropConfig('guild_id');
        const channelId = getDropConfig('channel_id');
        if (!guildId || !channelId) return;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        const channel = guild.channels.cache.get(channelId);
        if (!channel?.isTextBased?.()) return;

        const cats = dropCategories();
        if (cats.length === 0) {
          setDropConfig('active', 'false');
          clearInterval(dropInterval);
          dropInterval = null;
          channel.send('⚠️ Drop stopped — no more drop stock available.').catch(() => {});
          return;
        }

        const cat = cats[Math.floor(Math.random() * cats.length)];
        const account = popDropStock(cat);
        if (!account) return;

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('🎁 Account Drop!')
          .setDescription(`A free **${cat}** account has been dropped!\nReact with 🎁 to claim it — first come first served!`)
          .addFields(
            { name: 'Category', value: String(cat), inline: true },
            { name: 'Stock Remaining', value: String(dropStockCount(cat)), inline: true }
          )
          .setFooter({ text: 'Code & Claim • React to claim!' })
          .setTimestamp();

        const msg = await channel.send({ embeds: [embed] }).catch(err => {
          console.error('⚠️ Failed to send drop embed:', err?.message || err);
          return null;
        });

        if (!msg) return;

        await msg.react('🎁').catch(() => {});

        const collector = msg.createReactionCollector({
          filter: (r, u) => r?.emoji?.name === '🎁' && !u.bot,
          max: 1,
          time: 30000
        });

        collector.on('collect', async (reaction, user) => {
          try {
            const dmEmbed = new EmbedBuilder()
              .setColor(0x57F287)
              .setTitle(`✅ Drop Claimed — ${cat}`)
              .setDescription('You were first! Here are your credentials:')
              .addFields({ name: '🔑 Login Credentials', value: `\`\`\`${account}\`\`\`` })
              .setFooter({ text: 'Code & Claim • Keep these safe!' })
              .setTimestamp();

            try {
              await user.send({ embeds: [dmEmbed] });
              const claimEmbed = new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription(`✅ <@${user.id}> claimed the drop! Credentials sent to DMs.`)
                .setTimestamp();
              await channel.send({ embeds: [claimEmbed] }).catch(() => {});
            } catch (err) {
              await channel.send(`⚠️ <@${user.id}> couldn't receive DMs. Enable DMs to claim drops.`).catch(() => {});
            }
          } catch (err) {
            console.error('⚠️ Error processing drop claim:', err?.message || err);
          }
        });
      } catch (err) {
        console.error('⚠️ Drop interval error:', err?.message || err);
      }
    }, cooldownMs);
  } catch (err) {
    console.error('❌ Failed to start drop system:', err?.message || err);
  }
}

client.startDrop = startDrop;
client.stopDrop = () => {
  try {
    if (dropInterval) {
      clearInterval(dropInterval);
      dropInterval = null;
    }
  } catch (err) {
    console.error('⚠️ Error stopping drop:', err?.message || err);
  }
};
client.isDropActive = () => dropInterval !== null;

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled promise rejection:', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught exception:', err?.message || err);
});

client.login(process.env.BOT_TOKEN).catch(err => {
  console.error('❌ FATAL: Failed to login:', err?.message || err);
  process.exit(1);
});

