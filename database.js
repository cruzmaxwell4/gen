const fs = require('fs');
const path = require('path');

// DATA_DIR lets you point storage at a persistent disk (e.g. a Railway Volume)
// so stock, cooldowns, subscriptions, tokens, invites & vouches survive restarts.
// Defaults to ./data next to this file when unset.
const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');

// Ensure data directory exists
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.error(`❌ FATAL: Cannot create data directory at ${dataDir}:`, err?.message || err);
  process.exit(1);
}

const stockDir = path.join(dataDir, 'stock');
try {
  if (!fs.existsSync(stockDir)) {
    fs.mkdirSync(stockDir, { recursive: true });
  }
} catch (err) {
  console.error(`⚠️ Warning: Cannot create stock directory:`, err?.message || err);
}

// Ensure critical data files exist with proper defaults on startup
function ensureDataFiles() {
  const criticalFiles = {
    'config.json': {},
    'drop_config.json': {},
    'users.json': {},
    'vouches.json': [],
    'invite_joins.json': [],
    'invites.json': {},
    'stock.json': {},
    'drop_stock.json': {}
  };

  for (const [file, def] of Object.entries(criticalFiles)) {
    try {
      const p = path.join(dataDir, file);
      if (!fs.existsSync(p)) {
        fs.writeFileSync(p, JSON.stringify(def, null, 2));
      }
    } catch (err) {
      console.error(`⚠️ Warning: Cannot ensure ${file} exists:`, err?.message || err);
    }
  }
}

ensureDataFiles();

function loadJson(file, def) {
  try {
    const p = path.join(dataDir, file);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(def, null, 2));
      return def;
    }
    const content = fs.readFileSync(p, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`⚠️ Error loading ${file}:`, err?.message || err);
    return def;
  }
}

function saveJson(file, data) {
  try {
    const p = path.join(dataDir, file);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`⚠️ Error saving ${file}:`, err?.message || err);
  }
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
  try {
    const p = path.join(dataDir, `${table}.json`);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, '{}');
      return {};
    }
    const content = fs.readFileSync(p, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`⚠️ Error loading ${table} stock:`, err?.message || err);
    return {};
  }
}

