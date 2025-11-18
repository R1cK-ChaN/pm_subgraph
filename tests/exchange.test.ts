import { describe, test, beforeEach, afterEach, assert, clearStore } from "matchstick-as";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  handleTokenRegistered,
  handleOrderFilled
} from "../src/mappings/exchange";
import {
  TokenRegistered,
  OrderFilled
} from "../generated/CTFExchange/CTFExchange";
import { newMockEvent } from "matchstick-as";
import { Trade, User, Position, Market, TokenRegistry, GlobalStats } from "../generated/schema";

// =============================================================================
// TEST CONSTANTS
// =============================================================================

const MAKER = Address.fromString("0x0000000000000000000000000000000000000001");
const TAKER = Address.fromString("0x0000000000000000000000000000000000000002");
const CONDITION_ID = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
const ORDER_HASH = Bytes.fromHexString("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
const TOKEN_0 = BigInt.fromI32(100); // NO token
const TOKEN_1 = BigInt.fromI32(101); // YES token

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createTokenRegisteredEvent(
  token0: BigInt,
  token1: BigInt,
  conditionId: Bytes
): TokenRegistered {
  let event = changetype<TokenRegistered>(newMockEvent());

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("token0", ethereum.Value.fromUnsignedBigInt(token0)));
  event.parameters.push(new ethereum.EventParam("token1", ethereum.Value.fromUnsignedBigInt(token1)));
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));

  return event;
}

function createOrderFilledEvent(
  orderHash: Bytes,
  maker: Address,
  taker: Address,
  makerAssetId: BigInt,
  takerAssetId: BigInt,
  makerAmountFilled: BigInt,
  takerAmountFilled: BigInt,
  fee: BigInt
): OrderFilled {
  let event = changetype<OrderFilled>(newMockEvent());

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("orderHash", ethereum.Value.fromBytes(orderHash)));
  event.parameters.push(new ethereum.EventParam("maker", ethereum.Value.fromAddress(maker)));
  event.parameters.push(new ethereum.EventParam("taker", ethereum.Value.fromAddress(taker)));
  event.parameters.push(new ethereum.EventParam("makerAssetId", ethereum.Value.fromUnsignedBigInt(makerAssetId)));
  event.parameters.push(new ethereum.EventParam("takerAssetId", ethereum.Value.fromUnsignedBigInt(takerAssetId)));
  event.parameters.push(new ethereum.EventParam("makerAmountFilled", ethereum.Value.fromUnsignedBigInt(makerAmountFilled)));
  event.parameters.push(new ethereum.EventParam("takerAmountFilled", ethereum.Value.fromUnsignedBigInt(takerAmountFilled)));
  event.parameters.push(new ethereum.EventParam("fee", ethereum.Value.fromUnsignedBigInt(fee)));

  return event;
}

function setupMarketAndTokens(): void {
  // Register tokens first
  let tokenEvent = createTokenRegisteredEvent(
    TOKEN_0,
    TOKEN_1,
    CONDITION_ID
  );
  handleTokenRegistered(tokenEvent);
}

// =============================================================================
// TOKEN REGISTERED TESTS
// =============================================================================

describe("TokenRegistered Handler", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("Should create TokenRegistry for token0 and token1", () => {
    let event = createTokenRegisteredEvent(
      TOKEN_0,
      TOKEN_1,
      CONDITION_ID
    );

    handleTokenRegistered(event);

    // Both tokens should be registered
    assert.entityCount("TokenRegistry", 2);

    // Check token0
    let token0Id = TOKEN_0.toHexString();
    assert.fieldEquals("TokenRegistry", token0Id, "tokenId", TOKEN_0.toString());
    assert.fieldEquals("TokenRegistry", token0Id, "market", CONDITION_ID.toHexString());
    assert.fieldEquals("TokenRegistry", token0Id, "outcomeIndex", "0");

    // Check token1
    let token1Id = TOKEN_1.toHexString();
    assert.fieldEquals("TokenRegistry", token1Id, "tokenId", TOKEN_1.toString());
    assert.fieldEquals("TokenRegistry", token1Id, "market", CONDITION_ID.toHexString());
    assert.fieldEquals("TokenRegistry", token1Id, "outcomeIndex", "1");
  });

  test("Should create or update Market entity", () => {
    let event = createTokenRegisteredEvent(
      TOKEN_0,
      TOKEN_1,
      CONDITION_ID
    );

    handleTokenRegistered(event);

    assert.entityCount("Market", 1);
    assert.fieldEquals("Market", CONDITION_ID.toHexString(), "tradeCount", "0");
  });

  test("Both tokens should map to the same market", () => {
    let event = createTokenRegisteredEvent(
      TOKEN_0,
      TOKEN_1,
      CONDITION_ID
    );

    handleTokenRegistered(event);

    let registry0 = TokenRegistry.load(TOKEN_0.toHexString());
    let registry1 = TokenRegistry.load(TOKEN_1.toHexString());

    assert.assertTrue(registry0 !== null);
    assert.assertTrue(registry1 !== null);
    assert.assertTrue(registry0!.market == registry1!.market);
  });
});

// =============================================================================
// ORDER FILLED TESTS
// =============================================================================

