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

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
  }
}

let inviteCache = new Map();
let dropInterval = null;

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    await registerCommands();
  } catch (err) {
    console.error('❌ Failed to register commands:', err);
  }

  applyPresence(client);

  for (const [, guild] of client.guilds.cache) {
    try {
      const invites = await guild.invites.fetch();
      inviteCache.set(guild.id, new Map(invites.map(i => [i.code, i.uses])));
    } catch {}
  }

  const dropActive = getDropConfig('active', 'false') === 'true';
  if (dropActive) startDrop(client);

  // Revoke expired subscriptions (and their roles) on boot and every 5 minutes
  sweepExpiredSubs(client).catch(() => {});
  setInterval(() => sweepExpiredSubs(client).catch(() => {}), 5 * 60 * 1000);
});

client.on('guildCreate', async (guild) => {
  const ownerServerId = process.env.OWNER_SERVER_ID;
  if (ownerServerId && guild.id !== ownerServerId) {
    try {
      await guild.leave();
      console.log(`Left unauthorized server: ${guild.name} (${guild.id})`);
    } catch (err) {
      console.error(`Error leaving server ${guild.name}:`, err);
    }
  }
});

// The bot's "Playing ..." profile status. Text/type are saved via /setstatus and
// re-applied on every boot so it survives restarts.
const ACTIVITY_TYPES = {
  playing: ActivityType.Playing,
  watching: ActivityType.Watching,
  listening: ActivityType.Listening,
  competing: ActivityType.Competing,
};
function applyPresence(client) {
  if (!client.user) return;
  const text = getConfig('status_text', 'Generator | /generate');
  const typeKey = (getConfig('status_type', 'playing') || 'playing').toLowerCase();
  const type = ACTIVITY_TYPES[typeKey] ?? ActivityType.Playing;
  try {
    client.user.setPresence({ activities: [{ name: text, type }], status: 'online' });
  } catch {}
}
client.applyPresence = applyPresence;

const SUB_ROLE_KEYS = { free: 'role_free', 'free+': 'role_freeplus', premium: 'role_premium' };

async function sweepExpiredSubs(client) {
  const now = Math.floor(Date.now() / 1000);
  let users;
  try { users = getAllUsers(); } catch { return; }
  for (const u of users) {
    if (!u || !u.subscription || u.subscription === 'none') continue;
    if (!u.sub_expires || u.sub_expires === 0) continue; // permanent — never expires
    if (u.sub_expires > now) continue;                   // still active
    const roleId = getConfig(SUB_ROLE_KEYS[u.subscription]);
    updateUser(u.id, { subscription: 'none', sub_expires: 0 });
    if (!roleId) continue;
    for (const [, guild] of client.guilds.cache) {
      const member = await guild.members.fetch(u.id).catch(() => null);
      if (member && member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
      }
    }
  }
}

client.on('guildMemberAdd', async (member) => {
  try {
    const newInvites = await member.guild.invites.fetch();
    const cachedInvites = inviteCache.get(member.guild.id) || new Map();

    let usedInvite = null;
    for (const [code, invite] of newInvites) {
      const cached = cachedInvites.get(code) || 0;
      if (invite.uses > cached) { usedInvite = invite; break; }
    }

    inviteCache.set(member.guild.id, new Map(newInvites.map(i => [i.code, i.uses])));

    if (usedInvite && usedInvite.inviter) {
      addInviteJoin(member.id, usedInvite.inviter.id, usedInvite.code);
    }
  } catch {}
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  try { incrementUserField(msg.author.id, 'messages'); } catch {}
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command?.autocomplete) {
      try { await command.autocomplete(interaction); } catch {}
    }
    return;
  }

  if (interaction.isButton()) {
    const id = interaction.customId;
    if (id === 'copy_creds') {
      const embed = interaction.message.embeds[0];
      let creds = '';
      if (embed && embed.fields) {
        const field = embed.fields.find(f => f.name.includes('Login Credentials'));
        if (field) creds = field.value.replace(/`/g, '').trim();
      }
      if (!creds) {
        return interaction.reply({ content: '❌ Could not find the credentials on this message.', ephemeral: true }).catch(() => {});
      }
      return interaction.reply({ content: `📋 **Tap and hold (or triple-click) to copy:**\n\`\`\`${creds}\`\`\``, ephemeral: true }).catch(() => {});
    }
    if (id === 'how_to_link') {
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
        .setFooter({ text: 'Generator' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    const reply = { content: '❌ An error occurred running that command.', ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply).catch(() => {});
    } else {
      await interaction.reply(reply).catch(() => {});
    }
  }
});

function startDrop(client) {
  if (dropInterval) clearInterval(dropInterval);

  const cooldownMs = parseInt(getDropConfig('cooldown', '300')) * 1000;

  dropInterval = setInterval(async () => {
    try {
      const guildId = getDropConfig('guild_id');
      const channelId = getDropConfig('channel_id');
      if (!guildId || !channelId) return;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;
      const channel = guild.channels.cache.get(channelId);
      if (!channel) return;

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

      const { EmbedBuilder } = require('discord.js');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎁 Account Drop!')
        .setDescription(`A free **${cat}** account has been dropped!\nReact with 🎁 to claim it — first come first served!`)
        .addFields(
          { name: 'Category', value: cat, inline: true },
          { name: 'Stock Remaining', value: String(dropStockCount(cat)), inline: true }
        )
        .setFooter({ text: 'Generator • React to claim!' })
        .setTimestamp();

      const msg = await channel.send({ embeds: [embed] });
      await msg.react('🎁').catch(() => {});

      const collector = msg.createReactionCollector({ filter: (r, u) => r.emoji.name === '🎁' && !u.bot, max: 1, time: 30000 });

      collector.on('collect', async (reaction, user) => {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`✅ Drop Claimed — ${cat}`)
          .setDescription('You were first! Here are your credentials:')
          .addFields({ name: '🔑 Login Credentials', value: `\`\`\`${account}\`\`\`` })
          .setFooter({ text: 'Generator • Keep these safe!' })
          .setTimestamp();

        try {
          await user.send({ embeds: [dmEmbed] });
          const claimEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setDescription(`✅ <@${user.id}> claimed the drop! Credentials sent to DMs.`)
            .setTimestamp();
          await channel.send({ embeds: [claimEmbed] });
        } catch {
          await channel.send(`⚠️ <@${user.id}> couldn't receive DMs. Enable DMs to claim drops.`);
        }
      });
    } catch (err) {
      console.error('Drop error:', err);
    }
  }, cooldownMs);
}

client.startDrop = startDrop;
client.stopDrop = () => { if (dropInterval) { clearInterval(dropInterval); dropInterval = null; } };
client.isDropActive = () => dropInterval !== null;

// Keep the process alive through unexpected errors. If the bot crashes it goes
// offline and Discord shows "did not respond"; staying up means /generate always
// reaches deferReply() and shows the "thinking..." state instead.
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught exception:', err);
});

client.login(process.env.BOT_TOKEN);
