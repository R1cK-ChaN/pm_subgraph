# Test Subgraph Query - Documentation Index

## 📚 Documentation Files

### **Start Here** 👈
- **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Quick start guide with examples
- **[AVAILABLE_DATA.md](AVAILABLE_DATA.md)** - Complete data catalog (what you can fetch)

### **Reference Documentation**
- **[README.md](README.md)** - Complete guide to using this directory
- **[ANALYSIS_SUMMARY.md](ANALYSIS_SUMMARY.md)** - Deep dive into issues found & fixed
- **[FIXES.md](FIXES.md)** - Technical details of all fixes applied
- **[analysis-ideas.md](analysis-ideas.md)** - Research ideas and next steps

## 🚀 Quick Start

### 1. **I want to know what data is available**
→ Read **[AVAILABLE_DATA.md](AVAILABLE_DATA.md)**
   - Lists all 9 entity types (Market, Trade, User, etc.)
   - Shows all available fields
   - Explains what you CAN and CANNOT query
   - Includes 20+ example queries

### 2. **I want to start querying immediately**
→ Read **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)**
   - Run `./quick-check.sh` for health check
   - Copy queries from `.graphql` files
   - Use GraphQL Playground link

### 3. **I want to understand what was tested**
→ Read **[ANALYSIS_SUMMARY.md](ANALYSIS_SUMMARY.md)**
   - See test results (14/14 passing)
   - Understand issues found & fixed
   - View current sync status
   - Review data quality notes

### 4. **I'm a developer fixing issues**
→ Read **[FIXES.md](FIXES.md)**
   - Technical root cause analysis
   - Code fixes applied
   - Query pattern corrections
   - Schema inconsistencies

## 📁 Query Files (77 Total Queries)

All tested and working:

- **[01-basic-queries.graphql](01-basic-queries.graphql)** - Health checks, global stats (6 queries)
- **[02-market-queries.graphql](02-market-queries.graphql)** - Market data (9 queries)
- **[03-user-queries.graphql](03-user-queries.graphql)** - Trader profiles (10 queries)
- **[04-trade-queries.graphql](04-trade-queries.graphql)** - Trading history (12 queries)
- **[05-position-queries.graphql](05-position-queries.graphql)** - Holdings & PnL (12 queries)
- **[06-analytics-queries.graphql](06-analytics-queries.graphql)** - Advanced analytics (14 queries)
- **[07-time-series-queries.graphql](07-time-series-queries.graphql)** - Daily trends (14 queries)

## 🛠️ Scripts

- **[quick-check.sh](quick-check.sh)** - Fast health check (10 sec)
- **[test-all.sh](test-all.sh)** - Run all test queries (30 sec)
- **[export-samples.ts](export-samples.ts)** - Export sample data (60 sec)

## 📊 Sample Data

Located in `sample-data/` directory:
- `global-stats.json` - Protocol statistics
- `sample-markets.json` - Top 100 markets
- `sample-users.json` - Top 100 traders
- `sample-trades.json` - Recent 100 trades
- `daily-stats.json` - Last 90 days
- `sample-positions.json` - Largest 100 positions
- `README.json` - Export metadata

## 🎯 By Use Case

### "I want to analyze market efficiency"
1. Read **AVAILABLE_DATA.md** → Section 2 (Trading Data)
2. Use queries from **04-trade-queries.graphql**
3. Export data: `ts-node export-samples.ts`

### "I want to identify whale traders"
1. Read **AVAILABLE_DATA.md** → Section 3 (User Data)
2. Use queries from **03-user-queries.graphql**
3. Look for `WhaleTraders` query example

### "I want to track daily volumes"
1. Read **AVAILABLE_DATA.md** → Section 7 (Daily Time Series)
2. Use queries from **07-time-series-queries.graphql**
3. Note: Must use `dailyStats_collection` (see FIXES.md)

### "I want to build a trading bot"
1. Read **AVAILABLE_DATA.md** → Section 13 (Limitations)
2. Note: This subgraph has historical data only
3. For real-time: Use Polymarket CLOB API

### "I want to calculate user PnL"
1. Read **AVAILABLE_DATA.md** → Section 4 (Position Data)
2. Use queries from **05-position-queries.graphql**
3. Note: PnL is VWAP-based, pre-calculated

## 📈 Current Status

**As of November 23, 2024:**
- ✅ Sync Progress: 79%
- ✅ Test Status: 14/14 passing (100%)
- ✅ Data Quality: Excellent
- ✅ ETA to 100%: ~31 hours

**Statistics:**
- Markets: 23,455
- Trades: 17,109,294
- Users: 263,431
- Volume: $3.46 billion

## 🔗 External Links

- **Subgraph Endpoint**: https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0
- **Polymarket**: https://polymarket.com/
- **Gamma API**: https://gamma-api.polymarket.com/
- **The Graph Docs**: https://thegraph.com/docs/

## ⚡ TL;DR

**Want to know what data exists?** → **[AVAILABLE_DATA.md](AVAILABLE_DATA.md)**

**Want to query it now?** → **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** + `./quick-check.sh`

**Want to understand the tech?** → **[ANALYSIS_SUMMARY.md](ANALYSIS_SUMMARY.md)** + **[FIXES.md](FIXES.md)**
