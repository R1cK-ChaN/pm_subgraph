# Query Fixes Applied

## Issue Discovered

The Polymarket subgraph has an **inconsistent GraphQL schema naming convention**:

### Standard Entities (Works as Expected)
- `markets` - query multiple markets ✅
- `trades` - query multiple trades ✅
- `users` - query multiple users ✅
- `positions` - query multiple positions ✅

### Non-Standard Entities (Requires Special Syntax)
- ~~`dailyStats`~~ - **DOES NOT WORK** for collections ❌
- `dailyStats_collection` - query multiple daily stats ✅
- `dailyStats(id: "...")` - query single daily stat ✅

- ~~`globalStats`~~ - **DOES NOT WORK** for collections ❌
- `globalStats_collection` - query multiple global stats ✅
- `globalStats(id: "global")` - query singleton global stat ✅

## Root Cause

The Graph Protocol generates different query patterns based on entity naming:
- Entities with simple names → plural queries
- Entities with compound names ending in "Stats" → requires `_collection` suffix

## Fixes Applied

### 1. Updated `07-time-series-queries.graphql`
All queries now use `dailyStats_collection` instead of `dailyStats`

**Before:**
```graphql
query RecentDailyStats {
  dailyStats(first: 30, orderBy: dayTimestamp, orderDirection: desc) {
    id
    volume
  }
}
```

**After:**
```graphql
query RecentDailyStats {
  dailyStats_collection(first: 30, orderBy: dayTimestamp, orderDirection: desc) {
    id
    volume
  }
}
```

### 2. Updated `test-all.sh`
Changed test queries to use correct syntax

### 3. Updated `export-samples.ts`
Fixed `exportDailyStats()` function to use `dailyStats_collection`

## Correct Query Patterns

### Single Entity Queries (Require ID)
```graphql
# Global stats singleton
{ globalStats(id: "global") { totalMarkets totalTrades } }

# Specific daily stat
{ dailyStats(id: "1729728000") { volume tradeCount } }

# Specific position
{ position(id: "0x...") { balance } }
```

### Collection Queries
```graphql
# Markets (standard)
{ markets(first: 10) { id tradeCount } }

# Positions (standard)
{ positions(first: 10, where: {balance_gt: "0"}) { id balance } }

# Daily Stats (requires _collection suffix)
{ dailyStats_collection(first: 30, orderBy: dayTimestamp, orderDirection: desc) {
    id dayTimestamp volume
  }
}

# Global Stats collection (if needed)
{ globalStats_collection(first: 10) { totalMarkets } }
```

## Verification

After fixes, all queries should work:

```bash
# Test the fixes
./test-all.sh

# Export sample data
ts-node export-samples.ts

# Quick check
./quick-check.sh
```

## Future Schema Improvements

To avoid this confusion in future subgraph versions, consider:

1. **Option A**: Rename entities for consistency
   - `DailyStats` → `DailyStat` (singular)
   - `GlobalStats` → `GlobalStat` (singular)

2. **Option B**: Document the `_collection` requirement prominently

3. **Option C**: Use simpler entity names
   - `DailyStats` → `Daily`
   - `GlobalStats` → `Global`
