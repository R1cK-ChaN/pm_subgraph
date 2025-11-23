# Test Subgraph Query Scripts

This directory contains all test queries and scripts for the Polymarket subgraph.

## Directory Structure

```
test_subgraph_query/
├── README.md                      # This file
├── 01-basic-queries.graphql       # Simple queries to verify data
├── 02-market-queries.graphql      # Market-related queries
├── 03-user-queries.graphql        # User and trader queries
├── 04-trade-queries.graphql       # Trade analysis queries
├── 05-position-queries.graphql    # Position and PnL queries
├── 06-analytics-queries.graphql   # Advanced analytics queries
├── 07-time-series-queries.graphql # Daily/time-based queries
├── test-all.sh                    # Run all test queries
├── quick-check.sh                 # Quick health check
└── export-samples.ts              # Export sample data
```

## Quick Start

### 1. Check if subgraph is working
```bash
./quick-check.sh
```

### 2. Run all test queries
```bash
./test-all.sh
```

### 3. Use GraphQL Playground
Open in browser:
https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0

Then copy queries from the `.graphql` files.

## Endpoint

**Production Endpoint:**
```
https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0
```

## Usage Examples

### Using curl
```bash
curl -s 'https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0' \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ globalStats(id: \"global\") { totalMarkets totalTrades } }"}' | jq
```

### Using the scripts
```bash
# Make scripts executable
chmod +x *.sh

# Run quick check
./quick-check.sh

# Run all tests
./test-all.sh
```

## Query Categories

1. **Basic Queries** - Health checks and global stats
2. **Market Queries** - Market data and lifecycle
3. **User Queries** - Trader profiles and statistics
4. **Trade Queries** - Trade analysis and patterns
5. **Position Queries** - Holdings and PnL
6. **Analytics Queries** - Advanced aggregations
7. **Time Series Queries** - Historical trends
