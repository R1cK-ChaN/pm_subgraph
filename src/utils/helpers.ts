import { BigInt, BigDecimal, Address, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  Market,
  User,
  Position,
  MarketParticipation,
  GlobalStats,
  DailyStats,
  TokenRegistry,
} from "../../generated/schema";
import {
  ZERO_BI,
  ONE_BI,
  ZERO_BD,
  GLOBAL_STATS_ID,
  SECONDS_PER_DAY,
} from "./constants";

// =============================================================================
// USER HELPERS
// =============================================================================

export function getOrCreateUser(address: Address, timestamp: BigInt | null = null): User {
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

    // Update global stats for new user
    let stats = getOrCreateGlobalStats();
    stats.totalUsers = stats.totalUsers + 1;
    stats.save();

    // Update daily stats for new user
    if (timestamp) {
      let dailyStats = getOrCreateDailyStats(timestamp);
      dailyStats.newUsers = dailyStats.newUsers + 1;
      dailyStats.save();
    }
  }

  return user;
}

// Track daily active users - call before updating lastTradeTimestamp
export function trackDailyActiveUser(user: User, currentTimestamp: BigInt): void {
  let currentDay = currentTimestamp.div(SECONDS_PER_DAY);

  // Check if this is user's first trade today
  let isFirstTradeToday = true;

  let lastTimestamp = user.lastTradeTimestamp;
  if (lastTimestamp !== null) {
    let lastDay = lastTimestamp.div(SECONDS_PER_DAY);
    if (lastDay.equals(currentDay)) {
      isFirstTradeToday = false;
    }
  }

  // Increment activeUsers if this is user's first trade of the day
  if (isFirstTradeToday) {
    let dailyStats = getOrCreateDailyStats(currentTimestamp);
    dailyStats.activeUsers = dailyStats.activeUsers + 1;
    dailyStats.save();
  }
}

// =============================================================================
// MARKET HELPERS
// =============================================================================

export function getOrCreateMarket(conditionId: Bytes): Market {
  let id = conditionId.toHexString();
  let market = Market.load(id);

  if (market == null) {
    market = new Market(id);
    market.questionId = Bytes.empty();
    market.oracle = Bytes.empty();
    market.outcomeSlotCount = 0;
    market.creationTimestamp = ZERO_BI;
    market.creationBlock = ZERO_BI;
    market.creationTxHash = Bytes.empty();
    market.resolved = false;
    market.resolutionTimestamp = null;
    market.resolutionBlock = null;
    // winningOutcome is nullable, leave unset for null
    market.payoutNumerators = null;
    market.tradeCount = 0;
    market.totalVolume = ZERO_BI;
    market.uniqueTraders = 0;
    market.save();
  }

  return market;
}

// =============================================================================
// POSITION HELPERS
// =============================================================================

export function getOrCreatePosition(
  user: Address,
  market: Bytes,
  tokenId: BigInt
): Position {
  let id = user.toHexString() + "-" + market.toHexString() + "-" + tokenId.toHexString();
  let position = Position.load(id);

  if (position == null) {
    position = new Position(id);
    position.user = user.toHexString();
    position.market = market.toHexString();
    position.tokenId = tokenId;
    position.outcomeIndex = 0; // Will be set when we know the token registry
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

// =============================================================================
// MARKET PARTICIPATION HELPERS
// =============================================================================

export function getOrCreateMarketParticipation(
  user: Address,
  market: Bytes,
  timestamp: BigInt
): MarketParticipation {
  let id = user.toHexString() + "-" + market.toHexString();
  let participation = MarketParticipation.load(id);

  if (participation == null) {
    participation = new MarketParticipation(id);
    participation.user = user.toHexString();
    participation.market = market.toHexString();
    participation.tradeCount = 0;
    participation.volume = ZERO_BI;
    participation.firstTradeTimestamp = timestamp;
    participation.lastTradeTimestamp = timestamp;
    participation.save();

    // Update unique traders count for market
    let marketEntity = Market.load(market.toHexString());
    if (marketEntity != null) {
      marketEntity.uniqueTraders = marketEntity.uniqueTraders + 1;
      marketEntity.save();
    }

    // Update user's markets traded count
    let userEntity = User.load(user.toHexString());
    if (userEntity != null) {
      userEntity.marketsTraded = userEntity.marketsTraded + 1;
      userEntity.save();
    }
  }

  return participation;
}

// =============================================================================
// GLOBAL STATS HELPERS
// =============================================================================

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

// =============================================================================
// DAILY STATS HELPERS
// =============================================================================

export function getDayId(timestamp: BigInt): string {
  // Get start of day timestamp
  let dayTimestamp = timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY);
  return dayTimestamp.toString();
}

export function getOrCreateDailyStats(timestamp: BigInt): DailyStats {
  let dayId = getDayId(timestamp);
  let stats = DailyStats.load(dayId);

  if (stats == null) {
    stats = new DailyStats(dayId);
    stats.dayTimestamp = timestamp.div(SECONDS_PER_DAY).times(SECONDS_PER_DAY);
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

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function createEventId(event: ethereum.Event): string {
  return event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
}

// Derive outcome index from index set (bitmask)
// For binary markets: indexSet 1 = outcome 0, indexSet 2 = outcome 1
export function deriveOutcomeFromIndexSet(indexSet: BigInt): i32 {
  if (indexSet.equals(ONE_BI)) {
    return 0;
  } else if (indexSet.equals(TWO_BI)) {
    return 1;
  }
  // For multi-outcome, find the position of the set bit
  let value = indexSet;
  let index = 0;
  while (value.gt(ONE_BI)) {
    value = value.div(TWO_BI);
    index++;
  }
  return index;
}

// Constants for bit operations
const TWO_BI = BigInt.fromI32(2);
