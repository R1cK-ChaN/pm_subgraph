import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  TokenRegistered,
  OrderFilled,
} from "../../generated/CTFExchange/CTFExchange";
import {
  Trade,
  User,
  Market,
  MarketParticipation,
  GlobalStats,
  DailyStats,
} from "../../generated/schema";
import {
  ZERO_BI,
  EXCHANGE_LEGACY,
  SIDE_BUY,
  SIDE_SELL,
} from "../utils/constants";
import {
  getOrCreateUser,
  getOrCreateMarket,
  getOrCreateMarketParticipation,
  getOrCreateGlobalStats,
  getOrCreateDailyStats,
  createEventId,
} from "../utils/helpers";
import {
  registerToken,
  getTokenRegistry,
  isRegisteredToken,
} from "../utils/tokenRegistry";
import { calculatePrice } from "../utils/pricing";

// =============================================================================
// TOKEN REGISTERED - Maps tokenId to conditionId
// =============================================================================

export function handleTokenRegistered(event: TokenRegistered): void {
  let token0 = event.params.token0;
  let token1 = event.params.token1;
  let conditionId = event.params.conditionId;

  // Register token0 as outcome 0 (typically NO)
  registerToken(token0, conditionId, 0, event);

  // Register token1 as outcome 1 (typically YES)
  registerToken(token1, conditionId, 1, event);

  // Ensure market exists
  let market = getOrCreateMarket(conditionId);

  log.info("Tokens registered for market {}: token0={}, token1={}", [
    conditionId.toHexString(),
    token0.toHexString(),
    token1.toHexString()
  ]);
}

// =============================================================================
// ORDER FILLED - Trade Execution
// =============================================================================

export function handleOrderFilled(event: OrderFilled): void {
  let maker = event.params.maker;
  let taker = event.params.taker;
  let makerAssetId = event.params.makerAssetId;
  let takerAssetId = event.params.takerAssetId;
  let makerAmountFilled = event.params.makerAmountFilled;
  let takerAmountFilled = event.params.takerAmountFilled;
  let fee = event.params.fee;

  // Get tokens and check registration
  let makerToken = getTokenRegistry(makerAssetId);
  let takerToken = getTokenRegistry(takerAssetId);

  let trader = taker;
  let tokenId = ZERO_BI;
  let marketId = "";
  let outcomeIndex = 0;
  let side = SIDE_BUY;
  let shareAmount = ZERO_BI;
  let usdcAmount = ZERO_BI;

  // Check maker token first
  if (makerToken) {
    tokenId = makerAssetId;
    marketId = makerToken.market;
    outcomeIndex = makerToken.outcomeIndex;
    side = SIDE_BUY;
    shareAmount = makerAmountFilled;
    usdcAmount = takerAmountFilled;
  } else if (takerToken) {
    tokenId = takerAssetId;
    marketId = takerToken.market;
    outcomeIndex = takerToken.outcomeIndex;
    side = SIDE_SELL;
    shareAmount = takerAmountFilled;
    usdcAmount = makerAmountFilled;
  } else {
    log.warning("OrderFilled with unregistered tokens: maker={}, taker={}", [
      makerAssetId.toHexString(),
      takerAssetId.toHexString()
    ]);
    return;
  }

  // Calculate price with proper decimal normalization
  let price = calculatePrice(usdcAmount, shareAmount);

  // Create trade entity
  let tradeId = createEventId(event);
  let trade = new Trade(tradeId);
  trade.market = marketId;
  trade.trader = trader.toHexString();
  trade.counterparty = maker.toHexString();
  trade.tokenId = tokenId;
  trade.outcomeIndex = outcomeIndex;
  trade.side = side;
  trade.amount = shareAmount;
  trade.price = price;
  trade.cost = usdcAmount;
  trade.fee = fee;
  trade.timestamp = event.block.timestamp;
  trade.blockNumber = event.block.number;
  trade.transactionHash = event.transaction.hash;
  trade.logIndex = event.logIndex;
  trade.exchange = EXCHANGE_LEGACY;
  trade.save();

  // Update taker user stats
  let takerUser = getOrCreateUser(taker);
  takerUser.tradeCount = takerUser.tradeCount + 1;
  takerUser.totalVolume = takerUser.totalVolume.plus(usdcAmount);
  takerUser.totalFeesPaid = takerUser.totalFeesPaid.plus(fee);
  if (!takerUser.firstTradeTimestamp) {
    takerUser.firstTradeTimestamp = event.block.timestamp;
    takerUser.firstTradeBlock = event.block.number;
  }
  takerUser.lastTradeTimestamp = event.block.timestamp;
  takerUser.save();

  // Update maker user stats
  let makerUser = getOrCreateUser(maker);
  makerUser.tradeCount = makerUser.tradeCount + 1;
  makerUser.totalVolume = makerUser.totalVolume.plus(usdcAmount);
  if (!makerUser.firstTradeTimestamp) {
    makerUser.firstTradeTimestamp = event.block.timestamp;
    makerUser.firstTradeBlock = event.block.number;
  }
  makerUser.lastTradeTimestamp = event.block.timestamp;
  makerUser.save();

  // Update market participation for taker
  let takerParticipation = getOrCreateMarketParticipation(
    taker,
    Bytes.fromHexString(marketId),
    event.block.timestamp
  );
  takerParticipation.tradeCount = takerParticipation.tradeCount + 1;
  takerParticipation.volume = takerParticipation.volume.plus(usdcAmount);
  takerParticipation.lastTradeTimestamp = event.block.timestamp;
  takerParticipation.save();

  // Update market participation for maker
  let makerParticipation = getOrCreateMarketParticipation(
    maker,
    Bytes.fromHexString(marketId),
    event.block.timestamp
  );
  makerParticipation.tradeCount = makerParticipation.tradeCount + 1;
  makerParticipation.volume = makerParticipation.volume.plus(usdcAmount);
  makerParticipation.lastTradeTimestamp = event.block.timestamp;
  makerParticipation.save();

  // Update market stats
  let market = Market.load(marketId);
  if (market) {
    market.tradeCount = market.tradeCount + 1;
    market.totalVolume = market.totalVolume.plus(usdcAmount);
    market.save();
  }

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

  log.info("Trade: {} {} {} shares at {} in market {}", [
    trader.toHexString(),
    side,
    shareAmount.toString(),
    price.toString(),
    marketId
  ]);
}
