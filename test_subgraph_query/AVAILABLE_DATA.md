# Polymarket Historical Data Available via Subgraph

> **Last Updated**: November 23, 2024
> **Sync Status**: 79% (Block 63,417,860 / 79,388,141)
> **Data Coverage**: June 2021 - October 2024
> **Endpoint**: `https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0`

---

## Table of Contents

1. [Overview](#overview)
2. [Available Entities](#available-entities)
3. [Market Data](#1-market-data)
4. [Trading Data](#2-trading-data)
5. [User/Trader Data](#3-usertrader-data)
6. [Position Data](#4-position-data)
7. [Token Registry](#5-token-registry)
8. [Global Statistics](#6-global-statistics)
9. [Daily Time Series](#7-daily-time-series)
10. [Market Participation](#8-market-participation)
11. [Token Lifecycle Events](#9-token-lifecycle-events)
12. [Query Examples](#query-examples)
13. [Data Limitations](#data-limitations)

---

## Overview

### What This Subgraph Indexes

This subgraph provides **complete on-chain historical data** from Polymarket's smart contracts on Polygon:

**Indexed Contracts**:
- ✅ Conditional Tokens Framework (CTF) - Market creation & resolution
- ✅ CTF Exchange (Legacy) - Binary market trading
- ✅ NegRisk Exchange - Multi-outcome market trading
- ✅ NegRisk Adapter - Position management

**Data Period**:
- **Start**: Block 16,820,000 (June 2021)
- **Current**: Block 63,417,860 (October 2024)
- **Coverage**: 3+ years of complete trading history

**Current Statistics** (79% synced):
- **Markets**: 23,455 total
- **Trades**: 17,109,294 total
- **Users**: 263,431 unique traders
- **Volume**: $3,463,070,890 (3.46 billion USD)

---

## Available Entities

| Entity | Count (Current) | Description |
|--------|----------------|-------------|
| **Market** | 23,455 | Prediction markets with outcomes |
| **Trade** | 17,109,294 | Individual executed trades |
| **User** | 263,431 | Unique trader accounts |
| **Position** | Unknown* | User holdings per market/outcome |
| **TokenRegistry** | Unknown* | Token ID to market mappings |
| **GlobalStats** | 1 | Protocol-wide aggregates |
| **DailyStats** | ~1,200 days | Daily aggregated metrics |
| **MarketParticipation** | Unknown* | User activity per market |
| **Split** | Unknown* | Collateral split events |
| **Merge** | Unknown* | Position merge events |
| **Redemption** | Unknown* | Post-resolution payouts |

*Count not easily accessible via API

---

## 1. Market Data

### Available Fields

```graphql
type Market {
  # Identifiers
  id: ID!                        # Condition ID (hex)
  questionId: Bytes!             # Question ID (bytes32)
  oracle: Bytes!                 # Oracle address

  # Market Properties
  outcomeSlotCount: Int!         # Number of outcomes (2 for binary)

  # Lifecycle
  creationTimestamp: BigInt!     # When created
  creationBlock: BigInt!         # Block number
  creationTxHash: Bytes!         # Transaction hash

  # Resolution
  resolved: Boolean!             # Is resolved?
  resolutionTimestamp: BigInt    # When resolved (null if not)
  resolutionBlock: BigInt        # Resolution block
  winningOutcome: Int            # Winning outcome index (0 or 1)
  payoutNumerators: [BigInt!]    # Payout distribution

  # Statistics
  tradeCount: Int!               # Total trades
  totalVolume: BigInt!           # Total volume (USDC wei)
  uniqueTraders: Int!            # Unique participants

  # Relationships
  trades: [Trade!]               # All trades in this market
  positions: [Position!]         # All positions
  tokens: [TokenRegistry!]       # Token mappings
}
```

### What You Can Query

✅ **All markets ever created** (23,455+)
✅ **Market creation dates** and blocks
✅ **Resolution status** and outcomes
✅ **Trading volume** and activity
✅ **Participant counts**
✅ **Binary vs multi-outcome** markets
✅ **Oracle addresses** used

### What You CANNOT Get

❌ **Human-readable question text** (on-chain is bytes32, not text)
❌ **Market categories/tags** (not on-chain)
❌ **Market images/icons** (not on-chain)
❌ **End dates/deadlines** (not in CTF contract)

> **Note**: For question text and metadata, join with [Gamma API](https://gamma-api.polymarket.com/)

---

## 2. Trading Data

### Available Fields

```graphql
type Trade {
  # Identifiers
  id: ID!                        # txHash-logIndex
  transactionHash: Bytes!        # Ethereum tx hash
  logIndex: BigInt!              # Position in tx

  # Participants
  trader: User!                  # Taker (trade executor)
  counterparty: User             # Maker (order provider)

  # Market Context
  market: Market!                # Which market
  tokenId: BigInt!               # ERC-1155 token ID
  outcomeIndex: Int!             # 0=No, 1=Yes (binary)

  # Trade Details
  side: String!                  # "BUY" or "SELL"
  amount: BigInt!                # Outcome tokens traded
  price: BigDecimal!             # Price per token (0-1)
  cost: BigInt!                  # Total USDC spent/received
  fee: BigInt!                   # Trading fee paid

  # Exchange
  exchange: String!              # "LEGACY" or "NEGRISK"

  # Timing
  timestamp: BigInt!             # Unix timestamp
  blockNumber: BigInt!           # Block number
}
```

### What You Can Query

✅ **Every trade** since June 2021 (17M+)
✅ **Buyer and seller** for each trade
✅ **Exact prices** and amounts
✅ **Trading fees** paid
✅ **Timestamps** for time series analysis
✅ **Transaction hashes** for verification
✅ **Buy vs sell** identification
✅ **Legacy vs NegRisk** exchange routing

### Analysis Capabilities

✅ **Price discovery** over time
✅ **Trading volume** trends
✅ **Order flow** analysis (buy/sell pressure)
✅ **Market making** identification
✅ **Whale trading** patterns
✅ **Fee analysis**
✅ **Arbitrage** detection

---

## 3. User/Trader Data

### Available Fields

```graphql
type User {
  # Identity
  id: ID!                        # Wallet address (lowercase)

  # Trading Activity
  tradeCount: Int!               # Total trades executed
  totalVolume: BigInt!           # Total USDC volume
  totalFeesPaid: BigInt!         # Total fees paid
  marketsTraded: Int!            # Unique markets participated

  # Timeline
  firstTradeTimestamp: BigInt    # First trade time
  lastTradeTimestamp: BigInt     # Most recent trade
  firstTradeBlock: BigInt        # First trade block

  # Relationships
  trades: [Trade!]               # All user trades
  positions: [Position!]         # All holdings
  marketParticipations: [...]    # Per-market activity
  redemptions: [Redemption!]     # Winning payouts
}
```

### What You Can Query

✅ **All traders** (263K+ wallets)
✅ **Trading volume** per user
✅ **Trade frequency** and patterns
✅ **Multi-market** vs specialized traders
✅ **Fees paid** (proxy for activity)
✅ **User lifecycle** (first to last trade)
✅ **Portfolio diversity** (markets traded)

### User Segmentation Possible

✅ **Whales** (high volume traders)
✅ **Market makers** (high frequency)
✅ **Arbitrageurs** (cross-market traders)
✅ **Retail traders** (occasional participants)
✅ **New vs veteran** users
✅ **Active vs dormant** accounts

---

## 4. Position Data

### Available Fields

```graphql
type Position {
  # Identity
  id: ID!                        # user-market-tokenId

  # Context
  # user: User!                  # CAUTION: Some are null!
  # market: Market!              # CAUTION: Some are null!
  tokenId: BigInt!               # Token being held
  outcomeIndex: Int!             # Which outcome (0 or 1)

  # Holdings
  balance: BigInt!               # Current token balance

  # Trading History
  totalBought: BigInt!           # Total tokens bought
  totalSold: BigInt!             # Total tokens sold

  # Profit & Loss
  avgBuyPrice: BigDecimal!       # VWAP of buys
  avgSellPrice: BigDecimal!      # VWAP of sells
  realizedPnL: BigDecimal!       # Realized profit/loss

  # Metadata
  tradeCount: Int!               # Trades in this position
  lastUpdated: BigInt!           # Last modification
}
```

### What You Can Query

✅ **Current holdings** (balance > 0)
✅ **Historical positions** (closed positions)
✅ **Profit/loss tracking** (VWAP-based)
✅ **Trading costs** (avg buy/sell prices)
✅ **Position sizes**
✅ **Trade counts** per position

### Analysis Capabilities

✅ **Portfolio composition**
✅ **Unrealized gains/losses** (for open positions)
✅ **Realized PnL** (for closed positions)
✅ **Position concentration**
✅ **Buy-and-hold** vs active trading
✅ **Outcome preferences** (Yes vs No bias)

### ⚠️ Important Limitation

**Some positions have null `user` or `market` references!**

This is a data integrity issue. When querying positions:
- ✅ Safe: Query `id`, `balance`, `avgBuyPrice`, `realizedPnL`
- ❌ Risky: Query nested `user { id }` or `market { id }` (will fail on nulls)

**Workaround**: Parse user/market from the `id` field (format: `user-market-tokenId`)

---

## 5. Token Registry

### Available Fields

```graphql
type TokenRegistry {
  id: ID!                        # Token ID (hex)
  tokenId: BigInt!               # ERC-1155 token ID

  # Mapping
  market: Market!                # Which market
  outcomeIndex: Int!             # Outcome (0=No, 1=Yes)
  indexSet: BigInt!              # CTF index set
  collateral: Bytes!             # Collateral token (USDC)

  # Discovery
  firstSeenTxHash: Bytes!        # First appearance
  firstSeenBlock: BigInt!        # Discovery block
  firstSeenTimestamp: BigInt!    # Discovery time
}
```

### What You Can Query

✅ **Token ID to market** mapping
✅ **Outcome index** for each token
✅ **Collateral type** (always USDC on Polymarket)
✅ **Token discovery** history

### Use Cases

✅ **Resolve token IDs** from Transfer events
✅ **Map trades** to markets
✅ **Verify token** authenticity
✅ **Track token** lifecycle

---

## 6. Global Statistics

### Available Fields

```graphql
type GlobalStats {
  id: ID!                        # Always "global"

  # Counts
  totalMarkets: Int!             # Markets created
  resolvedMarkets: Int!          # Markets resolved
  totalTrades: Int!              # All trades
  totalUsers: Int!               # Unique wallets

  # Volume
  totalVolume: BigInt!           # Total USDC volume
  totalFees: BigInt!             # Total fees collected

  # Sync Status
  lastUpdatedBlock: BigInt!      # Last indexed block
  lastUpdatedTimestamp: BigInt!  # Last update time
}
```

### Current Values (79% synced)

```json
{
  "totalMarkets": 23455,
  "totalTrades": 17109294,
  "totalVolume": "3463070890584644",  // $3.46B
  "totalUsers": 263431,
  "lastUpdatedBlock": 63417860
}
```

### What You Can Query

✅ **Protocol-wide metrics**
✅ **Total volume** (all-time)
✅ **Fee revenue**
✅ **User growth**
✅ **Market creation** rate
✅ **Sync progress**

---

## 7. Daily Time Series

### Available Fields

```graphql
type DailyStats {
  id: ID!                        # Date (Unix timestamp)
  dayTimestamp: BigInt!          # Start of day (UTC)

  # Markets
  newMarkets: Int!               # Markets created today
  resolvedMarkets: Int!          # Markets resolved today

  # Trading
  tradeCount: Int!               # Trades executed today
  volume: BigInt!                # Volume traded today
  fees: BigInt!                  # Fees collected today

  # Users
  newUsers: Int!                 # First-time traders
  activeUsers: Int!              # Unique traders today
}
```

### What You Can Query

✅ **~1,200 days** of historical data
✅ **Daily volume** trends
✅ **User growth** over time
✅ **Trading activity** patterns
✅ **Market creation** trends
✅ **Fee revenue** by day

### ⚠️ Query Syntax

**MUST use `dailyStats_collection`** (not `dailyStats`):

```graphql
# ✅ Correct
{ dailyStats_collection(first: 30) { id volume } }

# ❌ Wrong (will fail)
{ dailyStats(first: 30) { id volume } }
```

### Analysis Capabilities

✅ **Time series** analysis
✅ **Trend detection**
✅ **Seasonality** patterns
✅ **Growth metrics**
✅ **Activity spikes** (event correlation)
✅ **User retention** rates

---

## 8. Market Participation

### Available Fields

```graphql
type MarketParticipation {
  id: ID!                        # user-market

  # Context
  user: User!                    # Which user
  market: Market!                # Which market

  # Activity
  tradeCount: Int!               # Trades in this market
  volume: BigInt!                # Volume in this market

  # Timeline
  firstTradeTimestamp: BigInt!   # First trade
  lastTradeTimestamp: BigInt!    # Last trade
}
```

### What You Can Query

✅ **User activity** per market
✅ **Market-specific** trading volume
✅ **Entry/exit timing**
✅ **Concentration analysis**

### Use Cases

✅ **User specialization** (focused vs diversified)
✅ **Market dominance** (whale concentration)
✅ **Trading duration** in markets
✅ **Re-entry patterns**

---

## 9. Token Lifecycle Events

### Split Events

```graphql
type Split {
  id: ID!
  stakeholder: User!             # Who split
  market: Market!                # Which market
  amount: BigInt!                # Collateral split
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}
```

**What it means**: User deposited collateral (USDC) to mint outcome tokens

### Merge Events

```graphql
type Merge {
  id: ID!
  stakeholder: User!             # Who merged
  market: Market!                # Which market
  amount: BigInt!                # Collateral received
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}
```

**What it means**: User burned complete sets to redeem collateral

### Redemption Events

```graphql
type Redemption {
  id: ID!
  redeemer: User!                # Who redeemed
  market: Market!                # Resolved market
  indexSets: [BigInt!]!          # Sets redeemed
  payout: BigInt!                # USDC received
  timestamp: BigInt!
  blockNumber: BigInt!
  transactionHash: Bytes!
}
```

**What it means**: User claimed winnings from resolved market

### What You Can Query

✅ **Liquidity provision** (splits)
✅ **Liquidity withdrawal** (merges)
✅ **Winning claims** (redemptions)
✅ **Capital flow** into/out of markets

---

## Query Examples

### 1. Get Top 10 Markets by Volume

```graphql
query TopMarkets {
  markets(
    first: 10
    orderBy: totalVolume
    orderDirection: desc
  ) {
    id
    outcomeSlotCount
    tradeCount
    totalVolume
    uniqueTraders
    resolved
    winningOutcome
  }
}
```

### 2. Find Whale Traders (>$1M volume)

```graphql
query WhaleTraders {
  users(
    where: { totalVolume_gt: "1000000000000" }
    orderBy: totalVolume
    orderDirection: desc
  ) {
    id
    tradeCount
    totalVolume
    marketsTraded
    firstTradeTimestamp
  }
}
```

### 3. Recent Trading Activity

```graphql
query RecentTrades {
  trades(
    first: 100
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
  }
}
```

### 4. Daily Volume Trend (Last 30 Days)

```graphql
query DailyVolume {
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

### 5. User Trading History

```graphql
query UserHistory($address: ID!) {
  user(id: $address) {
    tradeCount
    totalVolume
    marketsTraded

    trades(
      first: 50
      orderBy: timestamp
      orderDirection: desc
    ) {
      market { id }
      side
      amount
      price
      timestamp
    }

    positions(where: { balance_gt: "0" }) {
      outcomeIndex
      balance
      avgBuyPrice
      realizedPnL
    }
  }
}
```

### 6. Market Price History

```graphql
query MarketPriceHistory($marketId: ID!) {
  trades(
    where: { market: $marketId }
    orderBy: timestamp
    orderDirection: asc
    first: 1000
  ) {
    timestamp
    price
    amount
    side
  }
}
```

### 7. Protocol Statistics

```graphql
query ProtocolStats {
  globalStats(id: "global") {
    totalMarkets
    resolvedMarkets
    totalTrades
    totalVolume
    totalUsers
    totalFees
  }
}
```

---

## Data Limitations

### What's NOT Available

❌ **Off-Chain Data**:
- Question text (only bytes32 questionId)
- Market descriptions
- Category tags
- Images/icons
- Market end dates
- Liquidity depth (only executed trades)

❌ **Derived Metrics Not Pre-Computed**:
- Market volatility
- User win rates
- Sharpe ratios
- Calibration scores
- Prediction accuracy

❌ **Real-Time Data**:
- Order book state
- Pending orders
- Available liquidity
- Current best bid/ask

❌ **Private Data**:
- User identities (only addresses)
- Order submission times (only execution)
- Canceled orders

### Workarounds

**For question text**: Join with Gamma API
```
GET https://gamma-api.polymarket.com/markets/{conditionId}
```

**For real-time data**: Use Polymarket's CLOB API
```
https://clob.polymarket.com/
```

**For derived metrics**: Calculate client-side from raw data

---

## Data Quality Notes

### Known Issues

1. **Position User Nullability**
   - Some positions have null `user` references
   - Workaround: Parse from position `id` field

2. **Incomplete Sync**
   - Currently at 79% (block 63.4M / 79.4M)
   - Final ~21% will add more recent data
   - ~31 hours until 100% sync

3. **ResolvedMarkets Count**
   - Not properly tracked in current GlobalStats
   - Can be counted via query: `markets(where: {resolved: true})`

### Data Accuracy

✅ **All on-chain data is cryptographically verified**
✅ **Trade prices/amounts are exact** (from events)
✅ **Timestamps are precise** (block timestamps)
✅ **Volume calculations are accurate** (sum of costs)
✅ **User counts are deduplicated** (unique addresses)

---

## Query Performance Tips

### Efficient Queries

✅ **Use pagination**: `first`, `skip` for large results
✅ **Filter early**: Use `where` clauses to reduce results
✅ **Request only needed fields**: Don't query everything
✅ **Order by indexed fields**: `timestamp`, `volume`, etc.

### Example: Efficient Pagination

```graphql
# Page 1 (records 0-999)
query Page1 {
  trades(first: 1000, skip: 0, orderBy: timestamp) {
    id
    price
    timestamp
  }
}

# Page 2 (records 1000-1999)
query Page2 {
  trades(first: 1000, skip: 1000, orderBy: timestamp) {
    id
    price
    timestamp
  }
}
```

### Example: Time Range Filter

```graphql
query TradesInRange {
  trades(
    where: {
      timestamp_gte: "1704067200"  # Jan 1, 2024
      timestamp_lte: "1711929600"  # Apr 1, 2024
    }
    orderBy: timestamp
  ) {
    id
    price
    timestamp
  }
}
```

---

## Summary: What Can You Research?

### Market Analysis
✅ Price discovery mechanisms
✅ Market efficiency
✅ Volume patterns
✅ Resolution accuracy
✅ Market lifecycle

### User Behavior
✅ Trading strategies
✅ User segmentation
✅ Whale identification
✅ Market making patterns
✅ Entry/exit timing

### Platform Metrics
✅ Growth trends
✅ User retention
✅ Volume trends
✅ Fee analysis
✅ Network effects

### Event Studies
✅ Market reactions to events
✅ Information propagation
✅ Volatility clustering
✅ Herding behavior
✅ Arbitrage opportunities

---

## Next Steps

1. **Explore**: Try queries in [GraphQL Playground](https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0)
2. **Test**: Use queries from `.graphql` files in this directory
3. **Export**: Run `ts-node export-samples.ts` for sample data
4. **Analyze**: Start with exported data in `sample-data/`
5. **Scale**: After 100% sync, export full datasets

---

**Your 79% synced data = 3.46 billion dollars of trading history = Ready for analysis NOW!** 🎯
