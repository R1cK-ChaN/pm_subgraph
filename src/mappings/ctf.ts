import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  ConditionPreparation,
  ConditionResolution,
  PositionSplit,
  PositionsMerge,
  PayoutRedemption,
  TransferSingle,
  TransferBatch,
} from "../../generated/ConditionalTokens/ConditionalTokens";
import {
  Market,
  User,
  Position,
  Split,
  Merge,
  Redemption,
  GlobalStats,
  DailyStats,
} from "../../generated/schema";
import {
  ZERO_BI,
  ONE_BI,
  ZERO_ADDRESS,
} from "../utils/constants";
import {
  getOrCreateUser,
  getOrCreateMarket,
  getOrCreatePosition,
  getOrCreateGlobalStats,
  getOrCreateDailyStats,
  createEventId,
} from "../utils/helpers";
import { getMarketForToken, updatePositionOutcomeIndex } from "../utils/tokenRegistry";

// =============================================================================
// CONDITION PREPARATION - Market Creation
// =============================================================================

export function handleConditionPreparation(event: ConditionPreparation): void {
  let conditionId = event.params.conditionId;
  let id = conditionId.toHexString();

  // Create or update market entity
  let market = new Market(id);
  market.questionId = event.params.questionId;
  market.oracle = event.params.oracle;
  market.outcomeSlotCount = event.params.outcomeSlotCount.toI32();
  market.creationTimestamp = event.block.timestamp;
  market.creationBlock = event.block.number;
  market.creationTxHash = event.transaction.hash;
  market.resolved = false;
  market.resolutionTimestamp = null;
  market.resolutionBlock = null;
  // Note: null values for nullable Int fields handled by GraphQL
  market.payoutNumerators = null;
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

  log.info("Market created: {} with {} outcomes", [id, event.params.outcomeSlotCount.toString()]);
}

// =============================================================================
// CONDITION RESOLUTION - Market Settlement
// =============================================================================

export function handleConditionResolution(event: ConditionResolution): void {
  let conditionId = event.params.conditionId;
  let id = conditionId.toHexString();

  let market = Market.load(id);
  if (market == null) {
    log.warning("Resolution for unknown market: {}", [id]);
    // Create market if it doesn't exist (shouldn't happen normally)
    market = getOrCreateMarket(conditionId);
  }

  market.resolved = true;
  market.resolutionTimestamp = event.block.timestamp;
  market.resolutionBlock = event.block.number;

  // Store payout numerators
  let payoutNumerators = event.params.payoutNumerators;
  let payoutArray: BigInt[] = [];
  for (let i = 0; i < payoutNumerators.length; i++) {
    payoutArray.push(payoutNumerators[i]);
  }
  market.payoutNumerators = payoutArray;

  // Derive winning outcome (index of max payout for binary markets)
  let winningOutcome = -1;
  let maxPayout = ZERO_BI;
  for (let i = 0; i < payoutNumerators.length; i++) {
    if (payoutNumerators[i].gt(maxPayout)) {
      maxPayout = payoutNumerators[i];
      winningOutcome = i;
    }
  }
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

  log.info("Market resolved: {} - winning outcome: {}", [id, winningOutcome.toString()]);
}

// =============================================================================
// POSITION SPLIT - Minting Outcome Tokens
// =============================================================================

export function handlePositionSplit(event: PositionSplit): void {
  let stakeholder = event.params.stakeholder;
  let conditionId = event.params.conditionId;
  let amount = event.params.amount;

  // Ensure user exists
  getOrCreateUser(stakeholder);

  // Ensure market exists
  let market = Market.load(conditionId.toHexString());
  if (market == null) {
    log.warning("Split for unknown market: {}", [conditionId.toHexString()]);
    return;
  }

  // Create split record
  let splitId = createEventId(event);
  let split = new Split(splitId);
  split.stakeholder = stakeholder.toHexString();
  split.market = conditionId.toHexString();
  split.amount = amount;
  split.timestamp = event.block.timestamp;
  split.blockNumber = event.block.number;
  split.transactionHash = event.transaction.hash;
  split.save();

  log.info("Position split: {} amount {} in market {}", [
    stakeholder.toHexString(),
    amount.toString(),
    conditionId.toHexString()
  ]);
}

// =============================================================================
// POSITIONS MERGE - Burning Outcome Tokens
// =============================================================================

export function handlePositionsMerge(event: PositionsMerge): void {
  let stakeholder = event.params.stakeholder;
  let conditionId = event.params.conditionId;
  let amount = event.params.amount;

  // Ensure user exists
  getOrCreateUser(stakeholder);

  // Create merge record
  let mergeId = createEventId(event);
  let merge = new Merge(mergeId);
  merge.stakeholder = stakeholder.toHexString();
  merge.market = conditionId.toHexString();
  merge.amount = amount;
  merge.timestamp = event.block.timestamp;
  merge.blockNumber = event.block.number;
  merge.transactionHash = event.transaction.hash;
  merge.save();

  log.info("Positions merged: {} amount {} in market {}", [
    stakeholder.toHexString(),
    amount.toString(),
    conditionId.toHexString()
  ]);
}

