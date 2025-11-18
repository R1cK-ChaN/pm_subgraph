import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { TokenRegistry, Market, Position } from "../../generated/schema";
import { ZERO_BI, USDC_ADDRESS } from "./constants";
import { deriveOutcomeFromIndexSet } from "./helpers";

// =============================================================================
// TOKEN REGISTRY MANAGEMENT
// =============================================================================

/**
 * Register a token from TokenRegistered event.
 * This provides the direct mapping from tokenId to conditionId.
 */
export function registerToken(
  tokenId: BigInt,
  conditionId: Bytes,
  outcomeIndex: i32,
  event: ethereum.Event
): TokenRegistry {
  let id = tokenId.toHexString();
  let registry = TokenRegistry.load(id);

  if (registry == null) {
    registry = new TokenRegistry(id);
    registry.tokenId = tokenId;
    registry.market = conditionId.toHexString();
    registry.outcomeIndex = outcomeIndex;
    // For binary markets: outcome 0 = indexSet 1, outcome 1 = indexSet 2
    registry.indexSet = BigInt.fromI32(1 << outcomeIndex);
    registry.collateral = USDC_ADDRESS;
    registry.firstSeenTxHash = event.transaction.hash;
    registry.firstSeenBlock = event.block.number;
    registry.firstSeenTimestamp = event.block.timestamp;
    registry.save();
  }

  return registry;
}

/**
 * Get TokenRegistry by tokenId.
 * Returns null if not found (token not yet registered).
 */
export function getTokenRegistry(tokenId: BigInt): TokenRegistry | null {
  return TokenRegistry.load(tokenId.toHexString());
}

/**
 * Get the conditionId (market) for a given tokenId.
 * Returns null if token is not registered.
 */
export function getMarketForToken(tokenId: BigInt): string | null {
  let registry = getTokenRegistry(tokenId);
  if (registry != null) {
    return registry.market;
  }
  return null;
}

/**
 * Get the outcome index for a given tokenId.
 * Returns -1 if token is not registered.
 */
export function getOutcomeForToken(tokenId: BigInt): i32 {
  let registry = getTokenRegistry(tokenId);
  if (registry != null) {
    return registry.outcomeIndex;
  }
  return -1;
}

/**
 * Update position's outcomeIndex based on TokenRegistry.
 * Called when we create or update a position and now have registry info.
 */
export function updatePositionOutcomeIndex(position: Position, tokenId: BigInt): void {
  let registry = getTokenRegistry(tokenId);
  if (registry != null) {
    position.outcomeIndex = registry.outcomeIndex;
  }
}

/**
 * Check if a BigInt represents a registered CTF token.
 * Used to determine trade direction (which asset is the CTF token vs USDC).
 */
export function isRegisteredToken(assetId: BigInt): boolean {
  return getTokenRegistry(assetId) != null;
}
