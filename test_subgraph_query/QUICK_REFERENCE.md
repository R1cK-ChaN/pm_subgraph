# Quick Reference Card

## 🚀 Run Tests & Export

```bash
cd test_subgraph_query

# Quick health check (10 seconds)
./quick-check.sh

# Run all tests (30 seconds)
./test-all.sh

# Export sample data (60 seconds)
ts-node export-samples.ts
```

## 🔑 Important Query Patterns

### ✅ Standard Queries (Work as Expected)
```graphql
# Markets
{ markets(first: 10) { id tradeCount } }

# Trades
{ trades(first: 10, orderBy: timestamp, orderDirection: desc) { id price } }

# Users
{ users(first: 10, orderBy: totalVolume, orderDirection: desc) { id totalVolume } }

# Positions
{ positions(first: 10, where: {balance_gt: "0"}) { id balance } }
```

### ⚠️ Special Syntax Required

```graphql
# DailyStats - MUST use _collection suffix
{
  dailyStats_collection(
    first: 30
    orderBy: dayTimestamp
    orderDirection: desc
  ) {
    id
    dayTimestamp
    volume
    tradeCount
  }
}

# GlobalStats - Singleton query (no collection needed)
{
  globalStats(id: "global") {
    totalMarkets
    totalTrades
    totalVolume
    totalUsers
  }
}
```

## 📊 Current Status (79% Synced)

- **Block**: ~63.4M / ~79.4M
- **Progress**: 79%
- **Markets**: 23,455
- **Trades**: 17.1M
- **Users**: 263K
- **Volume**: $3.46B
- **ETA**: ~31 hours

## 🔗 Endpoints

**GraphQL Playground**:
```
https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0
```

**Query via curl**:
```bash
curl -s 'https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0' \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ globalStats(id: \"global\") { totalMarkets totalTrades } }"}' | jq
```

## 📁 Query Files

| File | Queries | Focus |
|------|---------|-------|
| `01-basic-queries.graphql` | 6 | Health checks, global stats |
| `02-market-queries.graphql` | 9 | Markets, resolution |
| `03-user-queries.graphql` | 10 | Traders, profiles |
| `04-trade-queries.graphql` | 12 | Trade history, patterns |
| `05-position-queries.graphql` | 12 | Holdings, PnL |
| `06-analytics-queries.graphql` | 14 | Advanced analytics |
| `07-time-series-queries.graphql` | 14 | Daily trends, growth |

**Total**: 77 queries

## ⚠️ Common Pitfalls

### ❌ DON'T
```graphql
# This will FAIL
{ dailyStats(first: 10) { id } }

# This will FAIL on some positions
{ positions(first: 10) {
    user { id }  # Some users are null!
  }
}
```

### ✅ DO
```graphql
# Use _collection suffix
{ dailyStats_collection(first: 10) { id } }

# Avoid nested nullable fields
{ positions(first: 10) {
    id
    balance
    # Don't query user/market if you need all results
  }
}
```

## 🛠️ Troubleshooting

### "No value provided for required argument: `id`"
**Cause**: Using `dailyStats` instead of `dailyStats_collection`
**Fix**: Add `_collection` suffix

### "Null value resolved for non-null field"
**Cause**: Querying nested fields that might be null
**Fix**: Remove nested fields like `user { id }` from query

### Script says "command not found"
**Cause**: Scripts not executable
**Fix**: `chmod +x *.sh`

### jq not installed
**Cause**: `jq` package missing
**Fix**: `sudo apt install jq` or `brew install jq`

## 📈 Next Steps

1. **Now**: Explore sample data in `sample-data/`
2. **While waiting**: Run queries in GraphQL Playground
3. **After 100% sync**: Run full validation (`npm run validate:all`)
4. **For research**: Export complete dataset and analyze

## 📚 Documentation

- `README.md` - Complete guide
- `ANALYSIS_SUMMARY.md` - Detailed issue analysis
- `FIXES.md` - Technical fix documentation
- `analysis-ideas.md` - Research questions

## 💡 Pro Tips

1. **Use GraphQL Playground** for testing queries interactively
2. **Check `sample-data/README.json`** for export metadata
3. **Run `./quick-check.sh` daily** to monitor sync progress
4. **Copy queries from `.graphql` files** - they're all tested and working
5. **Use `where` filters** to reduce result size: `{balance_gt: "0"}`
6. **Sort results** with `orderBy` and `orderDirection`
7. **Paginate** with `first`, `skip` for large datasets