describe("OrderFilled Handler", () => {
  beforeEach(() => {
    clearStore();
    setupMarketAndTokens();
  });

  afterEach(() => {
    clearStore();
  });

  test("Should create Trade entity", () => {
    // Maker selling TOKEN_1 (YES), taker buying with USDC
    let makerAmount = BigInt.fromI32(1000000); // 1 share
    let takerAmount = BigInt.fromI32(500000);  // 0.5 USDC

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,      // maker selling YES tokens
      BigInt.fromI32(0), // taker paying USDC (not a registered token)
      makerAmount,
      takerAmount,
      BigInt.fromI32(1000) // fee
    );

    handleOrderFilled(event);

    assert.entityCount("Trade", 1);
  });

  test("Should set trade side to BUY when taker buys tokens", () => {
    // Maker selling TOKEN_1 (YES), taker buying
    let makerAmount = BigInt.fromI32(1000000);
    let takerAmount = BigInt.fromI32(500000);

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      makerAmount,
      takerAmount,
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    // Get trade ID
    let tradeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    assert.fieldEquals("Trade", tradeId, "side", "BUY");
  });

  test("Should set trade side to SELL when taker sells tokens", () => {
    // Taker selling TOKEN_1 (YES), maker buying
    let makerAmount = BigInt.fromI32(500000);  // USDC
    let takerAmount = BigInt.fromI32(1000000); // shares

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      BigInt.fromI32(0), // maker paying USDC
      TOKEN_1,           // taker selling YES tokens
      makerAmount,
      takerAmount,
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    let tradeId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
    assert.fieldEquals("Trade", tradeId, "side", "SELL");
  });

  test("Should update User trade counts", () => {
    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      BigInt.fromI32(500000),
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    // Both maker and taker should have tradeCount = 1
    assert.fieldEquals("User", MAKER.toHexString(), "tradeCount", "1");
    assert.fieldEquals("User", TAKER.toHexString(), "tradeCount", "1");
  });

  test("Should update User totalVolume", () => {
    let usdcAmount = BigInt.fromI32(500000);

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      usdcAmount,
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    assert.fieldEquals("User", TAKER.toHexString(), "totalVolume", usdcAmount.toString());
    assert.fieldEquals("User", MAKER.toHexString(), "totalVolume", usdcAmount.toString());
  });

  test("Should update Market trade count and volume", () => {
    let usdcAmount = BigInt.fromI32(500000);

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      usdcAmount,
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    assert.fieldEquals("Market", CONDITION_ID.toHexString(), "tradeCount", "1");
    assert.fieldEquals("Market", CONDITION_ID.toHexString(), "totalVolume", usdcAmount.toString());
  });

  test("Should update GlobalStats", () => {
    let usdcAmount = BigInt.fromI32(500000);
    let fee = BigInt.fromI32(1000);

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      usdcAmount,
      fee
    );

    handleOrderFilled(event);

    assert.fieldEquals("GlobalStats", "global", "totalTrades", "1");
    assert.fieldEquals("GlobalStats", "global", "totalVolume", usdcAmount.toString());
    assert.fieldEquals("GlobalStats", "global", "totalFees", fee.toString());
  });

  test("Should update Position PnL for buyer", () => {
    let shareAmount = BigInt.fromI32(1000000);
    let usdcAmount = BigInt.fromI32(500000);

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      shareAmount,
      usdcAmount,
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    // Check taker's position (buyer)
    let positionId = TAKER.toHexString() + "-" + CONDITION_ID.toHexString() + "-" + TOKEN_1.toHexString();
    assert.fieldEquals("Position", positionId, "totalBought", shareAmount.toString());
    assert.fieldEquals("Position", positionId, "tradeCount", "1");
  });

  test("Should not create duplicate trades from same event", () => {
    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      BigInt.fromI32(500000),
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    // Same event should overwrite, not duplicate
    assert.entityCount("Trade", 1);
  });

  test("Should skip trades with unregistered tokens", () => {
    let unregisteredToken = BigInt.fromI32(999);

    let event = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      unregisteredToken,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      BigInt.fromI32(500000),
      BigInt.fromI32(1000)
    );

    handleOrderFilled(event);

    // No trade should be created
    assert.entityCount("Trade", 0);
  });
});

// =============================================================================
// INVARIANT TESTS
// =============================================================================

describe("Exchange Invariants", () => {
  beforeEach(() => {
    clearStore();
    setupMarketAndTokens();
  });

  afterEach(() => {
    clearStore();
  });

  test("I-3: No duplicate trades (unique txHash-logIndex)", () => {
    // Create two trades in same block but different log indices
    let event1 = createOrderFilledEvent(
      ORDER_HASH,
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(1000000),
      BigInt.fromI32(500000),
      BigInt.fromI32(1000)
    );

    let event2 = createOrderFilledEvent(
      Bytes.fromHexString("0x1111111111111111111111111111111111111111111111111111111111111111"),
      MAKER,
      TAKER,
      TOKEN_1,
      BigInt.fromI32(0),
      BigInt.fromI32(2000000),
      BigInt.fromI32(1000000),
      BigInt.fromI32(2000)
    );

    handleOrderFilled(event1);
    handleOrderFilled(event2);

    // Should have exactly 2 trades
    assert.entityCount("Trade", 2);
  });

  test("I-4: TokenRegistry maps both tokens to same market", () => {
    let registry0 = TokenRegistry.load(TOKEN_0.toHexString());
    let registry1 = TokenRegistry.load(TOKEN_1.toHexString());

    assert.assertTrue(registry0 !== null);
    assert.assertTrue(registry1 !== null);
    assert.stringEquals(registry0!.market, registry1!.market);
    assert.stringEquals(registry0!.market, CONDITION_ID.toHexString());
  });
});
