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

- **Status**: Deployed to The Graph Studio - Indexing in Progress
- **Query Endpoint**: `https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0`

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
  dailyStats(
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

See `scripts/smoke-queries.graphql` for more example queries.

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
├── schema.graphql          # GraphQL schema
├── subgraph.yaml           # Subgraph manifest
├── networks.json           # Network configurations
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

Check indexing status:

```bash
curl -s 'https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0' \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ _meta { block { number } hasIndexingErrors } }"}' | jq
```

Current Polygon block height: ~66M+
Expected sync time: 3-14 days for full historical data

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and test
4. Submit a pull request

## License

MIT

## Resources

- [The Graph Documentation](https://thegraph.com/docs/)
- [Polymarket](https://polymarket.com/)
- [Conditional Tokens Framework](https://docs.gnosis.io/conditionaltokens/)
- [Gamma Markets API](https://gamma-api.polymarket.com/)
