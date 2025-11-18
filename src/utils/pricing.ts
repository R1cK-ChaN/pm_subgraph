import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
import {
  ZERO_BI,
  ZERO_BD,
  USDC_SCALE_BD,
  SHARE_SCALE_BD,
} from "./constants";

// =============================================================================
// PRICE CALCULATION
// =============================================================================

/**
 * Calculate price per share from USDC amount and share amount.
 * Both USDC and shares use 6 decimals on Polymarket.
 * Returns price as a decimal (0-1 range for probability markets).
 */
export function calculatePrice(usdcAmount: BigInt, shareAmount: BigInt): BigDecimal {
  if (shareAmount.equals(ZERO_BI)) {
    return ZERO_BD;
  }

  // Convert to decimals: (usdc / 1e6) / (shares / 1e6) = usdc / shares
  let usdcDecimal = usdcAmount.toBigDecimal().div(USDC_SCALE_BD);
  let shareDecimal = shareAmount.toBigDecimal().div(SHARE_SCALE_BD);

  return usdcDecimal.div(shareDecimal);
}

/**
 * Calculate volume-weighted average price.
 * Used for tracking average buy/sell prices on positions.
 */
export function calculateVWAP(
  currentAvg: BigDecimal,
  currentTotal: BigInt,
  newPrice: BigDecimal,
  newAmount: BigInt
): BigDecimal {
  if (newAmount.equals(ZERO_BI)) {
    return currentAvg;
  }

  let newTotal = currentTotal.plus(newAmount);
  if (newTotal.equals(ZERO_BI)) {
    return ZERO_BD;
  }

  // VWAP = (oldAvg * oldTotal + newPrice * newAmount) / newTotal
  let oldValue = currentAvg.times(currentTotal.toBigDecimal());
  let newValue = newPrice.times(newAmount.toBigDecimal());
  let totalValue = oldValue.plus(newValue);

  return totalValue.div(newTotal.toBigDecimal());
}

/**
 * Calculate realized PnL for a sale.
 * PnL = (sellPrice - avgBuyPrice) * amount
 */
export function calculateRealizedPnL(
  sellPrice: BigDecimal,
  avgBuyPrice: BigDecimal,
  amount: BigInt
): BigDecimal {
  let priceDiff = sellPrice.minus(avgBuyPrice);
  return priceDiff.times(amount.toBigDecimal());
}

/**
 * Normalize raw amount to decimal.
 */
export function toDecimal(amount: BigInt, decimals: i32): BigDecimal {
  let scale = BigInt.fromI32(10).pow(decimals as u8).toBigDecimal();
  return amount.toBigDecimal().div(scale);
}
