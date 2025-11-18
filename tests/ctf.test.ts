import { describe, test, beforeEach, afterEach, assert, clearStore } from "matchstick-as";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  handleConditionPreparation,
  handleConditionResolution,
  handlePositionSplit,
  handlePositionsMerge,
  handleTransferSingle,
  handleTransferBatch
} from "../src/mappings/ctf";
import {
  ConditionPreparation,
  ConditionResolution,
  PositionSplit,
  PositionsMerge,
  TransferSingle,
  TransferBatch
} from "../generated/ConditionalTokens/ConditionalTokens";
import { newMockEvent } from "matchstick-as";
import { Market, GlobalStats, DailyStats, User, Split, Merge, Position } from "../generated/schema";

// =============================================================================
// TEST CONSTANTS
// =============================================================================

const ORACLE = Address.fromString("0x0000000000000000000000000000000000000001");
const USER_1 = Address.fromString("0x0000000000000000000000000000000000000002");
const USER_2 = Address.fromString("0x0000000000000000000000000000000000000003");
const COLLATERAL = Address.fromString("0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174");
const CONDITION_ID = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
const QUESTION_ID = Bytes.fromHexString("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
const PARENT_COLLECTION_ID = Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000000");

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function createConditionPreparationEvent(
  conditionId: Bytes,
  oracle: Address,
  questionId: Bytes,
  outcomeSlotCount: i32
): ConditionPreparation {
  let event = changetype<ConditionPreparation>(newMockEvent());

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle)));
  event.parameters.push(new ethereum.EventParam("questionId", ethereum.Value.fromBytes(questionId)));
  event.parameters.push(new ethereum.EventParam("outcomeSlotCount", ethereum.Value.fromI32(outcomeSlotCount)));

  return event;
}

function createConditionResolutionEvent(
  conditionId: Bytes,
  oracle: Address,
  questionId: Bytes,
  outcomeSlotCount: i32,
  payoutNumerators: BigInt[]
): ConditionResolution {
  let event = changetype<ConditionResolution>(newMockEvent());

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle)));
  event.parameters.push(new ethereum.EventParam("questionId", ethereum.Value.fromBytes(questionId)));
  event.parameters.push(new ethereum.EventParam("outcomeSlotCount", ethereum.Value.fromI32(outcomeSlotCount)));
  event.parameters.push(new ethereum.EventParam("payoutNumerators", ethereum.Value.fromBigIntArray(payoutNumerators)));

  return event;
}

function createPositionSplitEvent(
  stakeholder: Address,
  collateralToken: Address,
  parentCollectionId: Bytes,
  conditionId: Bytes,
  partition: BigInt[],
  amount: BigInt
): PositionSplit {
  let event = changetype<PositionSplit>(newMockEvent());

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("stakeholder", ethereum.Value.fromAddress(stakeholder)));
  event.parameters.push(new ethereum.EventParam("collateralToken", ethereum.Value.fromAddress(collateralToken)));
  event.parameters.push(new ethereum.EventParam("parentCollectionId", ethereum.Value.fromBytes(parentCollectionId)));
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("partition", ethereum.Value.fromBigIntArray(partition)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));

  return event;
}

function createTransferSingleEvent(
  operator: Address,
  from: Address,
  to: Address,
  id: BigInt,
  value: BigInt
): TransferSingle {
  let event = changetype<TransferSingle>(newMockEvent());

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)));
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id)));
  event.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));

  return event;
}

import { ethereum } from "@graphprotocol/graph-ts";

// =============================================================================
// CONDITION PREPARATION TESTS
// =============================================================================

describe("ConditionPreparation Handler", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("Should create a new Market entity", () => {
    let event = createConditionPreparationEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2
    );

    handleConditionPreparation(event);

    // Assert Market was created
    assert.entityCount("Market", 1);

    let marketId = CONDITION_ID.toHexString();
    assert.fieldEquals("Market", marketId, "questionId", QUESTION_ID.toHexString());
    assert.fieldEquals("Market", marketId, "oracle", ORACLE.toHexString());
    assert.fieldEquals("Market", marketId, "outcomeSlotCount", "2");
    assert.fieldEquals("Market", marketId, "resolved", "false");
    assert.fieldEquals("Market", marketId, "tradeCount", "0");
    assert.fieldEquals("Market", marketId, "totalVolume", "0");
    assert.fieldEquals("Market", marketId, "uniqueTraders", "0");
  });

  test("Should update GlobalStats.totalMarkets", () => {
    let event = createConditionPreparationEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2
    );

    handleConditionPreparation(event);

    assert.entityCount("GlobalStats", 1);
    assert.fieldEquals("GlobalStats", "global", "totalMarkets", "1");
  });

  test("Should update DailyStats.newMarkets", () => {
    let event = createConditionPreparationEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2
    );

    handleConditionPreparation(event);

    assert.entityCount("DailyStats", 1);
  });
});

// =============================================================================
// CONDITION RESOLUTION TESTS
// =============================================================================

