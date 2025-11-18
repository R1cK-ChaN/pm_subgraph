# Polymarket Subgraph Implementation Plan

> **Project**: Custom Subgraph for Polymarket Historical Data Collection
> **Network**: Polygon (Matic)
> **Platform**: The Graph Network (Subgraph Studio)
> **Version**: 1.0.0

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Objectives](#2-project-objectives)
3. [On-Chain Data to Index](#3-on-chain-data-to-index)
4. [Project Structure](#4-project-structure)
5. [Schema Design](#5-schema-design)
6. [Subgraph Manifest Configuration](#6-subgraph-manifest-configuration)
7. [Mapping Implementation](#7-mapping-implementation)
8. [Local Development Setup](#8-local-development-setup)
9. [Deployment Process](#9-deployment-process)
10. [GraphQL Query Examples](#10-graphql-query-examples)
11. [Data Validation Strategy](#11-data-validation-strategy)
12. [Off-Chain Data Integration](#12-off-chain-data-integration)
13. [Timeline & Milestones](#13-timeline--milestones)
14. [Troubleshooting](#14-troubleshooting)
15. [References](#15-references)
16. [Implementation Notes](#16-implementation-notes)

---

## 1. Executive Summary

This document outlines the complete implementation strategy for building a custom Polymarket subgraph on The Graph Network. The subgraph will index all historical on-chain data from Polymarket's smart contracts on Polygon, including:

- **Markets**: Creation, resolution, and outcome data
- **Trades**: All executed trades with price, amount, and participants
- **Positions**: User holdings and balance changes
- **Users**: Trader profiles and aggregated statistics

**Key Technical Decisions**:
- Deploy to **Subgraph Studio** (The Graph's Hosted Service was deprecated June 12, 2024)
- Index **4 contracts** (CTF, Legacy Exchange, NegRisk Exchange, NegRisk Adapter)
- Expect **3-14 days** for initial sync of 50M+ Polygon blocks
- Join with **Gamma API** off-chain for market metadata

**Critical Architecture Decisions**:
- **TokenRegistry as source of truth** for `tokenId → conditionId/outcomeIndex` mapping
- **Transfers as single source of truth** for position balances (not trades)
- **Include mint/burn transfers** (from/to zero address) for correct balance tracking
- **OrderFilled only** for trade records (avoid duplicates from OrdersMatched)

---

## 2. Project Objectives

### 2.1 Research Goals

1. **Event Correlation Analysis**
   - Market price movements vs. real-world events
   - Information propagation patterns

2. **User Group Identification**
   - Whale traders vs. retail participants
   - Arbitrageurs and market makers
   - Information traders vs. noise traders

3. **User Action Analysis**
   - Trading patterns and strategies
   - Position management behaviors
   - Resolution participation patterns

### 2.2 Data Requirements

- Complete historical record of all trades since Polymarket launch (2020)
- User position snapshots and balance history
- Market resolution data and outcomes
- Aggregated statistics (volume, user counts, etc.)

---

## 3. On-Chain Data to Index

### 3.1 Contract Addresses & Start Blocks

| Contract | Address | Start Block | Deployment |
|----------|---------|-------------|------------|
| **Conditional Tokens (CTF)** | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` | 16,820,000 | June 2021 |
| **CTF Exchange (Legacy)** | `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` | 33,100,000 | August 2022 |
| **CTF Exchange (NegRisk)** | `0xC5d563A36AE78145C45a50134d48A1215220f80a` | 49,000,000 | October 2023 |
| **NegRisk Adapter** | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` | 49,000,000 | October 2023 |

> **IMPORTANT**: Verify exact deploy blocks on PolygonScan before deployment. Set `startBlock` to at or before the first relevant event for each contract to avoid missing early data.

### 3.2 Events by Contract

#### Conditional Tokens Contract (CTF)

| Event | Description | Key Fields |
|-------|-------------|------------|
| `ConditionPreparation` | Market created | `conditionId`, `oracle`, `questionId`, `outcomeSlotCount` |
| `ConditionResolution` | Market resolved | `conditionId`, `payoutNumerators[]` |
| `PositionSplit` | User mints outcome tokens | `stakeholder`, `conditionId`, `partition[]`, `amount` |
| `PositionsMerge` | User burns outcome tokens | `stakeholder`, `conditionId`, `partition[]`, `amount` |
| `PayoutRedemption` | User redeems winning tokens | `redeemer`, `conditionId`, `indexSets[]`, `payout` |
| `TransferSingle` | Token transfer (incl mint/burn) | `from`, `to`, `id`, `value` |
| `TransferBatch` | Batch token transfer | `from`, `to`, `ids[]`, `values[]` |

#### CTF Exchange Contracts

| Event | Description | Key Fields |
|-------|-------------|------------|
| `TokenRegistered` | New token registered for trading | `token0`, `token1`, `conditionId` |
| `OrderFilled` | Trade executed | `orderHash`, `maker`, `taker`, `makerAssetId`, `takerAssetId`, `makerAmountFilled`, `takerAmountFilled`, `fee` |
| `OrdersMatched` | Orders matched (auxiliary - don't use for trades) | `takerOrderHash`, `takerOrderMaker`, `makerAssetId`, `takerAssetId`, `makerAmountFilled`, `takerAmountFilled` |

> **NOTE**: Use `OrderFilled` as the sole source of truth for trades. `OrdersMatched` fires alongside `OrderFilled` and would cause duplicates.

#### NegRisk Adapter Contract

| Event | Description | Key Fields |
|-------|-------------|------------|
| `QuestionPrepared` | NegRisk question initialized | `marketId`, `questionId`, `index`, `data` |
| `PositionsConverted` | Position conversion | `stakeholder`, `marketId`, `indexSet`, `amount` |

### 3.3 Data Availability Summary

| Data Type | On-Chain | Off-Chain (Gamma) |
|-----------|:--------:|:-----------------:|
| Market creation/resolution | ✓ | |
| Trade executions | ✓ | |
| User positions | ✓ | |
| Token splits/merges | ✓ | |
| Timestamps & blocks | ✓ | |
| Wallet addresses | ✓ | |
| USDC volumes | ✓ | |
| Question text | | ✓ |
| Categories/tags | | ✓ |
| Market images | | ✓ |
| CLOB token mappings | | ✓ |

---

## 4. Project Structure

```
polymarket-subgraph/
├── package.json
├── subgraph.yaml
├── schema.graphql
├── tsconfig.json
├── .gitignore
├── README.md
├── PLAN.md
│
├── abis/
│   ├── ConditionalTokens.json
│   ├── CTFExchange.json
│   ├── NegRiskCTFExchange.json
│   └── NegRiskAdapter.json
│
├── src/
│   ├── mappings/
│   │   ├── ctf.ts
│   │   ├── exchange.ts
│   │   ├── negRiskExchange.ts
│   │   └── negRiskAdapter.ts
│   └── utils/
│       ├── constants.ts
│       ├── helpers.ts
│       ├── tokenRegistry.ts
│       └── pricing.ts
│
├── tests/
│   ├── ctf.test.ts
│   └── exchange.test.ts
│
├── scripts/
│   ├── validate.ts
│   ├── fetch-abis.sh
│   └── compare-subgraphs.ts
│
└── docker/
    └── docker-compose.yml
```

### 4.1 Package Configuration

```json
{
  "name": "polymarket-subgraph",
  "version": "1.0.0",
  "description": "Custom subgraph for indexing Polymarket historical data on Polygon",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/polymarket-subgraph"
  },
  "scripts": {
    "codegen": "graph codegen",
    "build": "graph build",
    "deploy": "graph deploy --studio polymarket-subgraph",
    "deploy:prod": "graph deploy --studio polymarket-subgraph --version-label v1.0.0",
    "create-local": "graph create --node http://localhost:8020/ polymarket-subgraph",
    "remove-local": "graph remove --node http://localhost:8020/ polymarket-subgraph",
    "deploy-local": "graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 polymarket-subgraph",
    "test": "graph test",
    "validate": "ts-node scripts/validate.ts"
  },
  "dependencies": {
    "@graphprotocol/graph-cli": "^0.71.0",
    "@graphprotocol/graph-ts": "^0.32.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "matchstick-as": "^0.6.0"
  }
}
```

---

## 5. Schema Design

### 5.1 Complete GraphQL Schema

```graphql
# schema.graphql
# Polymarket Subgraph Schema v1.0.0

# =============================================================================
# TOKEN REGISTRY (CRITICAL - Maps tokenId to market/outcome)
# =============================================================================

type TokenRegistry @entity {
  "Unique identifier - tokenId as hex string"
  id: ID!

  "The ERC-1155 token ID"
  tokenId: BigInt!

  "Reference to the market (conditionId)"
  market: Market!

  "Outcome index this token represents (0=No, 1=Yes)"
  outcomeIndex: Int!

  "Index set used in CTF (bitmask)"
  indexSet: BigInt!

  "Collateral token address"
  collateral: Bytes!

  "First transaction where this token was seen"
  firstSeenTxHash: Bytes!

  "First block where this token was seen"
  firstSeenBlock: BigInt!

  "Timestamp when first seen"
  firstSeenTimestamp: BigInt!
}

# =============================================================================
# MARKET ENTITY
# =============================================================================

type Market @entity {
  "Unique identifier - conditionId from CTF contract"
  id: ID!

  "Question ID (bytes32) - NOT human-readable text"
  questionId: Bytes!

  "Oracle address responsible for resolution"
  oracle: Bytes!

  "Number of outcomes (2 for binary markets)"
  outcomeSlotCount: Int!

  "Block timestamp when market was created"
  creationTimestamp: BigInt!

  "Block number when market was created"
  creationBlock: BigInt!

  "Transaction hash of creation"
  creationTxHash: Bytes!

  "Whether market has been resolved"
  resolved: Boolean!

  "Block timestamp when market was resolved"
  resolutionTimestamp: BigInt

  "Block number when market was resolved"
  resolutionBlock: BigInt

  "Index of winning outcome (0 or 1 for binary; null if not resolved)"
  winningOutcome: Int

  "Raw payout numerators from resolution"
  payoutNumerators: [BigInt!]

  # Aggregated Statistics
  "Total number of trades in this market"
  tradeCount: Int!

  "Total volume traded (in USDC wei)"
  totalVolume: BigInt!

  "Number of unique traders"
  uniqueTraders: Int!

  # Relationships
  "All trades in this market"
  trades: [Trade!]! @derivedFrom(field: "market")

  "All user positions in this market"
  positions: [Position!]! @derivedFrom(field: "market")
}

# =============================================================================
# TRADE ENTITY
# =============================================================================

type Trade @entity {
  "Unique identifier - txHash-logIndex"
  id: ID!

  "Reference to the market"
  market: Market!

  "Trader who executed the trade"
  trader: User!

  "Counterparty (maker if trader is taker)"
  counterparty: User

  "Token ID being traded"
  tokenId: BigInt!

  "Outcome index (0=No, 1=Yes for binary)"
  outcomeIndex: Int!

  "Trade side: BUY or SELL"
  side: String!

  "Amount of outcome tokens"
  amount: BigInt!

  "Price per token (USDC with 6 decimals)"
  price: BigDecimal!

  "Total cost/proceeds in USDC"
  cost: BigInt!

  "Fee paid (in USDC wei)"
  fee: BigInt!

  "Block timestamp"
  timestamp: BigInt!

  "Block number"
  blockNumber: BigInt!

  "Transaction hash"
  transactionHash: Bytes!

  "Log index within transaction"
  logIndex: BigInt!

  "Exchange contract used (legacy or negrisk)"
  exchange: String!
}

# =============================================================================
# USER ENTITY
# =============================================================================

type User @entity {
  "Unique identifier - wallet address"
  id: ID!

  "Total number of trades"
  tradeCount: Int!

  "Total volume traded (USDC)"
  totalVolume: BigInt!

  "Total fees paid (USDC)"
  totalFeesPaid: BigInt!

  "Number of unique markets traded"
  marketsTraded: Int!

  "Timestamp of first trade"
  firstTradeTimestamp: BigInt

  "Timestamp of most recent trade"
  lastTradeTimestamp: BigInt

  "Block of first trade"
  firstTradeBlock: BigInt

  # Relationships
  "All trades by this user"
  trades: [Trade!]! @derivedFrom(field: "trader")

  "All positions held by this user"
  positions: [Position!]! @derivedFrom(field: "user")

  "Markets this user has participated in"
  marketParticipations: [MarketParticipation!]! @derivedFrom(field: "user")
}

# =============================================================================
# POSITION ENTITY
# =============================================================================

type Position @entity {
  "Unique identifier - user-market-tokenId"
  id: ID!

  "User who holds this position"
  user: User!

  "Market this position is in"
  market: Market!

  "Token ID for this position"
  tokenId: BigInt!

  "Outcome index (0=No, 1=Yes)"
  outcomeIndex: Int!

  "Current balance of tokens"
  balance: BigInt!

  "Total tokens bought"
  totalBought: BigInt!

  "Total tokens sold"
  totalSold: BigInt!

  "Average buy price"
  avgBuyPrice: BigDecimal!

  "Average sell price"
  avgSellPrice: BigDecimal!

  "Realized PnL from closed positions"
  realizedPnL: BigDecimal!

  "Number of trades in this position"
  tradeCount: Int!

  "Last updated timestamp"
  lastUpdated: BigInt!
}

# =============================================================================
# MARKET PARTICIPATION (Junction Entity)
# =============================================================================

type MarketParticipation @entity {
  "Unique identifier - user-market"
  id: ID!

  "User participating"
  user: User!

  "Market participated in"
  market: Market!

  "Number of trades in this market"
  tradeCount: Int!

  "Volume in this market"
  volume: BigInt!

  "First trade timestamp"
  firstTradeTimestamp: BigInt!

  "Last trade timestamp"
  lastTradeTimestamp: BigInt!
}

# =============================================================================
# SPLIT/MERGE EVENTS
# =============================================================================

type Split @entity {
  "Unique identifier - txHash-logIndex"
  id: ID!

  "User who split"
  stakeholder: User!

  "Market (condition)"
  market: Market!

  "Amount of collateral split"
  amount: BigInt!

  "Block timestamp"
  timestamp: BigInt!

  "Block number"
  blockNumber: BigInt!

  "Transaction hash"
  transactionHash: Bytes!
}

type Merge @entity {
  "Unique identifier - txHash-logIndex"
  id: ID!

  "User who merged"
  stakeholder: User!

  "Market (condition)"
  market: Market!

  "Amount of collateral received"
  amount: BigInt!

  "Block timestamp"
  timestamp: BigInt!

  "Block number"
  blockNumber: BigInt!

  "Transaction hash"
  transactionHash: Bytes!
}

# =============================================================================
# REDEMPTION (PayoutRedemption - post-resolution cash-out)
# =============================================================================

type Redemption @entity {
  "Unique identifier - txHash-logIndex"
  id: ID!

  "User who redeemed"
  redeemer: User!

  "Market (condition)"
  market: Market!

  "Index sets redeemed"
  indexSets: [BigInt!]!

  "Payout amount received (USDC)"
  payout: BigInt!

  "Block timestamp"
  timestamp: BigInt!

  "Block number"
  blockNumber: BigInt!

  "Transaction hash"
  transactionHash: Bytes!
}

# =============================================================================
# GLOBAL STATISTICS
# =============================================================================

type GlobalStats @entity {
  "Singleton ID: 'global'"
  id: ID!

  "Total number of markets created"
  totalMarkets: Int!

  "Total number of resolved markets"
  resolvedMarkets: Int!

  "Total number of trades"
  totalTrades: Int!

  "Total volume (USDC)"
  totalVolume: BigInt!

  "Total fees collected"
  totalFees: BigInt!

  "Total unique users"
  totalUsers: Int!

  "Last updated block"
  lastUpdatedBlock: BigInt!

  "Last updated timestamp"
  lastUpdatedTimestamp: BigInt!
}

# =============================================================================
# DAILY STATISTICS (Time Series)
# =============================================================================

type DailyStats @entity {
  "Unique identifier - date (YYYY-MM-DD)"
  id: ID!

  "Unix timestamp for start of day"
  dayTimestamp: BigInt!

  "Number of new markets"
  newMarkets: Int!

  "Number of resolved markets"
  resolvedMarkets: Int!

  "Number of trades"
  tradeCount: Int!

  "Daily volume (USDC)"
  volume: BigInt!

  "Daily fees"
  fees: BigInt!

  "New users"
  newUsers: Int!

  "Active users (traded today)"
  activeUsers: Int!
}
```

### 5.2 Entity Relationships Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   Market    │◄──────│    Trade    │──────►│    User     │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ questionId  │       │ market      │       │ tradeCount  │
│ oracle      │       │ trader      │       │ totalVolume │
│ resolved    │       │ amount      │       │ positions   │
│ trades[]    │       │ price       │       │ trades[]    │
│ positions[] │       │ timestamp   │       └─────────────┘
└─────────────┘       └─────────────┘              │
       │                                           │
       │              ┌─────────────┐              │
       └─────────────►│  Position   │◄─────────────┘
                      ├─────────────┤
                      │ id          │
                      │ user        │
                      │ market      │
                      │ balance     │
                      │ realizedPnL │
                      └─────────────┘
```

---

## 6. Subgraph Manifest Configuration

### 6.1 Complete subgraph.yaml

```yaml
specVersion: 1.0.0
indexerHints:
  prune: auto
schema:
  file: ./schema.graphql
features:
  - fullTextSearch

dataSources:
  # ==========================================================================
  # CONDITIONAL TOKENS CONTRACT (Main Market Contract)
  # ==========================================================================
  - kind: ethereum
    name: ConditionalTokens
    network: matic
    source:
      address: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
      abi: ConditionalTokens
      startBlock: 16820000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Market
        - User
        - Position
        - Split
        - Merge
        - Redemption
        - TokenRegistry
        - GlobalStats
        - DailyStats
      abis:
        - name: ConditionalTokens
          file: ./abis/ConditionalTokens.json
      eventHandlers:
        # NOTE: Event signatures verified from Gnosis CTF documentation and Polymarket GitHub
        - event: ConditionPreparation(indexed bytes32,indexed address,indexed bytes32,uint256)
          handler: handleConditionPreparation
        - event: ConditionResolution(indexed bytes32,indexed address,indexed bytes32,uint256,uint256[])
          handler: handleConditionResolution
        - event: PositionSplit(indexed address,address,indexed bytes32,indexed bytes32,uint256[],uint256)
          handler: handlePositionSplit
        - event: PositionsMerge(indexed address,address,indexed bytes32,indexed bytes32,uint256[],uint256)
          handler: handlePositionsMerge
        - event: PayoutRedemption(indexed address,indexed address,indexed bytes32,bytes32,uint256[],uint256)
          handler: handlePayoutRedemption
        - event: TransferSingle(indexed address,indexed address,indexed address,uint256,uint256)
          handler: handleTransferSingle
        - event: TransferBatch(indexed address,indexed address,indexed address,uint256[],uint256[])
          handler: handleTransferBatch
      file: ./src/mappings/ctf.ts

  # ==========================================================================
  # CTF EXCHANGE (Legacy - Binary Markets)
  # ==========================================================================
  - kind: ethereum
    name: CTFExchange
    network: matic
    source:
      address: "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
      abi: CTFExchange
      startBlock: 33100000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Trade
        - User
        - Position
        - Market
        - MarketParticipation
        - TokenRegistry
        - GlobalStats
        - DailyStats
      abis:
        - name: CTFExchange
          file: ./abis/CTFExchange.json
        - name: ConditionalTokens
          file: ./abis/ConditionalTokens.json
      eventHandlers:
        - event: TokenRegistered(indexed uint256,indexed uint256,indexed bytes32)
          handler: handleTokenRegistered
        - event: OrderFilled(indexed bytes32,indexed address,indexed address,uint256,uint256,uint256,uint256,uint256)
          handler: handleOrderFilled
        # NOTE: OrdersMatched is NOT handled - it fires alongside OrderFilled and would cause duplicates
      file: ./src/mappings/exchange.ts

  # ==========================================================================
  # CTF EXCHANGE (NegRisk - Multi-Outcome Markets)
  # ==========================================================================
  - kind: ethereum
    name: NegRiskCTFExchange
    network: matic
    source:
      address: "0xC5d563A36AE78145C45a50134d48A1215220f80a"
      abi: CTFExchange
      startBlock: 49000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - Trade
        - User
        - Position
        - Market
        - MarketParticipation
        - TokenRegistry
        - GlobalStats
        - DailyStats
      abis:
        - name: CTFExchange
          file: ./abis/CTFExchange.json
        - name: ConditionalTokens
          file: ./abis/ConditionalTokens.json
      eventHandlers:
        - event: TokenRegistered(indexed uint256,indexed uint256,indexed bytes32)
          handler: handleTokenRegisteredNegRisk
        - event: OrderFilled(indexed bytes32,indexed address,indexed address,uint256,uint256,uint256,uint256,uint256)
          handler: handleOrderFilledNegRisk
        # NOTE: OrdersMatched is NOT handled - it fires alongside OrderFilled and would cause duplicates
      file: ./src/mappings/negRiskExchange.ts

  # ==========================================================================
  # NEGRISK ADAPTER (Handles position conversions for multi-outcome)
  # ==========================================================================
  - kind: ethereum
    name: NegRiskAdapter
    network: matic
    source:
      address: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296"
      abi: NegRiskAdapter
      startBlock: 49000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.9
      language: wasm/assemblyscript
      entities:
        - User
        - Position
        - Market
      abis:
        - name: NegRiskAdapter
          file: ./abis/NegRiskAdapter.json
        - name: ConditionalTokens
          file: ./abis/ConditionalTokens.json
      eventHandlers:
        # NOTE: Event signatures verified from Polymarket neg-risk-ctf-adapter GitHub
        - event: QuestionPrepared(indexed bytes32,indexed bytes32,uint256,bytes)
          handler: handleQuestionPrepared
        - event: PositionsConverted(indexed address,indexed bytes32,indexed uint256,uint256)
          handler: handlePositionsConverted
      file: ./src/mappings/negRiskAdapter.ts
```

---

## 7. Mapping Implementation

### 7.0 Critical Design Decisions

Before diving into code, these architectural decisions are **critical** for correctness:

#### 7.0.1 TokenRegistry for tokenId → Market/Outcome Mapping

**Problem**: CTF ERC-1155 `tokenId` values are opaque hashes. You cannot directly derive `conditionId` or `outcomeIndex` from them.

**Solution**: Maintain a `TokenRegistry` entity populated from two sources:

1. **`TokenRegistered` event** on exchanges - gives you `(tokenId, conditionId)` directly
2. **`PositionSplit` event** on CTF - derive tokenId using CTF math: `tokenId = getPositionId(collateral, getCollectionId(parentCollectionId, conditionId, indexSet))`

```typescript
// When handling TokenRegistered
export function handleTokenRegistered(event: TokenRegisteredEvent): void {
  let tokenId = event.params.token0; // or token1
  let conditionId = event.params.conditionId;

  let registry = new TokenRegistry(tokenId.toHexString());
  registry.tokenId = tokenId;
  registry.market = conditionId.toHexString();
  registry.outcomeIndex = deriveOutcomeFromIndexSet(indexSet);
  registry.save();
}
```

#### 7.0.2 Transfers as Single Source of Truth for Balances

**Problem**: Updating balances in both trade handlers AND transfer handlers causes double-counting.

**Solution**:
- **Transfers (TransferSingle/Batch)**: Update position balances
- **Trades (OrderFilled)**: Record analytics only (price, volume, fees, counterparties)

```typescript
// In handleOrderFilled - DO NOT update balances
trade.amount = amount;
trade.price = price;
trade.save();
// Balance updates happen in handleTransferSingle

// In handleTransferSingle - DO update balances
let fromPosition = getOrCreatePosition(from, market, tokenId);
fromPosition.balance = fromPosition.balance.minus(value);
fromPosition.save();

let toPosition = getOrCreatePosition(to, market, tokenId);
toPosition.balance = toPosition.balance.plus(value);
toPosition.save();
```

#### 7.0.3 Include Mint/Burn Transfers (Zero Address)

**Problem**: Skipping `from == 0x0` or `to == 0x0` causes incorrect balances after splits/merges/redemptions.

**Solution**: Process ALL transfers including mints (from zero) and burns (to zero).

```typescript
// In handleTransferSingle
let zeroAddress = Address.zero();

// Decrease sender balance (skip only if minting)
if (from.notEqual(zeroAddress)) {
  let fromPosition = getOrCreatePosition(from, market, tokenId);
  fromPosition.balance = fromPosition.balance.minus(value);
  fromPosition.save();
}

// Increase receiver balance (skip only if burning)
if (to.notEqual(zeroAddress)) {
  let toPosition = getOrCreatePosition(to, market, tokenId);
  toPosition.balance = toPosition.balance.plus(value);
  toPosition.save();
}
```

#### 7.0.4 Price Calculation with Proper Normalization

**Problem**: USDC has 6 decimals. Raw division produces wrong prices.

**Solution**: Normalize both legs before computing price.

```typescript
// Price is USDC per share, displayed as 0-1
// Both USDC and shares use 1e6 scale on Polymarket
export function calculatePrice(usdcAmount: BigInt, shareAmount: BigInt): BigDecimal {
  if (shareAmount.equals(ZERO_BI)) return ZERO_BD;

  // Convert to decimals: (usdc / 1e6) / (shares / 1e6) = usdc / shares
  let usdcDecimal = usdcAmount.toBigDecimal().div(USDC_SCALE.toBigDecimal());
  let shareDecimal = shareAmount.toBigDecimal().div(SHARE_SCALE.toBigDecimal());

  return usdcDecimal.div(shareDecimal);
}
```

#### 7.0.5 Trade Direction by Asset Type (Not Maker/Taker)

**Problem**: Makers can be buyers or sellers. Using maker/taker role to determine side is incorrect.

**Solution**: Compare asset IDs to determine which is the CTF token vs USDC collateral.

```typescript
export function determineTradeSide(
  makerAssetId: BigInt,
  takerAssetId: BigInt
): string {
  // If makerAssetId is a registered CTF token, maker is SELLING tokens
  let makerToken = TokenRegistry.load(makerAssetId.toHexString());

  if (makerToken != null) {
    // Maker is selling tokens, taker is buying
    return "BUY"; // From taker's perspective
  } else {
    // Maker is buying tokens with USDC, taker is selling
    return "SELL"; // From taker's perspective
  }
}
```

#### 7.0.6 Use OrderFilled Only (Not OrdersMatched)

**Problem**: Both events fire for the same trade, causing duplicates.

**Solution**: Index only `OrderFilled`. Do not create Trade entities from `OrdersMatched`.

#### 7.0.7 Handle PayoutRedemption for Post-Resolution

**Problem**: Without `PayoutRedemption`, positions never clear after market settlement.

**Solution**: Add handler that zeros out balances and records payout.

```typescript
export function handlePayoutRedemption(event: PayoutRedemptionEvent): void {
  // Record redemption
  let redemption = new Redemption(createTradeId(event));
  redemption.redeemer = event.params.redeemer.toHexString();
  redemption.market = event.params.conditionId.toHexString();
  redemption.payout = event.params.payout;
  redemption.save();

  // Note: Balance updates happen via TransferSingle (burn to zero address)
}
```

---

### 7.1 Constants (src/utils/constants.ts)

```typescript
import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";

// Contract Addresses
export const CTF_ADDRESS = Address.fromString(
  "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
);
export const LEGACY_EXCHANGE_ADDRESS = Address.fromString(
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"
);
export const NEGRISK_EXCHANGE_ADDRESS = Address.fromString(
  "0xC5d563A36AE78145C45a50134d48A1215220f80a"
);
export const USDC_ADDRESS = Address.fromString(
  "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
);

// Numeric Constants
export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");

// USDC has 6 decimals; Polymarket shares are also scaled by 1e6
export const USDC_DECIMALS = 6;
export const USDC_SCALE = BigInt.fromI32(10).pow(6 as u8); // 1e6
export const SHARE_SCALE = BigInt.fromI32(10).pow(6 as u8); // 1e6

// Entity IDs
export const GLOBAL_STATS_ID = "global";

// Exchange Types
export const EXCHANGE_LEGACY = "LEGACY";
export const EXCHANGE_NEGRISK = "NEGRISK";

// Trade Sides
export const SIDE_BUY = "BUY";
export const SIDE_SELL = "SELL";
```

### 7.2 Helper Functions (src/utils/helpers.ts)

```typescript
import { BigInt, BigDecimal, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  User,
  Market,
  Position,
  GlobalStats,
  DailyStats,
  MarketParticipation
} from "../../generated/schema";
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  GLOBAL_STATS_ID,
  USDC_DECIMALS
} from "./constants";

// =============================================================================
// ID Generation
// =============================================================================

export function createTradeId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
}

export function createPositionId(
  user: string,
  market: string,
  tokenId: BigInt
): string {
  return user + "-" + market + "-" + tokenId.toString();
}

export function createMarketParticipationId(user: string, market: string): string {
  return user + "-" + market;
}

export function createDailyStatsId(timestamp: BigInt): string {
  let dayTimestamp = timestamp.toI32() / 86400;
  return dayTimestamp.toString();
}

// =============================================================================
// Entity Loading/Creation
// =============================================================================

export function getOrCreateUser(address: Bytes): User {
  let id = address.toHexString();
  let user = User.load(id);

  if (user == null) {
    user = new User(id);
    user.tradeCount = 0;
    user.totalVolume = ZERO_BI;
    user.totalFeesPaid = ZERO_BI;
    user.marketsTraded = 0;
    user.firstTradeTimestamp = null;
    user.lastTradeTimestamp = null;
    user.firstTradeBlock = null;
    user.save();

    // Update global stats
    let stats = getOrCreateGlobalStats();
    stats.totalUsers = stats.totalUsers + 1;
    stats.save();
  }

  return user;
}

export function getOrCreateGlobalStats(): GlobalStats {
  let stats = GlobalStats.load(GLOBAL_STATS_ID);

  if (stats == null) {
    stats = new GlobalStats(GLOBAL_STATS_ID);
    stats.totalMarkets = 0;
    stats.resolvedMarkets = 0;
    stats.totalTrades = 0;
    stats.totalVolume = ZERO_BI;
    stats.totalFees = ZERO_BI;
    stats.totalUsers = 0;
    stats.lastUpdatedBlock = ZERO_BI;
    stats.lastUpdatedTimestamp = ZERO_BI;
    stats.save();
  }

  return stats;
}

export function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let id = createDailyStatsId(timestamp);
  let stats = DailyStats.load(id);

  if (stats == null) {
    stats = new DailyStats(id);
    let dayTimestamp = (timestamp.toI32() / 86400) * 86400;
    stats.dayTimestamp = BigInt.fromI32(dayTimestamp);
    stats.newMarkets = 0;
    stats.resolvedMarkets = 0;
    stats.tradeCount = 0;
    stats.volume = ZERO_BI;
    stats.fees = ZERO_BI;
    stats.newUsers = 0;
    stats.activeUsers = 0;
    stats.save();
  }

  return stats;
}

export function getOrCreatePosition(
  userId: string,
  marketId: string,
  tokenId: BigInt,
  outcomeIndex: i32
): Position {
  let id = createPositionId(userId, marketId, tokenId);
  let position = Position.load(id);

  if (position == null) {
    position = new Position(id);
    position.user = userId;
    position.market = marketId;
    position.tokenId = tokenId;
    position.outcomeIndex = outcomeIndex;
    position.balance = ZERO_BI;
    position.totalBought = ZERO_BI;
    position.totalSold = ZERO_BI;
    position.avgBuyPrice = ZERO_BD;
    position.avgSellPrice = ZERO_BD;
    position.realizedPnL = ZERO_BD;
    position.tradeCount = 0;
    position.lastUpdated = ZERO_BI;
    position.save();
  }

  return position;
}

export function getOrCreateMarketParticipation(
  userId: string,
  marketId: string,
  timestamp: BigInt
): MarketParticipation {
  let id = createMarketParticipationId(userId, marketId);
  let participation = MarketParticipation.load(id);

  if (participation == null) {
    participation = new MarketParticipation(id);
    participation.user = userId;
    participation.market = marketId;
    participation.tradeCount = 0;
    participation.volume = ZERO_BI;
    participation.firstTradeTimestamp = timestamp;
    participation.lastTradeTimestamp = timestamp;
    participation.save();

    // Update user's markets traded count
    let user = User.load(userId);
    if (user != null) {
      user.marketsTraded = user.marketsTraded + 1;
      user.save();
    }
  }

  return participation;
}

// =============================================================================
// Price Calculations
// =============================================================================

export function calculatePrice(
  makerAmount: BigInt,
  takerAmount: BigInt
): BigDecimal {
  if (takerAmount.equals(ZERO_BI)) {
    return ZERO_BD;
  }

  let makerBD = makerAmount.toBigDecimal();
  let takerBD = takerAmount.toBigDecimal();

  // Price = USDC / Tokens
  return makerBD.div(takerBD);
}

export function toUSDCDecimal(amount: BigInt): BigDecimal {
  let divisor = BigInt.fromI32(10).pow(6).toBigDecimal();
  return amount.toBigDecimal().div(divisor);
}

// =============================================================================
// Outcome Index Derivation
// =============================================================================

export function deriveOutcomeIndex(tokenId: BigInt, conditionId: Bytes): i32 {
  // For binary markets, tokenId encodes the outcome
  // This is a simplified version - may need adjustment based on actual CTF logic
  let tokenIdMod = tokenId.mod(BigInt.fromI32(2));
  return tokenIdMod.toI32();
}

export function deriveWinningOutcome(payoutNumerators: BigInt[]): i32 {
  if (payoutNumerators.length == 0) {
    return -1;
  }

  let maxIndex = 0;
  let maxValue = payoutNumerators[0];

  for (let i = 1; i < payoutNumerators.length; i++) {
    if (payoutNumerators[i].gt(maxValue)) {
      maxValue = payoutNumerators[i];
      maxIndex = i;
    }
  }

  return maxIndex;
}
```

### 7.3 CTF Mappings (src/mappings/ctf.ts)

```typescript
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ConditionPreparation as ConditionPreparationEvent,
  ConditionResolution as ConditionResolutionEvent,
  PositionSplit as PositionSplitEvent,
  PositionsMerge as PositionsMergeEvent,
  TransferSingle as TransferSingleEvent,
  TransferBatch as TransferBatchEvent
} from "../../generated/ConditionalTokens/ConditionalTokens";
import { Market, Split, Merge } from "../../generated/schema";
import {
  getOrCreateUser,
  getOrCreateGlobalStats,
  getOrCreateDailyStats,
  getOrCreatePosition,
  deriveWinningOutcome,
  createTradeId
} from "../utils/helpers";
import { ZERO_BI, ZERO_BD } from "../utils/constants";

// =============================================================================
// MARKET CREATION
// =============================================================================

export function handleConditionPreparation(event: ConditionPreparationEvent): void {
  let conditionId = event.params.conditionId.toHexString();

  // Create or load market
  let market = Market.load(conditionId);
  if (market == null) {
    market = new Market(conditionId);
  }

  // Set market fields from event
  market.questionId = event.params.questionId;
  market.oracle = event.params.oracle;
  market.outcomeSlotCount = event.params.outcomeSlotCount.toI32();
  market.creationTimestamp = event.block.timestamp;
  market.creationBlock = event.block.number;
  market.creationTxHash = event.transaction.hash;
  market.resolved = false;
  market.resolutionTimestamp = null;
  market.resolutionBlock = null;
  market.winningOutcome = null;
  market.payoutNumerators = null;

  // Initialize aggregations
  market.tradeCount = 0;
  market.totalVolume = ZERO_BI;
  market.uniqueTraders = 0;

  market.save();

  // Update global stats
  let globalStats = getOrCreateGlobalStats();
  globalStats.totalMarkets = globalStats.totalMarkets + 1;
  globalStats.lastUpdatedBlock = event.block.number;
  globalStats.lastUpdatedTimestamp = event.block.timestamp;
  globalStats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.newMarkets = dailyStats.newMarkets + 1;
  dailyStats.save();
}

// =============================================================================
// MARKET RESOLUTION
// =============================================================================

export function handleConditionResolution(event: ConditionResolutionEvent): void {
  let conditionId = event.params.conditionId.toHexString();

  let market = Market.load(conditionId);
  if (market == null) {
    // Market should exist, but create if not
    market = new Market(conditionId);
    market.questionId = event.params.questionId;
    market.oracle = event.params.oracle;
    market.outcomeSlotCount = event.params.outcomeSlotCount.toI32();
    market.creationTimestamp = event.block.timestamp;
    market.creationBlock = event.block.number;
    market.creationTxHash = event.transaction.hash;
    market.tradeCount = 0;
    market.totalVolume = ZERO_BI;
    market.uniqueTraders = 0;
  }

  // Update resolution fields
  market.resolved = true;
  market.resolutionTimestamp = event.block.timestamp;
  market.resolutionBlock = event.block.number;

  // Store payout numerators and derive winner
  let payoutNumerators: BigInt[] = [];
  for (let i = 0; i < event.params.payoutNumerators.length; i++) {
    payoutNumerators.push(event.params.payoutNumerators[i]);
  }
  market.payoutNumerators = payoutNumerators;

  // Determine winning outcome (index with highest payout)
  let winningOutcome = deriveWinningOutcome(payoutNumerators);
  if (winningOutcome >= 0) {
    market.winningOutcome = winningOutcome;
  }

  market.save();

  // Update global stats
  let globalStats = getOrCreateGlobalStats();
  globalStats.resolvedMarkets = globalStats.resolvedMarkets + 1;
  globalStats.lastUpdatedBlock = event.block.number;
  globalStats.lastUpdatedTimestamp = event.block.timestamp;
  globalStats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.resolvedMarkets = dailyStats.resolvedMarkets + 1;
  dailyStats.save();
}

// =============================================================================
// POSITION SPLIT (Minting Outcome Tokens)
// =============================================================================

export function handlePositionSplit(event: PositionSplitEvent): void {
  let id = createTradeId(event);

  let split = new Split(id);
  split.stakeholder = getOrCreateUser(event.params.stakeholder).id;
  split.market = event.params.conditionId.toHexString();
  split.amount = event.params.amount;
  split.timestamp = event.block.timestamp;
  split.blockNumber = event.block.number;
  split.transactionHash = event.transaction.hash;
  split.save();

  // Note: Position balances are updated via TransferSingle/Batch events
}

// =============================================================================
// POSITION MERGE (Burning Outcome Tokens)
// =============================================================================

export function handlePositionsMerge(event: PositionsMergeEvent): void {
  let id = createTradeId(event);

  let merge = new Merge(id);
  merge.stakeholder = getOrCreateUser(event.params.stakeholder).id;
  merge.market = event.params.conditionId.toHexString();
  merge.amount = event.params.amount;
  merge.timestamp = event.block.timestamp;
  merge.blockNumber = event.block.number;
  merge.transactionHash = event.transaction.hash;
  merge.save();

  // Note: Position balances are updated via TransferSingle/Batch events
}

// =============================================================================
// TOKEN TRANSFERS (ERC-1155)
// =============================================================================

export function handleTransferSingle(event: TransferSingleEvent): void {
  let from = event.params.from;
  let to = event.params.to;
  let tokenId = event.params.id;
  let value = event.params.value;

  // Skip zero address transfers (mint/burn handled by split/merge)
  let zeroAddress = Bytes.fromHexString("0x0000000000000000000000000000000000000000");

  // Update sender's position (decrease)
  if (from.notEqual(zeroAddress)) {
    let fromUser = getOrCreateUser(from);
    // Note: Would need to determine market from tokenId
    // This requires additional logic to map tokenId -> conditionId
  }

  // Update receiver's position (increase)
  if (to.notEqual(zeroAddress)) {
    let toUser = getOrCreateUser(to);
    // Note: Would need to determine market from tokenId
  }
}

export function handleTransferBatch(event: TransferBatchEvent): void {
  // Similar logic to TransferSingle but for arrays
  let from = event.params.from;
  let to = event.params.to;
  let ids = event.params.ids;
  let values = event.params.values;

  for (let i = 0; i < ids.length; i++) {
    // Process each transfer
    // Similar logic to handleTransferSingle
  }
}
```

### 7.4 Exchange Mappings (src/mappings/exchange.ts)

```typescript
import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  OrderFilled as OrderFilledEvent,
  OrdersMatched as OrdersMatchedEvent
} from "../../generated/CTFExchange/CTFExchange";
import { Trade, Market, User, Position } from "../../generated/schema";
import {
  createTradeId,
  getOrCreateUser,
  getOrCreateGlobalStats,
  getOrCreateDailyStats,
  getOrCreatePosition,
  getOrCreateMarketParticipation,
  calculatePrice,
  deriveOutcomeIndex
} from "../utils/helpers";
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  EXCHANGE_LEGACY,
  SIDE_BUY,
  SIDE_SELL
} from "../utils/constants";

// =============================================================================
// ORDER FILLED (Legacy Exchange)
// =============================================================================

export function handleOrderFilled(event: OrderFilledEvent): void {
  processOrderFilled(event, EXCHANGE_LEGACY);
}

function processOrderFilled(event: OrderFilledEvent, exchangeType: string): void {
  let tradeId = createTradeId(event);

  // Extract event parameters
  let orderHash = event.params.orderHash;
  let maker = event.params.maker;
  let taker = event.params.taker;
  let makerAssetId = event.params.makerAssetId;
  let takerAssetId = event.params.takerAssetId;
  let makerAmountFilled = event.params.makerAmountFilled;
  let takerAmountFilled = event.params.takerAmountFilled;
  let fee = event.params.fee;

  // Determine trade direction and market
  // In CTF Exchange:
  // - If maker is selling outcome tokens: makerAssetId = tokenId, takerAssetId = USDC amount
  // - If maker is buying outcome tokens: makerAssetId = USDC amount, takerAssetId = tokenId

  // For simplicity, assume makerAssetId is the outcome token
  // This needs refinement based on actual contract behavior
  let tokenId = makerAssetId;
  let usdcAmount = takerAmountFilled;
  let tokenAmount = makerAmountFilled;

  // Derive market from tokenId (simplified - may need contract call)
  // The tokenId encodes the conditionId and outcome index
  let conditionIdBytes = deriveConditionIdFromTokenId(tokenId);
  let marketId = conditionIdBytes.toHexString();

  // Load or create market (should exist from ConditionPreparation)
  let market = Market.load(marketId);
  if (market == null) {
    log.warning("Market not found for trade: {}", [marketId]);
    return;
  }

  // Get or create users
  let takerUser = getOrCreateUser(taker);
  let makerUser = getOrCreateUser(maker);

  // Create trade entity (from taker's perspective)
  let trade = new Trade(tradeId);
  trade.market = marketId;
  trade.trader = takerUser.id;
  trade.counterparty = makerUser.id;
  trade.tokenId = tokenId;
  trade.outcomeIndex = deriveOutcomeIndex(tokenId, conditionIdBytes);
  trade.side = SIDE_BUY; // Taker is buying
  trade.amount = tokenAmount;
  trade.price = calculatePrice(usdcAmount, tokenAmount);
  trade.cost = usdcAmount;
  trade.fee = fee;
  trade.timestamp = event.block.timestamp;
  trade.blockNumber = event.block.number;
  trade.transactionHash = event.transaction.hash;
  trade.logIndex = event.logIndex;
  trade.exchange = exchangeType;
  trade.save();

  // Update taker user stats
  updateUserStats(takerUser, usdcAmount, fee, event.block.timestamp, event.block.number);

  // Update maker user stats
  updateUserStats(makerUser, usdcAmount, ZERO_BI, event.block.timestamp, event.block.number);

  // Update market stats
  market.tradeCount = market.tradeCount + 1;
  market.totalVolume = market.totalVolume.plus(usdcAmount);
  market.save();

  // Update positions
  updatePositionForTrade(
    takerUser.id,
    marketId,
    tokenId,
    trade.outcomeIndex,
    tokenAmount,
    usdcAmount,
    true, // isBuy
    event.block.timestamp
  );

  updatePositionForTrade(
    makerUser.id,
    marketId,
    tokenId,
    trade.outcomeIndex,
    tokenAmount,
    usdcAmount,
    false, // isSell
    event.block.timestamp
  );

  // Update market participation
  let takerParticipation = getOrCreateMarketParticipation(
    takerUser.id,
    marketId,
    event.block.timestamp
  );
  takerParticipation.tradeCount = takerParticipation.tradeCount + 1;
  takerParticipation.volume = takerParticipation.volume.plus(usdcAmount);
  takerParticipation.lastTradeTimestamp = event.block.timestamp;
  takerParticipation.save();

  // Update global stats
  let globalStats = getOrCreateGlobalStats();
  globalStats.totalTrades = globalStats.totalTrades + 1;
  globalStats.totalVolume = globalStats.totalVolume.plus(usdcAmount);
  globalStats.totalFees = globalStats.totalFees.plus(fee);
  globalStats.lastUpdatedBlock = event.block.number;
  globalStats.lastUpdatedTimestamp = event.block.timestamp;
  globalStats.save();

  // Update daily stats
  let dailyStats = getOrCreateDailyStats(event.block.timestamp);
  dailyStats.tradeCount = dailyStats.tradeCount + 1;
  dailyStats.volume = dailyStats.volume.plus(usdcAmount);
  dailyStats.fees = dailyStats.fees.plus(fee);
  dailyStats.save();
}

// =============================================================================
// ORDERS MATCHED
// =============================================================================

export function handleOrdersMatched(event: OrdersMatchedEvent): void {
  // OrdersMatched is emitted alongside OrderFilled
  // Can be used for additional matching logic if needed
  // For now, we rely on OrderFilled for trade data
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function updateUserStats(
  user: User,
  volume: BigInt,
  fee: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  user.tradeCount = user.tradeCount + 1;
  user.totalVolume = user.totalVolume.plus(volume);
  user.totalFeesPaid = user.totalFeesPaid.plus(fee);

  if (user.firstTradeTimestamp == null) {
    user.firstTradeTimestamp = timestamp;
    user.firstTradeBlock = blockNumber;
  }
  user.lastTradeTimestamp = timestamp;

  user.save();
}

function updatePositionForTrade(
  userId: string,
  marketId: string,
  tokenId: BigInt,
  outcomeIndex: i32,
  amount: BigInt,
  cost: BigInt,
  isBuy: boolean,
  timestamp: BigInt
): void {
  let position = getOrCreatePosition(userId, marketId, tokenId, outcomeIndex);

  if (isBuy) {
    // Update average buy price
    let totalCost = position.avgBuyPrice
      .times(position.totalBought.toBigDecimal())
      .plus(cost.toBigDecimal());
    let totalAmount = position.totalBought.plus(amount);

    if (totalAmount.gt(ZERO_BI)) {
      position.avgBuyPrice = totalCost.div(totalAmount.toBigDecimal());
    }

    position.totalBought = totalAmount;
    position.balance = position.balance.plus(amount);
  } else {
    // Update average sell price and realized PnL
    let totalProceeds = position.avgSellPrice
      .times(position.totalSold.toBigDecimal())
      .plus(cost.toBigDecimal());
    let totalAmount = position.totalSold.plus(amount);

    if (totalAmount.gt(ZERO_BI)) {
      position.avgSellPrice = totalProceeds.div(totalAmount.toBigDecimal());
    }

    position.totalSold = totalAmount;
    position.balance = position.balance.minus(amount);

    // Calculate realized PnL for this sale
    let costBasis = position.avgBuyPrice.times(amount.toBigDecimal());
    let proceeds = cost.toBigDecimal();
    let pnl = proceeds.minus(costBasis);
    position.realizedPnL = position.realizedPnL.plus(pnl);
  }

  position.tradeCount = position.tradeCount + 1;
  position.lastUpdated = timestamp;
  position.save();
}

function getMarketFromTokenId(tokenId: BigInt): string | null {
  // CRITICAL: Use TokenRegistry to look up the market
  // TokenRegistry is populated by handleTokenRegistered from exchange contracts
  let registry = TokenRegistry.load(tokenId.toHexString());

  if (registry == null) {
    log.warning("TokenRegistry not found for tokenId: {}", [tokenId.toString()]);
    return null;
  }

  return registry.market;
}

function getOutcomeIndexFromTokenId(tokenId: BigInt): i32 {
  let registry = TokenRegistry.load(tokenId.toHexString());
  if (registry == null) return -1;
  return registry.outcomeIndex;
}
```

### 7.5 NegRisk Exchange Mappings (src/mappings/negRiskExchange.ts)

```typescript
import {
  OrderFilled as OrderFilledEvent,
  OrdersMatched as OrdersMatchedEvent
} from "../../generated/NegRiskCTFExchange/CTFExchange";
import { EXCHANGE_NEGRISK } from "../utils/constants";

// Re-export with different exchange type
export function handleOrderFilledNegRisk(event: OrderFilledEvent): void {
  // Use the same logic as legacy but mark as NegRisk
  // Import and call shared processing function
}

export function handleOrdersMatchedNegRisk(event: OrdersMatchedEvent): void {
  // Same as legacy
}
```

---

## 8. Local Development Setup

### 8.1 Docker Compose Configuration

```yaml
# docker/docker-compose.yml
version: '3'
services:
  graph-node:
    image: graphprotocol/graph-node:v0.34.0
    ports:
      - '8000:8000'   # GraphQL HTTP
      - '8001:8001'   # GraphQL WS
      - '8020:8020'   # JSON-RPC admin
      - '8030:8030'   # Subgraph indexing status
      - '8040:8040'   # Metrics
    depends_on:
      - ipfs
      - postgres
    extra_hosts:
      - host.docker.internal:host-gateway
    environment:
      postgres_host: postgres
      postgres_user: graph-node
      postgres_pass: let-me-in
      postgres_db: graph-node
      ipfs: 'ipfs:5001'
      ethereum: 'matic:https://polygon-rpc.com'
      GRAPH_LOG: info
      GRAPH_ETHEREUM_CLEANUP_BLOCKS: 'true'
      ETHEREUM_REORG_THRESHOLD: 50
      ETHEREUM_ANCESTOR_COUNT: 50

  ipfs:
    image: ipfs/kubo:v0.17.0
    ports:
      - '5001:5001'
    volumes:
      - ./data/ipfs:/data/ipfs

  postgres:
    image: postgres:14
    ports:
      - '5432:5432'
    command:
      [
        "postgres",
        "-cshared_preload_libraries=pg_stat_statements",
        "-cmax_connections=200"
      ]
    environment:
      POSTGRES_USER: graph-node
      POSTGRES_PASSWORD: let-me-in
      POSTGRES_DB: graph-node
      PGDATA: "/var/lib/postgresql/data"
      POSTGRES_INITDB_ARGS: "-E UTF8 --locale=C"
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
```

### 8.2 Local Development Commands

```bash
# Start local Graph Node
cd docker && docker-compose up -d

# Check logs
docker-compose logs -f graph-node

# Create subgraph on local node
graph create --node http://localhost:8020/ polymarket-subgraph

# Deploy to local node
graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 polymarket-subgraph

# Query local GraphQL endpoint
# http://localhost:8000/subgraphs/name/polymarket-subgraph

# Remove subgraph
graph remove --node http://localhost:8020/ polymarket-subgraph

# Stop and clean up
docker-compose down -v
```

### 8.3 Testing with Limited Blocks

For faster iteration, modify `subgraph.yaml` to use recent blocks:

```yaml
# For testing - index only last 10,000 blocks
source:
  address: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045"
  abi: ConditionalTokens
  startBlock: 60000000  # Recent block for testing
```

---

## 9. Deployment Process

### 9.1 Subgraph Studio Deployment

```bash
# 1. Install Graph CLI globally
npm install -g @graphprotocol/graph-cli

# 2. Authenticate with Subgraph Studio
# Get deploy key from https://thegraph.com/studio/
graph auth --studio <DEPLOY_KEY>

# 3. Generate code from schema
graph codegen

# 4. Build the subgraph
graph build

# 5. Deploy to Subgraph Studio
graph deploy --studio polymarket-subgraph

# 6. For versioned releases
graph deploy --studio polymarket-subgraph --version-label v1.0.0
```

### 9.2 Monitoring Indexing Progress

After deployment, monitor via:

1. **Subgraph Studio Dashboard**: https://thegraph.com/studio/
   - View sync progress percentage
   - Check for indexing errors
   - Monitor query metrics

2. **GraphQL Status Query**:
```graphql
{
  _meta {
    block {
      number
      hash
    }
    deployment
    hasIndexingErrors
  }
}
```

3. **Indexing Status API**:
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "{ indexingStatusForCurrentVersion(subgraphName: \"polymarket-subgraph\") { synced health fatalError { message } chains { chainHeadBlock { number } latestBlock { number } } } }"}' \
  https://api.thegraph.com/index-node/graphql
```

### 9.3 Expected Sync Times

| Contract | Start Block | Blocks to Index | Estimated Time |
|----------|-------------|-----------------|----------------|
| CTF | 16,820,000 | ~48M | 7-14 days |
| Legacy Exchange | 33,100,000 | ~32M | 5-10 days |
| NegRisk Exchange | 49,000,000 | ~16M | 2-4 days |

**Total**: 3-14 days depending on event density and network conditions.

---

## 10. GraphQL Query Examples

### 10.1 Market Queries

```graphql
# Get all markets with pagination
query GetMarkets($first: Int!, $skip: Int!) {
  markets(
    first: $first
    skip: $skip
    orderBy: creationTimestamp
    orderDirection: desc
  ) {
    id
    questionId
    oracle
    outcomeSlotCount
    creationTimestamp
    resolved
    resolutionTimestamp
    winningOutcome
    tradeCount
    totalVolume
    uniqueTraders
  }
}

# Get resolved markets
query GetResolvedMarkets {
  markets(
    where: { resolved: true }
    orderBy: resolutionTimestamp
    orderDirection: desc
    first: 100
  ) {
    id
    winningOutcome
    payoutNumerators
    resolutionTimestamp
    tradeCount
    totalVolume
  }
}

# Get market by ID
query GetMarket($id: ID!) {
  market(id: $id) {
    id
    questionId
    oracle
    outcomeSlotCount
    creationTimestamp
    resolved
    winningOutcome
    tradeCount
    totalVolume
    trades(first: 100, orderBy: timestamp, orderDirection: desc) {
      id
      trader { id }
      side
      amount
      price
      timestamp
    }
  }
}
```

### 10.2 Trade Queries

```graphql
# Get trades for a market
query GetMarketTrades($marketId: ID!, $first: Int!, $skip: Int!) {
  trades(
    where: { market: $marketId }
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    trader { id }
    counterparty { id }
    outcomeIndex
    side
    amount
    price
    cost
    fee
    timestamp
    transactionHash
  }
}

# Get trades by time range
query GetTradesByTimeRange($start: BigInt!, $end: BigInt!) {
  trades(
    where: { timestamp_gte: $start, timestamp_lt: $end }
    orderBy: timestamp
    orderDirection: asc
  ) {
    id
    market { id }
    trader { id }
    amount
    price
    timestamp
  }
}

# Get large trades (whales)
query GetLargeTrades($minAmount: BigInt!) {
  trades(
    where: { amount_gte: $minAmount }
    orderBy: amount
    orderDirection: desc
    first: 100
  ) {
    id
    market { id }
    trader { id }
    amount
    price
    cost
    timestamp
  }
}
```

### 10.3 User Queries

```graphql
# Get user profile and stats
query GetUser($id: ID!) {
  user(id: $id) {
    id
    tradeCount
    totalVolume
    totalFeesPaid
    marketsTraded
    firstTradeTimestamp
    lastTradeTimestamp
    positions(first: 100) {
      market { id resolved winningOutcome }
      outcomeIndex
      balance
      avgBuyPrice
      realizedPnL
    }
  }
}

# Get top traders by volume
query GetTopTraders($first: Int!) {
  users(
    first: $first
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

# Get user's trades
query GetUserTrades($userId: ID!, $first: Int!, $skip: Int!) {
  trades(
    where: { trader: $userId }
    first: $first
    skip: $skip
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    market { id }
    outcomeIndex
    side
    amount
    price
    timestamp
  }
}
```

### 10.4 Position Queries

```graphql
# Get user positions in a market
query GetUserMarketPositions($userId: ID!, $marketId: ID!) {
  positions(
    where: { user: $userId, market: $marketId }
  ) {
    id
    outcomeIndex
    balance
    totalBought
    totalSold
    avgBuyPrice
    avgSellPrice
    realizedPnL
    tradeCount
  }
}

# Get all open positions (non-zero balance)
query GetOpenPositions($first: Int!, $skip: Int!) {
  positions(
    where: { balance_gt: "0" }
    first: $first
    skip: $skip
    orderBy: balance
    orderDirection: desc
  ) {
    id
    user { id }
    market { id resolved }
    outcomeIndex
    balance
    avgBuyPrice
  }
}
```

### 10.5 Analytics Queries

```graphql
# Get global statistics
query GetGlobalStats {
  globalStats(id: "global") {
    totalMarkets
    resolvedMarkets
    totalTrades
    totalVolume
    totalFees
    totalUsers
    lastUpdatedBlock
    lastUpdatedTimestamp
  }
}

# Get daily statistics
query GetDailyStats($days: Int!) {
  dailyStats(
    first: $days
    orderBy: dayTimestamp
    orderDirection: desc
  ) {
    id
    dayTimestamp
    newMarkets
    resolvedMarkets
    tradeCount
    volume
    fees
    newUsers
    activeUsers
  }
}

# Volume by market (top markets)
query GetTopMarketsByVolume($first: Int!) {
  markets(
    first: $first
    orderBy: totalVolume
    orderDirection: desc
  ) {
    id
    totalVolume
    tradeCount
    uniqueTraders
    resolved
  }
}
```

### 10.6 Complex Analytical Queries

```graphql
# User PnL analysis
query GetUserPnLAnalysis($userId: ID!) {
  user(id: $userId) {
    id
    totalVolume
    positions(where: { realizedPnL_not: "0" }) {
      market {
        id
        resolved
        winningOutcome
      }
      outcomeIndex
      realizedPnL
      avgBuyPrice
      avgSellPrice
      totalBought
      totalSold
    }
  }
}

# Market maker identification (high trade count)
query GetPotentialMarketMakers {
  users(
    where: { tradeCount_gte: 1000 }
    orderBy: tradeCount
    orderDirection: desc
    first: 50
  ) {
    id
    tradeCount
    totalVolume
    marketsTraded
  }
}
```

---

## 11. Data Validation Strategy

### 11.1 Validation Scripts

#### Count Verification (scripts/validate-counts.ts)

```typescript
import { ethers } from "ethers";
import fetch from "node-fetch";

const SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/your-subgraph";
const RPC_URL = "https://polygon-rpc.com";
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

const CTF_ABI = [
  "event ConditionPreparation(bytes32 indexed conditionId, address indexed oracle, bytes32 questionId, uint256 outcomeSlotCount)"
];

async function validateMarketCount(): Promise<void> {
  // Query subgraph for market count
  const subgraphQuery = `{
    globalStats(id: "global") {
      totalMarkets
    }
  }`;

  const subgraphResponse = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: subgraphQuery })
  });

  const subgraphData = await subgraphResponse.json();
  const subgraphMarkets = subgraphData.data.globalStats.totalMarkets;

  // Query on-chain events
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CTF_ADDRESS, CTF_ABI, provider);
  const filter = contract.filters.ConditionPreparation();

  // Get events in batches (Polygon has block limits)
  const START_BLOCK = 16820000;
  const END_BLOCK = await provider.getBlockNumber();
  const BATCH_SIZE = 10000;

  let totalEvents = 0;
  for (let fromBlock = START_BLOCK; fromBlock < END_BLOCK; fromBlock += BATCH_SIZE) {
    const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, END_BLOCK);
    const events = await contract.queryFilter(filter, fromBlock, toBlock);
    totalEvents += events.length;
  }

  console.log(`Subgraph markets: ${subgraphMarkets}`);
  console.log(`On-chain events: ${totalEvents}`);

  const diff = Math.abs(subgraphMarkets - totalEvents);
  const tolerance = 0.001; // 0.1%

  if (diff / totalEvents > tolerance) {
    console.error(`VALIDATION FAILED: ${diff} market count difference`);
    process.exit(1);
  } else {
    console.log("VALIDATION PASSED: Market count matches");
  }
}

validateMarketCount().catch(console.error);
```

#### Balance Reconciliation (scripts/validate-balances.ts)

```typescript
import { ethers } from "ethers";
import fetch from "node-fetch";

const SUBGRAPH_URL = "https://api.thegraph.com/subgraphs/name/your-subgraph";
const RPC_URL = "https://polygon-rpc.com";
const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

const CTF_ABI = [
  "function balanceOf(address owner, uint256 id) view returns (uint256)"
];

async function validateUserBalances(sampleSize: number = 100): Promise<void> {
  // Get sample of positions from subgraph
  const query = `{
    positions(
      first: ${sampleSize}
      where: { balance_gt: "0" }
      orderBy: balance
      orderDirection: desc
    ) {
      id
      user { id }
      tokenId
      balance
    }
  }`;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  const positions = data.data.positions;

  // Verify each position against on-chain
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CTF_ADDRESS, CTF_ABI, provider);

  let passed = 0;
  let failed = 0;

  for (const position of positions) {
    const onChainBalance = await contract.balanceOf(
      position.user.id,
      position.tokenId
    );

    const subgraphBalance = BigInt(position.balance);

    if (onChainBalance === subgraphBalance) {
      passed++;
    } else {
      failed++;
      console.error(`Balance mismatch for ${position.id}:`);
      console.error(`  Subgraph: ${subgraphBalance}`);
      console.error(`  On-chain: ${onChainBalance}`);
    }
  }

  console.log(`Validated ${positions.length} positions`);
  console.log(`Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

validateUserBalances().catch(console.error);
```

#### Random Sample Spot-Check (scripts/validate-samples.ts)

```typescript
import { ethers } from "ethers";
import fetch from "node-fetch";

async function validateRandomTrades(sampleSize: number = 50): Promise<void> {
  // Get random trades from subgraph
  const query = `{
    trades(first: ${sampleSize}, orderBy: timestamp, orderDirection: desc) {
      id
      transactionHash
      logIndex
      amount
      cost
    }
  }`;

  const response = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });

  const data = await response.json();
  const trades = data.data.trades;

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  let validated = 0;
  let errors = 0;

  for (const trade of trades) {
    try {
      const receipt = await provider.getTransactionReceipt(trade.transactionHash);

      if (!receipt) {
        console.error(`Transaction not found: ${trade.transactionHash}`);
        errors++;
        continue;
      }

      // Verify log exists at the expected index
      const logIndex = parseInt(trade.logIndex);
      if (logIndex >= receipt.logs.length) {
        console.error(`Log index out of range for ${trade.id}`);
        errors++;
        continue;
      }

      validated++;
    } catch (error) {
      console.error(`Error validating ${trade.id}:`, error);
      errors++;
    }
  }

  console.log(`Validated: ${validated}/${trades.length}`);
  console.log(`Errors: ${errors}`);

  if (errors > trades.length * 0.05) { // Allow 5% error rate
    process.exit(1);
  }
}

validateRandomTrades().catch(console.error);
```

### 11.2 Comparison with Official Subgraph

```typescript
// scripts/compare-subgraphs.ts

const OUR_SUBGRAPH = "https://api.thegraph.com/subgraphs/name/your-subgraph";
const OFFICIAL_SUBGRAPH = "https://api.thegraph.com/subgraphs/name/polymarket/matic-markets";

async function compareSubgraphs(): Promise<void> {
  // Compare market counts
  const marketQuery = `{ markets(first: 1000) { id } }`;

  const [ourResult, officialResult] = await Promise.all([
    fetch(OUR_SUBGRAPH, {
      method: "POST",
      body: JSON.stringify({ query: marketQuery })
    }).then(r => r.json()),
    fetch(OFFICIAL_SUBGRAPH, {
      method: "POST",
      body: JSON.stringify({ query: marketQuery })
    }).then(r => r.json())
  ]);

  const ourMarkets = new Set(ourResult.data.markets.map(m => m.id));
  const officialMarkets = new Set(officialResult.data.markets.map(m => m.id));

  // Find differences
  const missingInOurs = [...officialMarkets].filter(id => !ourMarkets.has(id));
  const extraInOurs = [...ourMarkets].filter(id => !officialMarkets.has(id));

  console.log(`Our markets: ${ourMarkets.size}`);
  console.log(`Official markets: ${officialMarkets.size}`);
  console.log(`Missing in ours: ${missingInOurs.length}`);
  console.log(`Extra in ours: ${extraInOurs.length}`);

  if (missingInOurs.length > 0) {
    console.log("Missing market IDs:", missingInOurs.slice(0, 10));
  }
}

compareSubgraphs().catch(console.error);
```

### 11.3 Automated CI/CD Pipeline

```yaml
# .github/workflows/validate.yml
name: Subgraph Validation

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:        # Manual trigger

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Validate market counts
        run: npx ts-node scripts/validate-counts.ts
        env:
          SUBGRAPH_URL: ${{ secrets.SUBGRAPH_URL }}
          RPC_URL: ${{ secrets.POLYGON_RPC_URL }}

      - name: Validate balances
        run: npx ts-node scripts/validate-balances.ts
        env:
          SUBGRAPH_URL: ${{ secrets.SUBGRAPH_URL }}
          RPC_URL: ${{ secrets.POLYGON_RPC_URL }}

      - name: Validate random samples
        run: npx ts-node scripts/validate-samples.ts
        env:
          SUBGRAPH_URL: ${{ secrets.SUBGRAPH_URL }}
          RPC_URL: ${{ secrets.POLYGON_RPC_URL }}

      - name: Compare with official
        run: npx ts-node scripts/compare-subgraphs.ts
        env:
          SUBGRAPH_URL: ${{ secrets.SUBGRAPH_URL }}

      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Subgraph validation failed! Check GitHub Actions for details."
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 12. Off-Chain Data Integration

### 12.1 Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA PIPELINE                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐        ┌─────────────┐        ┌──────────┐ │
│  │  Subgraph   │        │   Gamma     │        │  Your    │ │
│  │  (On-Chain) │        │   API       │        │  App/DB  │ │
│  └──────┬──────┘        └──────┬──────┘        └────┬─────┘ │
│         │                      │                    │       │
│         │  conditionId         │  conditionId       │       │
│         └──────────┬───────────┘                    │       │
│                    │                                │       │
│              ┌─────▼─────┐                          │       │
│              │   JOIN    │                          │       │
│              │   Worker  │──────────────────────────┘       │
│              └───────────┘                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 12.2 Gamma API Integration Worker

```typescript
// scripts/gamma-enrichment-worker.ts

import fetch from "node-fetch";

const SUBGRAPH_URL = "your-subgraph-url";
const GAMMA_API = "https://gamma-api.polymarket.com";

interface GammaMarket {
  condition_id: string;
  question: string;
  description: string;
  category: string;
  end_date: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
  }>;
}

interface EnrichedMarket {
  conditionId: string;
  questionId: string;
  // On-chain data
  oracle: string;
  outcomeSlotCount: number;
  resolved: boolean;
  winningOutcome: number | null;
  totalVolume: string;
  // Off-chain data from Gamma
  question: string;
  description: string;
  category: string;
  endDate: string;
  outcomes: string[];
}

async function enrichMarketsWithGamma(): Promise<EnrichedMarket[]> {
  // 1. Fetch markets from subgraph
  const subgraphQuery = `{
    markets(first: 1000, orderBy: creationTimestamp, orderDirection: desc) {
      id
      questionId
      oracle
      outcomeSlotCount
      resolved
      winningOutcome
      totalVolume
    }
  }`;

  const subgraphResponse = await fetch(SUBGRAPH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: subgraphQuery })
  });

  const subgraphData = await subgraphResponse.json();
  const onChainMarkets = subgraphData.data.markets;

  // 2. Fetch market metadata from Gamma
  const gammaResponse = await fetch(`${GAMMA_API}/markets`);
  const gammaMarkets: GammaMarket[] = await gammaResponse.json();

  // 3. Create lookup map by condition_id
  const gammaLookup = new Map<string, GammaMarket>();
  for (const market of gammaMarkets) {
    gammaLookup.set(market.condition_id.toLowerCase(), market);
  }

  // 4. Join data
  const enrichedMarkets: EnrichedMarket[] = [];

  for (const onChain of onChainMarkets) {
    const gamma = gammaLookup.get(onChain.id.toLowerCase());

    enrichedMarkets.push({
      conditionId: onChain.id,
      questionId: onChain.questionId,
      oracle: onChain.oracle,
      outcomeSlotCount: onChain.outcomeSlotCount,
      resolved: onChain.resolved,
      winningOutcome: onChain.winningOutcome,
      totalVolume: onChain.totalVolume,
      // Gamma data (with fallbacks)
      question: gamma?.question || "Unknown",
      description: gamma?.description || "",
      category: gamma?.category || "Uncategorized",
      endDate: gamma?.end_date || "",
      outcomes: gamma?.tokens.map(t => t.outcome) || []
    });
  }

  return enrichedMarkets;
}

// Store in database or export to file
async function main(): Promise<void> {
  const enrichedMarkets = await enrichMarketsWithGamma();

  console.log(`Enriched ${enrichedMarkets.length} markets`);

  // Write to file for analysis
  const fs = await import("fs/promises");
  await fs.writeFile(
    "enriched-markets.json",
    JSON.stringify(enrichedMarkets, null, 2)
  );
}

main().catch(console.error);
```

### 12.3 Gamma API Endpoints

| Endpoint | Purpose | Join Key |
|----------|---------|----------|
| `GET /markets` | List all markets | `condition_id` |
| `GET /markets/{id}` | Get market by ID | `condition_id` |
| `GET /events` | Get event groups | `condition_id` |

**Example Gamma Response**:
```json
{
  "condition_id": "0x3f2a...",
  "question": "Will Bitcoin reach $100k in 2024?",
  "description": "This market resolves to Yes if...",
  "category": "Crypto",
  "end_date": "2024-12-31T23:59:59Z",
  "tokens": [
    { "token_id": "1234", "outcome": "Yes" },
    { "token_id": "5678", "outcome": "No" }
  ],
  "market_slug": "bitcoin-100k-2024",
  "image": "https://..."
}
```

---

## 13. Timeline & Milestones

### Phase 1: Project Setup (Days 1-3)

**Objectives**:
- Initialize project structure
- Obtain and verify contract ABIs
- Set up development environment

**Tasks**:
- [ ] Create Git repository
- [ ] Initialize npm project with dependencies
- [ ] Fetch ABIs from PolygonScan
- [ ] Verify contract start blocks
- [ ] Set up Docker environment for local Graph Node

**Deliverables**:
- Complete project structure
- Verified ABIs in `/abis`
- Working local development environment

---

### Phase 2: Schema Design (Days 4-7)

**Objectives**:
- Design comprehensive GraphQL schema
- Define all entity relationships
- Plan aggregation strategies

**Tasks**:
- [ ] Define Market entity with all fields
- [ ] Define Trade, User, Position entities
- [ ] Design time-series entities (DailyStats)
- [ ] Add indexes and relationships
- [ ] Review against research requirements

**Deliverables**:
- Complete `schema.graphql`
- Entity relationship documentation

---

### Phase 3: Mapping Implementation (Days 8-15)

**Objectives**:
- Implement all event handlers
- Create helper utilities
- Handle edge cases

**Tasks**:
- [ ] Implement CTF mappings (market create/resolve)
- [ ] Implement exchange mappings (trades)
- [ ] Create utility functions (ID generation, pricing)
- [ ] Handle position balance updates
- [ ] Implement global/daily stats updates

**Deliverables**:
- Complete mapping code in `/src`
- Utility functions for common operations

---

### Phase 4: Local Testing (Days 16-20)

**Objectives**:
- Test with local Graph Node
- Debug and optimize mappings
- Verify data accuracy

**Tasks**:
- [ ] Deploy to local Graph Node
- [ ] Test with limited block range
- [ ] Verify entity relationships
- [ ] Optimize for performance
- [ ] Fix any indexing errors

**Deliverables**:
- Working local deployment
- Test results documentation

---

### Phase 5: Deployment (Days 21-25)

**Objectives**:
- Deploy to Subgraph Studio
- Monitor initial sync
- Handle any errors

**Tasks**:
- [ ] Create Subgraph Studio account
- [ ] Authenticate with deploy key
- [ ] Deploy subgraph
- [ ] Monitor indexing progress
- [ ] Address any sync errors

**Deliverables**:
- Live subgraph on Subgraph Studio
- Indexing progress monitoring

---

### Phase 6: Sync & Validation (Days 26-35)

**Objectives**:
- Wait for full historical sync
- Validate data completeness
- Compare with official sources

**Tasks**:
- [ ] Monitor sync progress (3-14 days)
- [ ] Run validation scripts
- [ ] Compare with official Polymarket subgraph
- [ ] Fix any discrepancies
- [ ] Document data quality metrics

**Deliverables**:
- Fully synced subgraph
- Validation reports
- Data quality documentation

---

### Phase 7: Documentation & Analysis (Days 36-40)

**Objectives**:
- Complete documentation
- Create sample queries
- Begin data analysis

**Tasks**:
- [ ] Document all entities and fields
- [ ] Create query cookbook
- [ ] Set up Gamma enrichment worker
- [ ] Begin research analysis
- [ ] Create monitoring dashboards

**Deliverables**:
- Complete documentation
- Query examples
- Initial research insights

---

## 14. Troubleshooting

### 14.1 Common Issues

#### Indexing Errors

**Problem**: Subgraph fails to index with handler errors

**Solutions**:
1. Check entity loading returns null safety
2. Verify BigInt operations don't overflow
3. Ensure all required fields are set before `save()`
4. Check for correct event signature in ABI

```typescript
// BAD - May crash if market doesn't exist
let market = Market.load(id);
market.tradeCount = market.tradeCount + 1; // Null pointer!

// GOOD - Handle null case
let market = Market.load(id);
if (market == null) {
  log.warning("Market not found: {}", [id]);
  return;
}
market.tradeCount = market.tradeCount + 1;
```

#### Slow Syncing

**Problem**: Indexing takes longer than expected

**Solutions**:
1. Reduce entity saves (batch updates)
2. Avoid unnecessary entity loads
3. Use correct start blocks
4. Check RPC endpoint performance

```typescript
// BAD - Loads entity twice
let user = getOrCreateUser(address);
user.tradeCount = user.tradeCount + 1;
user.save();

let sameUser = User.load(address);  // Unnecessary!
sameUser.totalVolume = ...;
sameUser.save();

// GOOD - Single load and save
let user = getOrCreateUser(address);
user.tradeCount = user.tradeCount + 1;
user.totalVolume = user.totalVolume.plus(volume);
user.save();  // Single save
```

#### Data Mismatches

**Problem**: Subgraph data doesn't match on-chain

**Solutions**:
1. Verify event signatures match ABI exactly
2. Check for missed events (wrong start block)
3. Ensure all relevant contracts are indexed
4. Handle chain reorgs correctly

### 14.2 Debugging Commands

```bash
# Check indexing status
curl -X POST \
  -d '{"query": "{ indexingStatuses { subgraph synced health } }"}' \
  http://localhost:8030/graphql

# View Graph Node logs
docker logs -f graph-node --tail 100

# Check for fatal errors
graph indexer status --network matic polymarket-subgraph

# Rebuild from scratch
graph remove --node http://localhost:8020/ polymarket-subgraph
graph create --node http://localhost:8020/ polymarket-subgraph
graph deploy --node http://localhost:8020/ polymarket-subgraph
```

### 14.3 Performance Optimization

1. **Use Bytes instead of String for addresses**
   - More efficient storage and comparison

2. **Avoid redundant saves**
   - Batch entity updates when possible

3. **Use correct data types**
   - `BigInt` for token amounts
   - `BigDecimal` for prices
   - `Int` for counters

4. **Index selectively**
   - Only index events you need
   - Use appropriate start blocks

---

## 15. References

### Official Documentation

- [The Graph Documentation](https://thegraph.com/docs/)
- [AssemblyScript API Reference](https://thegraph.com/docs/en/developing/graph-ts/api/)
- [Subgraph Manifest Specification](https://thegraph.com/docs/en/developing/creating-a-subgraph/)
- [Polymarket Developer Docs](https://docs.polymarket.com/)

### Contract References

- [Conditional Tokens Framework](https://conditional-tokens.readthedocs.io/)
- [CTF Contract on PolygonScan](https://polygonscan.com/address/0x4D97DCd97eC945f40cF65F87097ACe5EA0476045)
- [CTF Exchange on PolygonScan](https://polygonscan.com/address/0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E)

### Related Resources

- [Polymarket Subgraph GitHub](https://github.com/Polymarket/polymarket-subgraph)
- [The Graph Network Explorer](https://thegraph.com/explorer)
- [Bitquery Polymarket API Docs](https://docs.bitquery.io/docs/examples/polymarket-api/)

### Tools

- [Graph CLI](https://www.npmjs.com/package/@graphprotocol/graph-cli)
- [Matchstick Testing Framework](https://thegraph.com/docs/en/developing/unit-testing-framework/)
- [Graph Node Docker](https://github.com/graphprotocol/graph-node/tree/master/docker)

---

## Appendix A: ABI Acquisition

### From PolygonScan

1. Navigate to contract page
2. Go to "Contract" tab
3. Click "Contract ABI" → "Export ABI"
4. Save as JSON file

### Using Script

```bash
#!/bin/bash
# scripts/fetch-abis.sh

API_KEY="YOUR_POLYGONSCAN_API_KEY"

# Conditional Tokens
curl "https://api.polygonscan.com/api?module=contract&action=getabi&address=0x4D97DCd97eC945f40cF65F87097ACe5EA0476045&apikey=$API_KEY" | jq -r '.result' > abis/ConditionalTokens.json

# CTF Exchange
curl "https://api.polygonscan.com/api?module=contract&action=getabi&address=0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E&apikey=$API_KEY" | jq -r '.result' > abis/CTFExchange.json

# NegRisk Exchange
curl "https://api.polygonscan.com/api?module=contract&action=getabi&address=0xC5d563A36AE78145C45a50134d48A1215220f80a&apikey=$API_KEY" | jq -r '.result' > abis/NegRiskCTFExchange.json

echo "ABIs fetched successfully"
```

---

## Appendix B: Useful GraphQL Patterns

### Pagination with Cursor

```graphql
query PaginatedTrades($lastId: ID!, $first: Int!) {
  trades(
    first: $first
    where: { id_gt: $lastId }
    orderBy: id
    orderDirection: asc
  ) {
    id
    amount
    price
    timestamp
  }
}
```

### Full-Text Search (if enabled)

```graphql
query SearchMarkets($text: String!) {
  marketSearch(text: $text) {
    id
    questionId
  }
}
```

### Aggregations with Time Buckets

```graphql
query DailyVolume($days: Int!) {
  dailyStats(
    first: $days
    orderBy: dayTimestamp
    orderDirection: desc
  ) {
    dayTimestamp
    volume
    tradeCount
    activeUsers
  }
}
```

---

## 16. Implementation Notes

This section documents key findings and lessons learned during the actual implementation.

### 16.1 Event Signature Verification

**Critical**: Always verify event signatures from authoritative sources before implementation. The original plan had some incorrect signatures:

- **ConditionPreparation/Resolution**: `questionId` is **indexed** (3 indexed params total)
- **PositionSplit/Merge**: Both `parentCollectionId` and `conditionId` are **indexed**
- **PayoutRedemption**: `conditionId` is **NOT indexed** (only 3 params can be indexed: redeemer, collateralToken, parentCollectionId)
- **QuestionPrepared**: Has 4 params: `marketId`, `questionId`, `index`, `data`
- **PositionsConverted**: Named with "s" (plural), not `PositionConverted`

### 16.2 AssemblyScript Compiler Quirks

The Graph uses AssemblyScript which has stricter type requirements than TypeScript:

1. **Null comparisons**: Avoid `== null` for nullable entity types. Use truthiness checks instead:
   ```typescript
   // BAD - can crash compiler
   if (entity == null) { ... }

   // GOOD
   if (!entity) { ... }
   if (entity) { ... }
   ```

2. **Nullable BigInt fields**: Don't assign `null` directly to nullable `Int` fields. Leave them unset instead.

3. **Variable initialization**: Always initialize variables before conditional blocks, even if all branches assign values.

### 16.3 Verified Event Signatures

**ConditionalTokens Contract:**
```solidity
event ConditionPreparation(bytes32 indexed conditionId, address indexed oracle, bytes32 indexed questionId, uint256 outcomeSlotCount)
event ConditionResolution(bytes32 indexed conditionId, address indexed oracle, bytes32 indexed questionId, uint256 outcomeSlotCount, uint256[] payoutNumerators)
event PositionSplit(address indexed stakeholder, address collateralToken, bytes32 indexed parentCollectionId, bytes32 indexed conditionId, uint256[] partition, uint256 amount)
event PositionsMerge(address indexed stakeholder, address collateralToken, bytes32 indexed parentCollectionId, bytes32 indexed conditionId, uint256[] partition, uint256 amount)
event PayoutRedemption(address indexed redeemer, address indexed collateralToken, bytes32 indexed parentCollectionId, bytes32 conditionId, uint256[] indexSets, uint256 payout)
event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value)
event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values)
```

**CTFExchange Contract:**
```solidity
event TokenRegistered(uint256 indexed token0, uint256 indexed token1, bytes32 indexed conditionId)
event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled, uint256 fee)
```

**NegRiskAdapter Contract:**
```solidity
event QuestionPrepared(bytes32 indexed marketId, bytes32 indexed questionId, uint256 index, bytes data)
event PositionsConverted(address indexed stakeholder, bytes32 indexed marketId, uint256 indexed indexSet, uint256 amount)
```

### 16.4 Build Status

**Build Successful** - All data sources compile without errors:
- ConditionalTokens
- CTFExchange
- NegRiskCTFExchange
- NegRiskAdapter

### 16.5 Files Created

```
polymarket-subgraph/
├── package.json
├── schema.graphql
├── subgraph.yaml
├── abis/
│   ├── ConditionalTokens.json
│   ├── CTFExchange.json
│   └── NegRiskAdapter.json
└── src/
    ├── mappings/
    │   ├── ctf.ts
    │   ├── exchange.ts
    │   ├── negRiskExchange.ts
    │   └── negRiskAdapter.ts
    └── utils/
        ├── constants.ts
        ├── helpers.ts
        ├── pricing.ts
        └── tokenRegistry.ts
```

---

**Document Version**: 1.1.0
**Last Updated**: November 2025
**Author**: Polymarket Subgraph Team
**Implementation Status**: Complete - Build Successful
