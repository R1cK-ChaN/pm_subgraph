# Polymarket Subgraph

A custom subgraph for indexing Polymarket historical trading data on Polygon. Built for research and analysis of prediction market activity.

## Overview

This subgraph indexes events from Polymarket's smart contracts:
- **CTF Exchange** - Conditional Token Framework for market creation and resolution
- **CLOB Exchange** - Central Limit Order Book for trading
- **NegRisk Exchange** - Negative risk trading venue
- **NegRisk Adapter** - Cross-market position management

## Features

- Complete trade history with buyer/seller identification
- Position tracking with PnL calculations (VWAP-based)
- Market lifecycle from creation to resolution
- User analytics and participation metrics
- Daily aggregated statistics
- Token registry mapping tokenId to markets

## Current Deployment

- **Status**: ✅ Deployed to The Graph Studio - 79% Synced (Nov 2024)
- **Query Endpoint**: `https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0`
- **Current Stats** (79% synced):
  - Markets: 23,455
  - Trades: 17,109,294
  - Users: 263,431
  - Volume: $3.46 billion
- **Test Status**: ✅ 14/14 queries passing (100%)
- **ETA to 100%**: ~31 hours (as of Nov 23, 2024)

## Installation

```bash
# Clone the repository
git clone https://github.com/R1cK-ChaN/pm_subgraph.git
cd pm_subgraph

# Install dependencies
npm install

# Generate types from schema
npm run codegen

# Build the subgraph
npm run build
```

## Deployment

### Deploy to The Graph Studio