describe("ConditionResolution Handler", () => {
  beforeEach(() => {
    clearStore();

    // Create market first
    let prepEvent = createConditionPreparationEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2
    );
    handleConditionPreparation(prepEvent);
  });

  afterEach(() => {
    clearStore();
  });

  test("Should set resolved to true", () => {
    let payouts = [BigInt.fromI32(0), BigInt.fromI32(1)];
    let event = createConditionResolutionEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2,
      payouts
    );

    handleConditionResolution(event);

    let marketId = CONDITION_ID.toHexString();
    assert.fieldEquals("Market", marketId, "resolved", "true");
  });

  test("Should derive winning outcome as argmax of payouts (YES wins)", () => {
    // YES (index 1) wins
    let payouts = [BigInt.fromI32(0), BigInt.fromI32(1)];
    let event = createConditionResolutionEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2,
      payouts
    );

    handleConditionResolution(event);

    let marketId = CONDITION_ID.toHexString();
    assert.fieldEquals("Market", marketId, "winningOutcome", "1");
  });

  test("Should derive winning outcome as argmax of payouts (NO wins)", () => {
    // NO (index 0) wins
    let payouts = [BigInt.fromI32(1), BigInt.fromI32(0)];
    let event = createConditionResolutionEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2,
      payouts
    );

    handleConditionResolution(event);

    let marketId = CONDITION_ID.toHexString();
    assert.fieldEquals("Market", marketId, "winningOutcome", "0");
  });

  test("Should update GlobalStats.resolvedMarkets", () => {
    let payouts = [BigInt.fromI32(0), BigInt.fromI32(1)];
    let event = createConditionResolutionEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2,
      payouts
    );

    handleConditionResolution(event);

    assert.fieldEquals("GlobalStats", "global", "resolvedMarkets", "1");
  });
});

// =============================================================================
// POSITION SPLIT TESTS
// =============================================================================

describe("PositionSplit Handler", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("Should create Split entity", () => {
    let partition = [BigInt.fromI32(1), BigInt.fromI32(2)];
    let amount = BigInt.fromI32(1000000);

    let event = createPositionSplitEvent(
      USER_1,
      COLLATERAL,
      PARENT_COLLECTION_ID,
      CONDITION_ID,
      partition,
      amount
    );

    handlePositionSplit(event);

    assert.entityCount("Split", 1);
    assert.entityCount("User", 1);
  });

  test("Should create User if not exists", () => {
    let partition = [BigInt.fromI32(1), BigInt.fromI32(2)];
    let amount = BigInt.fromI32(1000000);

    let event = createPositionSplitEvent(
      USER_1,
      COLLATERAL,
      PARENT_COLLECTION_ID,
      CONDITION_ID,
      partition,
      amount
    );

    handlePositionSplit(event);

    assert.entityCount("User", 1);
    assert.fieldEquals("User", USER_1.toHexString(), "tradeCount", "0");
  });
});

// =============================================================================
// TRANSFER SINGLE TESTS
// =============================================================================

describe("TransferSingle Handler", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("Should handle mint (from zero address)", () => {
    let tokenId = BigInt.fromI32(12345);
    let value = BigInt.fromI32(1000000);

    let event = createTransferSingleEvent(
      USER_1,
      Address.zero(),
      USER_1,
      tokenId,
      value
    );

    handleTransferSingle(event);

    // User should be created
    assert.entityCount("User", 1);
  });

  test("Should handle burn (to zero address)", () => {
    let tokenId = BigInt.fromI32(12345);
    let value = BigInt.fromI32(1000000);

    // First mint
    let mintEvent = createTransferSingleEvent(
      USER_1,
      Address.zero(),
      USER_1,
      tokenId,
      value
    );
    handleTransferSingle(mintEvent);

    // Then burn
    let burnEvent = createTransferSingleEvent(
      USER_1,
      USER_1,
      Address.zero(),
      tokenId,
      value
    );
    handleTransferSingle(burnEvent);

    assert.entityCount("User", 1);
  });

  test("Should handle transfer between users", () => {
    let tokenId = BigInt.fromI32(12345);
    let value = BigInt.fromI32(1000000);

    let event = createTransferSingleEvent(
      USER_1,
      USER_1,
      USER_2,
      tokenId,
      value
    );

    handleTransferSingle(event);

    // Both users should be created
    assert.entityCount("User", 2);
  });
});

// =============================================================================
// INVARIANT TESTS
// =============================================================================

describe("Invariants", () => {
  beforeEach(() => {
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  test("I-1: winningOutcome equals argmax(payoutNumerators)", () => {
    // Create market
    let prepEvent = createConditionPreparationEvent(
      CONDITION_ID,
      ORACLE,
      QUESTION_ID,
      2
    );
    handleConditionPreparation(prepEvent);

    // Test various payout scenarios
    let testCases: BigInt[][] = [
      [BigInt.fromI32(0), BigInt.fromI32(1)],  // YES wins
      [BigInt.fromI32(1), BigInt.fromI32(0)],  // NO wins
      [BigInt.fromI32(100), BigInt.fromI32(50)], // NO wins with different magnitudes
    ];

    for (let i = 0; i < testCases.length; i++) {
      clearStore();

      let prepEvent2 = createConditionPreparationEvent(
        CONDITION_ID,
        ORACLE,
        QUESTION_ID,
        2
      );
      handleConditionPreparation(prepEvent2);

      let payouts = testCases[i];
      let resEvent = createConditionResolutionEvent(
        CONDITION_ID,
        ORACLE,
        QUESTION_ID,
        2,
        payouts
      );
      handleConditionResolution(resEvent);

      let market = Market.load(CONDITION_ID.toHexString());
      assert.assertTrue(market !== null);

      // Find argmax
      let maxIndex = 0;
      let maxValue = payouts[0];
      for (let j = 1; j < payouts.length; j++) {
        if (payouts[j].gt(maxValue)) {
          maxValue = payouts[j];
          maxIndex = j;
        }
      }

      assert.assertTrue(market!.winningOutcome == maxIndex);
    }
  });
});
