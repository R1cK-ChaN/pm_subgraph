import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { newMockEvent } from "matchstick-as";

// =============================================================================
// CONSTANTS FOR TESTS
// =============================================================================

export const DEFAULT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
export const ZERO_ADDRESS = Address.zero();
export const DEFAULT_CONDITION_ID = Bytes.fromHexString("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
export const DEFAULT_QUESTION_ID = Bytes.fromHexString("0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890");
export const DEFAULT_TOKEN_ID = BigInt.fromI32(12345);
export const DEFAULT_AMOUNT = BigInt.fromI32(1000000); // 1 USDC in wei

// =============================================================================
// CTF EVENT CREATORS
// =============================================================================

export function createConditionPreparationEvent(
  conditionId: Bytes,
  oracle: Address,
  questionId: Bytes,
  outcomeSlotCount: i32
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle)));
  event.parameters.push(new ethereum.EventParam("questionId", ethereum.Value.fromBytes(questionId)));
  event.parameters.push(new ethereum.EventParam("outcomeSlotCount", ethereum.Value.fromI32(outcomeSlotCount)));

  return event;
}

export function createConditionResolutionEvent(
  conditionId: Bytes,
  oracle: Address,
  questionId: Bytes,
  outcomeSlotCount: i32,
  payoutNumerators: BigInt[]
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("oracle", ethereum.Value.fromAddress(oracle)));
  event.parameters.push(new ethereum.EventParam("questionId", ethereum.Value.fromBytes(questionId)));
  event.parameters.push(new ethereum.EventParam("outcomeSlotCount", ethereum.Value.fromI32(outcomeSlotCount)));
  event.parameters.push(new ethereum.EventParam("payoutNumerators", ethereum.Value.fromBigIntArray(payoutNumerators)));

  return event;
}

export function createPositionSplitEvent(
  stakeholder: Address,
  collateralToken: Address,
  parentCollectionId: Bytes,
  conditionId: Bytes,
  partition: BigInt[],
  amount: BigInt
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("stakeholder", ethereum.Value.fromAddress(stakeholder)));
  event.parameters.push(new ethereum.EventParam("collateralToken", ethereum.Value.fromAddress(collateralToken)));
  event.parameters.push(new ethereum.EventParam("parentCollectionId", ethereum.Value.fromBytes(parentCollectionId)));
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("partition", ethereum.Value.fromBigIntArray(partition)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));

  return event;
}

export function createPositionsMergeEvent(
  stakeholder: Address,
  collateralToken: Address,
  parentCollectionId: Bytes,
  conditionId: Bytes,
  partition: BigInt[],
  amount: BigInt
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("stakeholder", ethereum.Value.fromAddress(stakeholder)));
  event.parameters.push(new ethereum.EventParam("collateralToken", ethereum.Value.fromAddress(collateralToken)));
  event.parameters.push(new ethereum.EventParam("parentCollectionId", ethereum.Value.fromBytes(parentCollectionId)));
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("partition", ethereum.Value.fromBigIntArray(partition)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));

  return event;
}

export function createPayoutRedemptionEvent(
  redeemer: Address,
  collateralToken: Address,
  parentCollectionId: Bytes,
  conditionId: Bytes,
  indexSets: BigInt[],
  payout: BigInt
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("redeemer", ethereum.Value.fromAddress(redeemer)));
  event.parameters.push(new ethereum.EventParam("collateralToken", ethereum.Value.fromAddress(collateralToken)));
  event.parameters.push(new ethereum.EventParam("parentCollectionId", ethereum.Value.fromBytes(parentCollectionId)));
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));
  event.parameters.push(new ethereum.EventParam("indexSets", ethereum.Value.fromBigIntArray(indexSets)));
  event.parameters.push(new ethereum.EventParam("payout", ethereum.Value.fromUnsignedBigInt(payout)));

  return event;
}

export function createTransferSingleEvent(
  operator: Address,
  from: Address,
  to: Address,
  id: BigInt,
  value: BigInt
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)));
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id)));
  event.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));

  return event;
}

export function createTransferBatchEvent(
  operator: Address,
  from: Address,
  to: Address,
  ids: BigInt[],
  values: BigInt[]
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)));
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("ids", ethereum.Value.fromBigIntArray(ids)));
  event.parameters.push(new ethereum.EventParam("values", ethereum.Value.fromBigIntArray(values)));

  return event;
}

// =============================================================================
// EXCHANGE EVENT CREATORS
// =============================================================================

export function createTokenRegisteredEvent(
  token0: BigInt,
  token1: BigInt,
  conditionId: Bytes
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("token0", ethereum.Value.fromUnsignedBigInt(token0)));
  event.parameters.push(new ethereum.EventParam("token1", ethereum.Value.fromUnsignedBigInt(token1)));
  event.parameters.push(new ethereum.EventParam("conditionId", ethereum.Value.fromBytes(conditionId)));

  return event;
}

export function createOrderFilledEvent(
  orderHash: Bytes,
  maker: Address,
  taker: Address,
  makerAssetId: BigInt,
  takerAssetId: BigInt,
  makerAmountFilled: BigInt,
  takerAmountFilled: BigInt,
  fee: BigInt
): ethereum.Event {
  let event = newMockEvent();

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

// =============================================================================
// NEGRISK ADAPTER EVENT CREATORS
// =============================================================================

export function createQuestionPreparedEvent(
  marketId: Bytes,
  questionId: Bytes,
  index: BigInt,
  data: Bytes
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("marketId", ethereum.Value.fromBytes(marketId)));
  event.parameters.push(new ethereum.EventParam("questionId", ethereum.Value.fromBytes(questionId)));
  event.parameters.push(new ethereum.EventParam("index", ethereum.Value.fromUnsignedBigInt(index)));
  event.parameters.push(new ethereum.EventParam("data", ethereum.Value.fromBytes(data)));

  return event;
}

export function createPositionsConvertedEvent(
  stakeholder: Address,
  marketId: Bytes,
  indexSet: BigInt,
  amount: BigInt
): ethereum.Event {
  let event = newMockEvent();

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam("stakeholder", ethereum.Value.fromAddress(stakeholder)));
  event.parameters.push(new ethereum.EventParam("marketId", ethereum.Value.fromBytes(marketId)));
  event.parameters.push(new ethereum.EventParam("indexSet", ethereum.Value.fromUnsignedBigInt(indexSet)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));

  return event;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

export function createMockAddress(seed: i32): Address {
  let hex = seed.toString(16).padStart(40, "0");
  return Address.fromString("0x" + hex);
}

export function createMockBytes32(seed: i32): Bytes {
  let hex = seed.toString(16).padStart(64, "0");
  return Bytes.fromHexString("0x" + hex);
}

export function createMockOrderHash(seed: i32): Bytes {
  return createMockBytes32(seed);
}