1. Create a subgraph at [The Graph Studio](https://thegraph.com/studio/)
2. Authenticate with your deploy key:
   ```bash
   npx graph auth --studio <DEPLOY_KEY>
   ```
3. Deploy:
   ```bash
   npm run deploy
   ```

### Deploy Locally (requires graph-node)

```bash
npm run create-local
npm run deploy-local
```

## Testing

### Comprehensive Query Tests

**Status**: ✅ **14/14 tests passing (100%)**

The `test_subgraph_query/` directory contains a complete test suite with 77 working queries:

```bash
cd test_subgraph_query

# Quick health check (10 seconds)
./quick-check.sh

# Run all query tests (30 seconds)
./test-all.sh

# Export sample data (60 seconds)
ts-node export-samples.ts
```

**Test Results** (Nov 23, 2024):
- ✅ Basic queries (2/2)
- ✅ Market queries (2/2)
- ✅ User queries (2/2)
- ✅ Trade queries (2/2)
- ✅ Position queries (2/2)
- ✅ Analytics queries (2/2)
- ✅ Time series queries (2/2)

**Issues Found & Fixed**:
1. ✅ GraphQL schema naming inconsistency (`dailyStats_collection` required)
2. ✅ Shell script quote escaping bug
3. ✅ Position entity nullable user references

See `test_subgraph_query/ANALYSIS_SUMMARY.md` for full details.

### Query Collections

77 pre-built, tested queries organized by category:
- `01-basic-queries.graphql` - 6 queries
- `02-market-queries.graphql` - 9 queries
- `03-user-queries.graphql` - 10 queries
- `04-trade-queries.graphql` - 12 queries
- `05-position-queries.graphql` - 12 queries
- `06-analytics-queries.graphql` - 14 queries
- `07-time-series-queries.graphql` - 14 queries

### Documentation

Complete documentation in `test_subgraph_query/`:
- **[INDEX.md](test_subgraph_query/INDEX.md)** - Documentation roadmap
- **[QUICK_REFERENCE.md](test_subgraph_query/QUICK_REFERENCE.md)** - Quick start guide
- **[AVAILABLE_DATA.md](test_subgraph_query/AVAILABLE_DATA.md)** - Complete data catalog
- **[ANALYSIS_SUMMARY.md](test_subgraph_query/ANALYSIS_SUMMARY.md)** - Test results & analysis
- **[FIXES.md](test_subgraph_query/FIXES.md)** - Technical fixes applied

### Unit Tests (Matchstick)

Requires Docker on Linux:

```bash
npm run test
```

### Validation Scripts

After deployment and sync completion:

```bash
# Run all validations
npm run validate:all <SUBGRAPH_ENDPOINT>

# Individual validations
npm run validate:counts <SUBGRAPH_ENDPOINT>
npm run validate:trades <SUBGRAPH_ENDPOINT>
npm run validate:gamma <SUBGRAPH_ENDPOINT>
```

## Example Queries

### Global Statistics

```graphql
query GlobalStats {
  globalStats(id: "global") {
    totalMarkets
    resolvedMarkets
    totalTrades
    totalVolume
    totalUsers
  }
}
```

### Recent Trades

```graphql
query RecentTrades {
  trades(
    first: 10
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    market { id }
    trader { id }
    side
    amount
    price
    cost
    timestamp
    transactionHash
  }
}
```

### User Positions

```graphql
query UserPositions($user: ID!) {
  positions(
    where: { user: $user, balance_gt: "0" }
    orderBy: balance
    orderDirection: desc
  ) {
    market { id }
    outcomeIndex
    balance
    avgBuyPrice
    realizedPnL
  }
}
```

### Market Details

```graphql
query MarketDetails($id: ID!) {
  market(id: $id) {
    questionId
    oracle
    outcomeSlotCount
    resolved
    winningOutcome
    tradeCount
    totalVolume
    uniqueTraders
  }
}
```

### Daily Statistics

```graphql
query DailyStats {
  dailyStats_collection(
    first: 30
    orderBy: dayTimestamp
    orderDirection: desc
  ) {
    dayTimestamp
    tradeCount
    volume
    activeUsers
    newUsers
  }
}
```

> **Note**: Use `dailyStats_collection` (not `dailyStats`) for querying multiple daily stats. See [FIXES.md](test_subgraph_query/FIXES.md) for details.

See `scripts/smoke-queries.graphql` and `test_subgraph_query/*.graphql` for more example queries.

## Project Structure

```
polymarket-subgraph/
├── src/
│   ├── mappings/           # Event handlers
│   │   ├── ctf.ts          # CTF Exchange handlers
│   │   ├── exchange.ts     # CLOB Exchange handlers
│   │   ├── negRiskExchange.ts
│   │   └── negRiskAdapter.ts
│   └── utils/
│       ├── helpers.ts      # Helper functions
│       └── constants.ts    # Contract addresses, constants
├── tests/
│   ├── utils/helpers.ts    # Mock event creators
│   ├── ctf.test.ts         # CTF handler tests
│   └── exchange.test.ts    # Exchange handler tests
├── scripts/
│   ├── validate-counts.ts  # GlobalStats validation
│   ├── validate-trades.ts  # Trade integrity checks
│   ├── validate-gamma.ts   # Gamma API alignment
│   ├── validate-all.ts     # Run all validations
│   └── smoke-queries.graphql
├── test_subgraph_query/    # ✅ NEW: Comprehensive query tests
│   ├── *.graphql           # 77 tested queries (7 categories)
│   ├── *.sh                # Test scripts
│   ├── export-samples.ts   # Data export tool
│   ├── sample-data/        # Exported sample data (491 entities)
│   └── *.md                # Complete documentation
├── schema.graphql          # GraphQL schema
├── subgraph.yaml           # Subgraph manifest
└── PLAN.md                 # Implementation plan
```

## Entities

| Entity | Description |
|--------|-------------|
| `Market` | Prediction market with outcomes and resolution |
| `Trade` | Individual trade with price, amount, parties |
| `User` | Trader with aggregate statistics |
| `Position` | User's holdings per market/outcome with PnL |
| `TokenRegistry` | Maps tokenId to market and outcome |
| `GlobalStats` | Protocol-wide aggregates |
| `DailyStats` | Daily aggregated metrics |
| `MarketParticipation` | User activity per market |

## Data Sources

- **Polymarket Contracts** (Polygon Mainnet)
  - CTF Exchange: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`
  - CLOB Exchange: `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`
  - NegRisk Exchange: `0xC5d563A36AE78145C45a50134d48A1215220f80a`
  - NegRisk Adapter: `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`

- **Start Block**: 32,800,000 (Dec 2022)

## Monitoring Sync Progress

### Quick Check

```bash
cd test_subgraph_query
./quick-check.sh
```

### Manual Check

```bash
curl -s 'https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0' \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ _meta { block { number } hasIndexingErrors } }"}' | jq
```

**Current Status** (Nov 23, 2024):
- Synced: 79% (Block 63,417,860 / 79,388,141)
- Expected sync time: 6-7 days total
- Time remaining: ~31 hours
- No indexing errors ✅

**Historical Data Available**:
- Coverage: June 2021 - October 2024
- Markets: 23,455
- Trades: 17,109,294
- Volume: $3.46 billion
- Data is **ready to query now** (79% complete)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test
4. Submit a pull request

## License

MIT

## Known Issues & Workarounds

### Schema Quirks

1. **DailyStats Collection Query**
   - ❌ `dailyStats(first: 10)` - Does NOT work
   - ✅ `dailyStats_collection(first: 10)` - Required syntax
   - See [FIXES.md](test_subgraph_query/FIXES.md) for details

2. **Position User Nullability**
   - Some positions have null `user` references
   - Avoid nested user queries: `positions { user { id } }`
   - Safe: `positions { id balance avgBuyPrice }`

3. **Missing Metadata**
   - Question text not on-chain (only bytes32)
   - Join with [Gamma API](https://gamma-api.polymarket.com/) for human-readable data

### Performance Tips

- Use pagination: `first`, `skip` for large results
- Filter early: Use `where` clauses
- Order by indexed fields: `timestamp`, `volume`, etc.
- See [AVAILABLE_DATA.md](test_subgraph_query/AVAILABLE_DATA.md) for optimization tips

## Quick Start Guide

1. **Want to know what data exists?**
   - Read `test_subgraph_query/AVAILABLE_DATA.md`

2. **Want to query immediately?**
   ```bash
   cd test_subgraph_query
   ./quick-check.sh
   # Then copy queries from .graphql files
   ```

3. **Want sample data?**
   ```bash
   cd test_subgraph_query
   ts-node export-samples.ts
   # Check sample-data/ directory
   ```

4. **Want to explore in browser?**
   - Open: https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0
   - Copy queries from `test_subgraph_query/*.graphql` files

## Resources

- [The Graph Documentation](https://thegraph.com/docs/)
- [Polymarket](https://polymarket.com/)
- [Conditional Tokens Framework](https://docs.gnosis.io/conditionaltokens/)
- [Gamma Markets API](https://gamma-api.polymarket.com/)
- **[Query Test Suite](test_subgraph_query/)** - 77 working queries + documentation
