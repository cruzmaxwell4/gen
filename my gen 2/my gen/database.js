const fs = require('fs');
const path = require('path');

// DATA_DIR lets you point storage at a persistent disk (e.g. a Railway Volume)
// so stock, cooldowns, subscriptions, tokens, invites & vouches survive restarts.
// Defaults to ./data next to this file when unset.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const stockDir = path.join(dataDir, 'stock');
if (!fs.existsSync(stockDir)) fs.mkdirSync(stockDir, { recursive: true });

function loadJson(file, def) {
  const p = path.join(dataDir, file);
  if (!fs.existsSync(p)) { fs.writeFileSync(p, JSON.stringify(def, null, 2)); return def; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return def; }
}

function saveJson(file, data) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2));
}

const STORES = {
  config:      () => loadJson('config.json', {}),
  dropConfig:  () => loadJson('drop_config.json', {}),
  users:       () => loadJson('users.json', {}),
  vouches:     () => loadJson('vouches.json', []),
  inviteJoins: () => loadJson('invite_joins.json', []),
  invites:     () => loadJson('invites.json', {}),
};

function loadStock(table) {
  const p = path.join(dataDir, `${table}.json`);
  if (!fs.existsSync(p)) { fs.writeFileSync(p, '{}'); return {}; }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return {}; }
}

function saveStock(table, data) {
  fs.writeFileSync(path.join(dataDir, `${table}.json`), JSON.stringify(data, null, 2));
}