function saveStock(table, data) {
  try {
    const p = path.join(dataDir, `${table}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`⚠️ Error saving ${table} stock:`, err?.message || err);
  }
}

module.exports = {
  getConfig(key, def = null) {
    try {
      const cfg = STORES.config();
      return cfg[key] !== undefined ? cfg[key] : def;
    } catch (err) {
      console.error(`⚠️ Error getting config ${key}:`, err?.message || err);
      return def;
    }
  },
  
  setConfig(key, value) {
    try {
      const cfg = STORES.config();
      cfg[key] = value;
      saveJson('config.json', cfg);
    } catch (err) {
      console.error(`⚠️ Error setting config ${key}:`, err?.message || err);
    }
  },

  getDropConfig(key, def = null) {
    try {
      const cfg = STORES.dropConfig();
      return cfg[key] !== undefined ? cfg[key] : def;
    } catch (err) {
      console.error(`⚠️ Error getting dropConfig ${key}:`, err?.message || err);
      return def;
    }
  },
  
  setDropConfig(key, value) {
    try {
      const cfg = STORES.dropConfig();
      cfg[key] = value;
      saveJson('drop_config.json', cfg);
    } catch (err) {
      console.error(`⚠️ Error setting dropConfig ${key}:`, err?.message || err);
    }
  },

  getUser(id) {
    try {
      if (!id) return null;
      const users = STORES.users();
      if (!users[id]) {
        users[id] = { id, tokens: 0, subscription: 'none', sub_expires: 0, plus_time: 0, joins: 0, messages: 0, last_gen: 0, last_drop: 0 };
        saveJson('users.json', users);
      }
      return users[id];
    } catch (err) {
      console.error(`⚠️ Error getting user ${id}:`, err?.message || err);
      return null;
    }
  },
  
  updateUser(id, fields) {
    try {
      if (!id) return;
      const users = STORES.users();
      if (!users[id]) {
        users[id] = { id, tokens: 0, subscription: 'none', sub_expires: 0, plus_time: 0, joins: 0, messages: 0, last_gen: 0, last_drop: 0 };
      }
      // IMPORTANT: Preserve existing fields, only update the ones specified
      Object.assign(users[id], fields);
      saveJson('users.json', users);
    } catch (err) {
      console.error(`⚠️ Error updating user ${id}:`, err?.message || err);
    }
  },
  
  incrementUserField(id, field, by = 1) {
    try {
      if (!id || !field) return;
      const users = STORES.users();
      if (!users[id]) {
        users[id] = { id, tokens: 0, subscription: 'none', sub_expires: 0, plus_time: 0, joins: 0, messages: 0, last_gen: 0, last_drop: 0 };
      }
      users[id][field] = (users[id][field] || 0) + (by || 1);
      saveJson('users.json', users);
    } catch (err) {
      console.error(`⚠️ Error incrementing ${field} for user ${id}:`, err?.message || err);
    }
  },

  allCategories() {
    try {
      const stock = loadStock('stock');
      return Object.keys(stock).filter(k => stock[k] && Array.isArray(stock[k]) && stock[k].length > 0);
    } catch (err) {
      console.error('⚠️ Error getting all categories:', err?.message || err);
      return [];
    }
  },
  
  stockCount(category) {
    try {
      if (!category) return 0;
      const stock = loadStock('stock');
      return Array.isArray(stock[category]) ? stock[category].length : 0;
    } catch (err) {
      console.error(`⚠️ Error getting stock count for ${category}:`, err?.message || err);
      return 0;
    }
  },
  
  addStockBulk(category, lines, table = 'stock') {
    try {
      if (!category || !Array.isArray(lines)) return 0;
      const stock = loadStock(table);
      if (!stock[category]) stock[category] = [];
      if (!Array.isArray(stock[category])) stock[category] = [];
      stock[category].push(...lines);
      saveStock(table, stock);
      return lines.length;
    } catch (err) {
      console.error(`⚠️ Error adding stock to ${category}:`, err?.message || err);
      return 0;
    }
  },
  
  popStock(category, table = 'stock') {
    try {
      if (!category) return null;
      const stock = loadStock(table);
      if (!Array.isArray(stock[category]) || stock[category].length === 0) return null;
      const item = stock[category].shift();
      saveStock(table, stock);
      return item;
    } catch (err) {
      console.error(`⚠️ Error popping stock for ${category}:`, err?.message || err);
      return null;
    }
  },
  
  restoreStock(category, item, table = 'stock') {
    try {
      if (!category || !item) return;
      const stock = loadStock(table);
      if (!stock[category]) stock[category] = [];
      if (!Array.isArray(stock[category])) stock[category] = [];
      stock[category].unshift(item);
      saveStock(table, stock);
    } catch (err) {
      console.error(`⚠️ Error restoring stock for ${category}:`, err?.message || err);
    }
  },
  
  clearStock(category, table = 'stock') {
    try {
      const stock = loadStock(table);
      if (category) {
        const count = Array.isArray(stock[category]) ? stock[category].length : 0;
        stock[category] = [];
        saveStock(table, stock);
        return count;
      }
      const count = Object.values(stock).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
      saveStock(table, {});
      return count;
    } catch (err) {
      console.error('⚠️ Error clearing stock:', err?.message || err);
      return 0;
    }
  },

  dropCategories() {
    try {
      const stock = loadStock('drop_stock');
      return Object.keys(stock).filter(k => stock[k] && Array.isArray(stock[k]) && stock[k].length > 0);
    } catch (err) {
      console.error('⚠️ Error getting drop categories:', err?.message || err);
      return [];
    }
  },
  
  dropStockCount(category) {
    try {
      if (!category) return 0;
      const stock = loadStock('drop_stock');
      return Array.isArray(stock[category]) ? stock[category].length : 0;
    } catch (err) {
      console.error(`⚠️ Error getting drop stock for ${category}:`, err?.message || err);
      return 0;
    }
  },
  
  popDropStock(category) {
    try {
      if (!category) return null;
      const stock = loadStock('drop_stock');
      if (!Array.isArray(stock[category]) || stock[category].length === 0) return null;
      const item = stock[category].shift();
      saveStock('drop_stock', stock);
      return item;
    } catch (err) {
      console.error(`⚠️ Error popping drop stock for ${category}:`, err?.message || err);
      return null;
    }
  },
  
  clearDropStock(category) {
    try {
      const stock = loadStock('drop_stock');
      if (category) {
        const count = Array.isArray(stock[category]) ? stock[category].length : 0;
        stock[category] = [];
        saveStock('drop_stock', stock);
        return count;
      }
      const count = Object.values(stock).reduce((s, a) => s + (Array.isArray(a) ? a.length : 0), 0);
      saveStock('drop_stock', {});
      return count;
    } catch (err) {
      console.error('⚠️ Error clearing drop stock:', err?.message || err);
      return 0;
    }
  },

  addVouch(userId, content, stars) {
    try {
      if (!userId || !content) return null;
      const vouches = STORES.vouches();
      if (!Array.isArray(vouches)) vouches = [];
      const id = (vouches.length > 0 ? Math.max(...vouches.map(v => v?.id || 0)) : 0) + 1;
      vouches.unshift({ id, user_id: userId, content, stars, created_at: Math.floor(Date.now() / 1000) });
      saveJson('vouches.json', vouches);
      return id;
    } catch (err) {
      console.error(`⚠️ Error adding vouch for user ${userId}:`, err?.message || err);
      return null;
    }
  },
  
  getVouches(limit = 10) {
    try {
      const vouches = STORES.vouches();
      return Array.isArray(vouches) ? vouches.slice(0, Math.max(0, limit)) : [];
    } catch (err) {
      console.error('⚠️ Error getting vouches:', err?.message || err);
      return [];
    }
  },
  
  deleteVouch(id) {
    try {
      if (!id) return 0;
      const vouches = STORES.vouches();
      if (!Array.isArray(vouches)) return 0;
      const before = vouches.length;
      const filtered = vouches.filter(v => v?.id !== id);
      saveJson('vouches.json', filtered);
      return before - filtered.length;
    } catch (err) {
      console.error(`⚠️ Error deleting vouch ${id}:`, err?.message || err);
      return 0;
    }
  },

  addInviteJoin(userId, inviterId, code) {
    try {
      if (!userId || !inviterId || !code) return;
      const joins = STORES.inviteJoins();
      if (!Array.isArray(joins)) joins = [];
      joins.push({ user_id: userId, inviter_id: inviterId, code, joined_at: Math.floor(Date.now() / 1000) });
      saveJson('invite_joins.json', joins);
    } catch (err) {
      console.error(`⚠️ Error adding invite join:`, err?.message || err);
    }
  },
  
  getInviterJoins(userId) {
    try {
      if (!userId) return 0;
      const joins = STORES.inviteJoins();
      if (!Array.isArray(joins)) return 0;
      return joins.filter(j => j?.inviter_id === userId).length;
    } catch (err) {
      console.error(`⚠️ Error getting inviter joins for ${userId}:`, err?.message || err);
      return 0;
    }
  },
  
  getInviterLeaderboard() {
    try {
      const joins = STORES.inviteJoins();
      if (!Array.isArray(joins)) return [];
      const counts = {};
      for (const j of joins) {
        if (j?.inviter_id) counts[j.inviter_id] = (counts[j.inviter_id] || 0) + 1;
      }
      return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([inviter_id, count]) => ({ inviter_id, count }));
    } catch (err) {
      console.error('⚠️ Error getting inviter leaderboard:', err?.message || err);
      return [];
    }
  },
  
  resetInviterJoins(userId) {
    try {
      if (!userId) return;
      const joins = STORES.inviteJoins();
      if (!Array.isArray(joins)) return;
      const filtered = joins.filter(j => j?.inviter_id !== userId);
      saveJson('invite_joins.json', filtered);
    } catch (err) {
      console.error(`⚠️ Error resetting inviter joins for ${userId}:`, err?.message || err);
    }
  },
  
  getJoinsByInviter(userId) {
    try {
      if (!userId) return [];
      const joins = STORES.inviteJoins();
      if (!Array.isArray(joins)) return [];
      return joins.filter(j => j?.inviter_id === userId);
    } catch (err) {
      console.error(`⚠️ Error getting joins by inviter ${userId}:`, err?.message || err);
      return [];
    }
  },

  saveInvite(code, inviterId, maxUses) {
    try {
      if (!code || !inviterId) return;
      const invites = STORES.invites();
      invites[code] = { code, inviter_id: inviterId, uses: 0, max_uses: maxUses, created_at: Math.floor(Date.now() / 1000) };
      saveJson('invites.json', invites);
    } catch (err) {
      console.error(`⚠️ Error saving invite ${code}:`, err?.message || err);
    }
  },
  
  getInvitesByUser(userId) {
    try {
      if (!userId) return [];
      const invites = STORES.invites();
      return Object.values(invites).filter(i => i?.inviter_id === userId);
    } catch (err) {
      console.error(`⚠️ Error getting invites for user ${userId}:`, err?.message || err);
      return [];
    }
  },

  getAllUsers() {
    try {
      const users = STORES.users();
      return Array.isArray(users) ? Object.values(users) : [];
    } catch (err) {
      console.error('⚠️ Error getting all users:', err?.message || err);
      return [];
    }
  },

  // ---- Banner image stored on disk (survives restarts via DATA_DIR volume) ----
  saveBanner(buffer, ext) {
    try {
      if (!buffer) return null;
      for (const f of fs.readdirSync(dataDir)) {
        if (f.startsWith('banner.')) {
          try {
            fs.unlinkSync(path.join(dataDir, f));
          } catch (err) {
            // Silent fail
          }
        }
      }
      const safeExt = String(ext || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
      const filename = `banner.${safeExt}`;
      fs.writeFileSync(path.join(dataDir, filename), buffer);
      return filename;
    } catch (err) {
      console.error('⚠️ Error saving banner:', err?.message || err);
      return null;
    }
  },
  
  getBannerFile() {
    try {
      const f = fs.readdirSync(dataDir).find(n => n.startsWith('banner.'));
      return f ? { name: f, path: path.join(dataDir, f) } : null;
    } catch (err) {
      console.error('⚠️ Error getting banner file:', err?.message || err);
      return null;
    }
  },
  
  clearBanner() {
    try {
      for (const f of fs.readdirSync(dataDir)) {
        if (f.startsWith('banner.')) {
          fs.unlinkSync(path.join(dataDir, f));
        }
      }
    } catch (err) {
      console.error('⚠️ Error clearing banner:', err?.message || err);
    }
  }
};

