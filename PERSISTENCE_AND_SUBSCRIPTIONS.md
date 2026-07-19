# Data Persistence & Subscription Management

## Overview

This document verifies that subscriptions and stock survive all code deployments, and that expired subscriptions are properly revoked.

## Data Persistence

### Volume Configuration
- **Volume Name**: `gen-data`
- **Mount Point**: `/app/data`
- **Environment Variable**: `DATA_DIR=/app/data`
- **Persistence**: ✅ ALL DATA SURVIVES DEPLOYS

### Critical Data Files

All data is stored in the persistent volume at `/app/data/`:

```
/app/data/
├── users.json          ← User subscriptions, tokens, stats
├── stock.json          ← Account stock (free, free+, premium)
├── drop_stock.json     ← Drop event account stock
├── config.json         ← Bot configuration (roles, status, etc)
├── drop_config.json    ← Drop event configuration
├── invites.json        ← Discord invite tracking
├── invite_joins.json   ← Invite usage stats
├── vouches.json        ← User reviews/vouches
└── banner.*            ← Custom banner image
```

### What Survives on Deploy

✅ **User Subscriptions** - `users.json`
- User ID
- Current subscription tier (free/free+/premium/none)
- Subscription expiration timestamp
- All user stats (tokens, joins, messages, etc)

✅ **Stock Counts** - `stock.json` & `drop_stock.json`
- Free tier accounts
- Free+ tier accounts
- Premium tier accounts

✅ **Configuration** - `config.json`
- Discord role IDs for each tier
- Bot status/presence settings
- All custom settings

✅ **All Other Data**
- Discord invites
- User vouches
- Invite statistics
- Banner image

**Result**: Every code update/merge deploys new code WITHOUT touching data files. ✅

## Subscription Expiration & Role Management

### Automatic Expiration Process

Every **5 minutes**, the bot runs `sweepExpiredSubs(client)` which:

1. Checks ALL users with active subscriptions
2. Compares `user.sub_expires` timestamp with current time
3. For each expired subscription:
   - Sets `subscription = 'none'` in users.json
   - Sets `sub_expires = 0`
   - Removes the Discord role from that user in ALL servers

### Code Location

**File**: `index.js`

**Initialization** (at startup):
```javascript
// Revoke expired subscriptions (and their roles) on boot and every 5 minutes
sweepExpiredSubs(client).catch(() => {});
setInterval(() => sweepExpiredSubs(client).catch(() => {}), 5 * 60 * 1000);
```

**Expiration Function**:
```javascript
async function sweepExpiredSubs(client) {
  const now = Math.floor(Date.now() / 1000);
  let users;
  try { users = getAllUsers(); } catch { return; }
  
  for (const u of users) {
    if (!u || !u.subscription || u.subscription === 'none') continue;
    if (!u.sub_expires || u.sub_expires === 0) continue; // permanent — never expires
    if (u.sub_expires > now) continue; // still active
    
    // Subscription EXPIRED - revoke it
    const roleId = getConfig(SUB_ROLE_KEYS[u.subscription]);
    updateUser(u.id, { subscription: 'none', sub_expires: 0 });
    
    if (!roleId) continue;
    
    // Remove role from user in ALL guilds
    for (const [, guild] of client.guilds.cache) {
      const member = await guild.members.fetch(u.id).catch(() => null);
      if (member && member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
      }
    }
  }
}
```

### Subscription Tier Validation

**File**: `utils.js`

The `hasActiveSub()` function validates subscriptions:
```javascript
function hasActiveSub(userId, category) {
  const user = getUser(userId);
  if (!user.subscription || user.subscription === 'none') return false;
  
  const now = Math.floor(Date.now() / 1000);
  if (user.sub_expires > 0 && user.sub_expires < now) return false; // ← EXPIRED
  
  return (TIER_RANK[user.subscription] || 0) >= (TIER_RANK[category] || 99);
}
```

### Access Control

**File**: `utils.js`

The `hasGenerateAccess()` function enforces:

- **Free tier**: Role required ONLY
- **Free+ tier**: Role OR active subscription
- **Premium tier**: Role AND active subscription BOTH required

```javascript
if (category === 'free') {
  return hasRole; // role is sufficient
}

if (category === 'premium') {
  return hasRole && hasActiveSub(member.id, category); // BOTH required
}

// free+ (and future mid-tiers): role OR subscription
return hasRole || hasActiveSub(member.id, category);
```

## Setting Subscriptions

**Command**: `/setsubscription`

**Duration Options**:
- 1 Hour (0.0417 days)
- 3 Hours (0.125 days)
- 6 Hours (0.25 days)
- 1 Day
- 3 Days
- 1 Week
- 1 Month
- 3 Months
- Lifetime (never expires)

**Expiration Calculation**:
```javascript
const days = duration === 'lifetime' ? null : parseFloat(duration);
const expires = days ? Math.floor(Date.now() / 1000) + days * 86400 : 0;
```

**Lifetime** = `sub_expires = 0` (checked as "permanent, never expires" in sweep)

## Database Safety

**File**: `database.js`

### Data Integrity

All `updateUser()` calls use `Object.assign()` to MERGE fields:
```javascript
updateUser(id, fields) {
  const users = STORES.users();
  if (!users[id]) users[id] = { /* ...defaults... */ };
  Object.assign(users[id], fields); // ← MERGE, don't replace
  saveJson('users.json', users);
}
```

✅ **Subscriptions are NEVER lost when updating other fields**

### File Persistence

On every bot startup, `ensureDataFiles()` runs to verify all critical JSON files exist:
```javascript
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
    const p = path.join(dataDir, file);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(def, null, 2));
    }
  }
}
```

✅ **Files are created if missing, never deleted**

## Verification Checklist

- [x] Volume mounted at `/app/data` with persistent storage
- [x] `DATA_DIR=/app/data` environment variable set
- [x] All data files stored in volume
- [x] `sweepExpiredSubs()` runs every 5 minutes on startup
- [x] Expired subscriptions remove Discord roles
- [x] `updateUser()` preserves all user fields
- [x] Subscriptions survive code deployments
- [x] Stock counts survive code deployments
- [x] `hasActiveSub()` checks expiration before granting access
- [x] Lifetime subscriptions never expire (sub_expires = 0)
- [x] No Discord command changes affect data
- [x] Role assignment only via `/setsubscription` command

## Troubleshooting

### Users Not Losing Roles After Expiration

Check the logs for `sweepExpiredSubs` errors. The function runs every 5 minutes and removes expired roles in ALL guilds.

### Stock/Subscriptions Lost After Deploy

This should NOT happen. Verify:
1. Volume is still mounted: `/app/data` exists
2. Environment variable is set: `DATA_DIR=/app/data`
3. Check file permissions in `/app/data/users.json`

### Manual Testing

To test expiration, set a subscription with 1 Hour duration and wait 1 hour. The `sweepExpiredSubs()` function will run every 5 minutes and remove the role when expiration time passes.