module.exports = {
  getConfig(key, def = null) {
    const cfg = STORES.config();
    return cfg[key] !== undefined ? cfg[key] : def;
  },
  setConfig(key, value) {
    const cfg = STORES.config();
    cfg[key] = value;
    saveJson('config.json', cfg);
  },

  getDropConfig(key, def = null) {
    const cfg = STORES.dropConfig();
    return cfg[key] !== undefined ? cfg[key] : def;
  },
  setDropConfig(key, value) {
    const cfg = STORES.dropConfig();
    cfg[key] = value;
    saveJson('drop_config.json', cfg);
  },

  getUser(id) {
    const users = STORES.users();
    if (!users[id]) {
      users[id] = { id, tokens: 0, subscription: 'none', sub_expires: 0, plus_time: 0, joins: 0, messages: 0, last_gen: 0, last_drop: 0 };
      saveJson('users.json', users);
    }
    return users[id];
  },
  updateUser(id, fields) {
    const users = STORES.users();
    if (!users[id]) users[id] = { id, tokens: 0, subscription: 'none', sub_expires: 0, plus_time: 0, joins: 0, messages: 0, last_gen: 0, last_drop: 0 };
    Object.assign(users[id], fields);
    saveJson('users.json', users);
  },
  incrementUserField(id, field, by = 1) {
    const users = STORES.users();
    if (!users[id]) users[id] = { id, tokens: 0, subscription: 'none', sub_expires: 0, plus_time: 0, joins: 0, messages: 0, last_gen: 0, last_drop: 0 };
    users[id][field] = (users[id][field] || 0) + by;
    saveJson('users.json', users);
  },

  allCategories() {
    const stock = loadStock('stock');
    return Object.keys(stock).filter(k => stock[k] && stock[k].length > 0);
  },
  stockCount(category) {
    const stock = loadStock('stock');
    return (stock[category] || []).length;
  },
  addStockBulk(category, lines, table = 'stock') {
    const stock = loadStock(table);
    if (!stock[category]) stock[category] = [];
    stock[category].push(...lines);
    saveStock(table, stock);
    return lines.length;
  },
  popStock(category) {
    const stock = loadStock('stock');
    if (!stock[category] || stock[category].length === 0) return null;
    const item = stock[category].shift();
    saveStock('stock', stock);
    return item;
  },
  restoreStock(category, item) {
    const stock = loadStock('stock');
    if (!stock[category]) stock[category] = [];
    stock[category].unshift(item); // put it back at the front so it's next out
    saveStock('stock', stock);
  },
  clearStock(category) {
    const stock = loadStock('stock');
    if (category) {
      const count = (stock[category] || []).length;
      stock[category] = [];
      saveStock('stock', stock);
      return count;
    }
    const count = Object.values(stock).reduce((s, a) => s + a.length, 0);
    saveStock('stock', {});
    return count;
  },

  dropCategories() {
    const stock = loadStock('drop_stock');
    return Object.keys(stock).filter(k => stock[k] && stock[k].length > 0);
  },
  dropStockCount(category) {
    const stock = loadStock('drop_stock');
    return (stock[category] || []).length;
  },
  popDropStock(category) {
    const stock = loadStock('drop_stock');
    if (!stock[category] || stock[category].length === 0) return null;
    const item = stock[category].shift();
    saveStock('drop_stock', stock);
    return item;
  },
  clearDropStock(category) {
    const stock = loadStock('drop_stock');
    if (category) {
      const count = (stock[category] || []).length;
      stock[category] = [];
      saveStock('drop_stock', stock);
      return count;
    }
    const count = Object.values(stock).reduce((s, a) => s + a.length, 0);
    saveStock('drop_stock', {});
    return count;
  },

  addVouch(userId, content, stars) {
    const vouches = STORES.vouches();
    const id = (vouches.length > 0 ? Math.max(...vouches.map(v => v.id)) : 0) + 1;
    vouches.unshift({ id, user_id: userId, content, stars, created_at: Math.floor(Date.now() / 1000) });
    saveJson('vouches.json', vouches);
    return id;
  },
  getVouches(limit = 10) {
    return STORES.vouches().slice(0, limit);
  },
  deleteVouch(id) {
    const vouches = STORES.vouches();
    const before = vouches.length;
    const filtered = vouches.filter(v => v.id !== id);
    saveJson('vouches.json', filtered);
    return before - filtered.length;
  },

  addInviteJoin(userId, inviterId, code) {
    const joins = STORES.inviteJoins();
    joins.push({ user_id: userId, inviter_id: inviterId, code, joined_at: Math.floor(Date.now() / 1000) });
    saveJson('invite_joins.json', joins);
  },
  getInviterJoins(userId) {
    return STORES.inviteJoins().filter(j => j.inviter_id === userId).length;
  },
  getInviterLeaderboard() {
    const joins = STORES.inviteJoins();
    const counts = {};
    for (const j of joins) counts[j.inviter_id] = (counts[j.inviter_id] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([inviter_id, count]) => ({ inviter_id, count }));
  },
  resetInviterJoins(userId) {
    const joins = STORES.inviteJoins().filter(j => j.inviter_id !== userId);
    saveJson('invite_joins.json', joins);
  },
  getJoinsByInviter(userId) {
    return STORES.inviteJoins().filter(j => j.inviter_id === userId);
  },

  saveInvite(code, inviterId, maxUses) {
    const invites = STORES.invites();
    invites[code] = { code, inviter_id: inviterId, uses: 0, max_uses: maxUses, created_at: Math.floor(Date.now() / 1000) };
    saveJson('invites.json', invites);
  },
  getInvitesByUser(userId) {
    const invites = STORES.invites();
    return Object.values(invites).filter(i => i.inviter_id === userId);
  },

  getAllUsers() {
    return Object.values(STORES.users());
  },

  // ---- Banner image stored on disk (survives restarts via DATA_DIR volume) ----
  saveBanner(buffer, ext) {
    for (const f of fs.readdirSync(dataDir)) {
      if (f.startsWith('banner.')) { try { fs.unlinkSync(path.join(dataDir, f)); } catch {} }
    }
    const safeExt = String(ext || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
    const filename = `banner.${safeExt}`;
    fs.writeFileSync(path.join(dataDir, filename), buffer);
    return filename;
  },
  getBannerFile() {
    try {
      const f = fs.readdirSync(dataDir).find(n => n.startsWith('banner.'));
      return f ? { name: f, path: path.join(dataDir, f) } : null;
    } catch { return null; }
  },
  clearBanner() {
    try {
      for (const f of fs.readdirSync(dataDir)) {
        if (f.startsWith('banner.')) fs.unlinkSync(path.join(dataDir, f));
      }
    } catch {}
  }
};
