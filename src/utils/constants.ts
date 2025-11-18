import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";

// =============================================================================
// NUMERIC CONSTANTS
// =============================================================================

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const TWO_BI = BigInt.fromI32(2);

export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");

// USDC has 6 decimals
export const USDC_DECIMALS = 6;
export const USDC_SCALE = BigInt.fromI32(10).pow(USDC_DECIMALS as u8);
export const USDC_SCALE_BD = USDC_SCALE.toBigDecimal();

// Outcome token shares also use 6 decimals on Polymarket
export const SHARE_DECIMALS = 6;
export const SHARE_SCALE = BigInt.fromI32(10).pow(SHARE_DECIMALS as u8);
export const SHARE_SCALE_BD = SHARE_SCALE.toBigDecimal();

// =============================================================================
// ADDRESS CONSTANTS
// =============================================================================

export const ZERO_ADDRESS = Address.zero();

// Polymarket USDC collateral on Polygon
export const USDC_ADDRESS = Address.fromString("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");

// Contract addresses
export const CTF_ADDRESS = Address.fromString("0x4D97DCd97eC945f40cF65F87097ACe5EA0476045");
export const LEGACY_EXCHANGE_ADDRESS = Address.fromString("0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E");
export const NEGRISK_EXCHANGE_ADDRESS = Address.fromString("0xC5d563A36AE78145C45a50134d48A1215220f80a");
export const NEGRISK_ADAPTER_ADDRESS = Address.fromString("0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296");

// =============================================================================
// STRING CONSTANTS
// =============================================================================

export const GLOBAL_STATS_ID = "global";

// Exchange identifiers
export const EXCHANGE_LEGACY = "legacy";
export const EXCHANGE_NEGRISK = "negrisk";

// Trade sides
export const SIDE_BUY = "BUY";
export const SIDE_SELL = "SELL";

// =============================================================================
// TIME CONSTANTS
// =============================================================================

export const SECONDS_PER_DAY = BigInt.fromI32(86400);