// =============================================================================
// PAYOUT REDEMPTION - Redeeming Winning Tokens
// =============================================================================

export function handlePayoutRedemption(event: PayoutRedemption): void {
  let redeemer = event.params.redeemer;
  let conditionId = event.params.conditionId;
  let payout = event.params.payout;
  let indexSets = event.params.indexSets;

  // Ensure user exists
  getOrCreateUser(redeemer);

  // Convert indexSets to BigInt array
  let indexSetsArray: BigInt[] = [];
  for (let i = 0; i < indexSets.length; i++) {
    indexSetsArray.push(indexSets[i]);
  }

  // Create redemption record
  let redemptionId = createEventId(event);
  let redemption = new Redemption(redemptionId);
  redemption.redeemer = redeemer.toHexString();
  redemption.market = conditionId.toHexString();
  redemption.indexSets = indexSetsArray;
  redemption.payout = payout;
  redemption.timestamp = event.block.timestamp;
  redemption.blockNumber = event.block.number;
  redemption.transactionHash = event.transaction.hash;
  redemption.save();

  log.info("Payout redeemed: {} amount {} from market {}", [
    redeemer.toHexString(),
    payout.toString(),
    conditionId.toHexString()
  ]);
}

// =============================================================================
// TRANSFER SINGLE - Token Transfers (Source of Truth for Balances)
// =============================================================================

export function handleTransferSingle(event: TransferSingle): void {
  let from = event.params.from;
  let to = event.params.to;
  let tokenId = event.params.id;
  let value = event.params.value;

  // Get market for this token
  let marketIdResult = getMarketForToken(tokenId);
  if (marketIdResult == null) {
    // Token not registered yet - this can happen for tokens before TokenRegistered event
    // We'll skip these for now as we don't know which market they belong to
    log.debug("Transfer for unregistered token: {}", [tokenId.toHexString()]);
    return;
  }
  let marketId = marketIdResult as string;
  let marketBytes = Bytes.fromHexString(marketId);

  // Handle sender (decrease balance) - skip if minting (from zero address)
  if (from.notEqual(ZERO_ADDRESS)) {
    let fromUser = getOrCreateUser(from);
    let fromPosition = getOrCreatePosition(from, marketBytes, tokenId);
    fromPosition.balance = fromPosition.balance.minus(value);
    fromPosition.lastUpdated = event.block.timestamp;
    updatePositionOutcomeIndex(fromPosition, tokenId);
    fromPosition.save();
  }

  // Handle receiver (increase balance) - skip if burning (to zero address)
  if (to.notEqual(ZERO_ADDRESS)) {
    let toUser = getOrCreateUser(to);
    let toPosition = getOrCreatePosition(to, marketBytes, tokenId);
    toPosition.balance = toPosition.balance.plus(value);
    toPosition.lastUpdated = event.block.timestamp;
    updatePositionOutcomeIndex(toPosition, tokenId);
    toPosition.save();
  }

  log.debug("TransferSingle: {} -> {} token {} amount {}", [
    from.toHexString(),
    to.toHexString(),
    tokenId.toHexString(),
    value.toString()
  ]);
}

// =============================================================================
// TRANSFER BATCH - Batch Token Transfers
// =============================================================================

export function handleTransferBatch(event: TransferBatch): void {
  let from = event.params.from;
  let to = event.params.to;
  let ids = event.params.ids;
  let values = event.params.values;

  // Process each transfer in the batch
  for (let i = 0; i < ids.length; i++) {
    let tokenId = ids[i];
    let value = values[i];

    // Get market for this token
    let marketIdResult = getMarketForToken(tokenId);
    if (marketIdResult == null) {
      log.debug("Batch transfer for unregistered token: {}", [tokenId.toHexString()]);
      continue;
    }
    let marketBytes = Bytes.fromHexString(marketIdResult as string);

    // Handle sender (decrease balance) - skip if minting
    if (from.notEqual(ZERO_ADDRESS)) {
      let fromPosition = getOrCreatePosition(from, marketBytes, tokenId);
      fromPosition.balance = fromPosition.balance.minus(value);
      fromPosition.lastUpdated = event.block.timestamp;
      updatePositionOutcomeIndex(fromPosition, tokenId);
      fromPosition.save();
    }

    // Handle receiver (increase balance) - skip if burning
    if (to.notEqual(ZERO_ADDRESS)) {
      let toPosition = getOrCreatePosition(to, marketBytes, tokenId);
      toPosition.balance = toPosition.balance.plus(value);
      toPosition.lastUpdated = event.block.timestamp;
      updatePositionOutcomeIndex(toPosition, tokenId);
      toPosition.save();
    }
  }

  log.debug("TransferBatch: {} -> {} batch of {} tokens", [
    from.toHexString(),
    to.toHexString(),
    ids.length.toString()
  ]);
}
