import { BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import {
  QuestionPrepared,
  PositionsConverted,
} from "../../generated/NegRiskAdapter/NegRiskAdapter";
import { Market, User, Position } from "../../generated/schema";
import { ZERO_BI } from "../utils/constants";
import { getOrCreateUser, getOrCreatePosition } from "../utils/helpers";
import { getMarketForToken } from "../utils/tokenRegistry";

// =============================================================================
// QUESTION PREPARED - NegRisk Question Initialization
// =============================================================================

export function handleQuestionPrepared(event: QuestionPrepared): void {
  let marketId = event.params.marketId;
  let questionId = event.params.questionId;
  let index = event.params.index;
  // let data = event.params.data; // Additional data, not used currently

  // This event is emitted when a NegRisk question is prepared
  // The marketId corresponds to the overall multi-outcome market
  // Each questionId corresponds to a binary sub-market

  log.info("NegRisk QuestionPrepared: marketId={}, questionId={}, index={}", [
    marketId.toHexString(),
    questionId.toHexString(),
    index.toString()
  ]);

  // The actual market creation happens via ConditionPreparation on the CTF contract
  // This event provides additional context for NegRisk-specific markets
}

// =============================================================================
// POSITIONS CONVERTED - NegRisk Position Conversion
// =============================================================================

export function handlePositionsConverted(event: PositionsConverted): void {
  let stakeholder = event.params.stakeholder;
  let marketId = event.params.marketId;
  let indexSet = event.params.indexSet;
  let amount = event.params.amount;

  // Ensure user exists
  getOrCreateUser(stakeholder);

  // Position conversions in NegRisk markets involve converting between
  // different position types (e.g., converting a "NO" position in one outcome
  // to positions in other outcomes)

  log.info("NegRisk PositionsConverted: stakeholder={}, marketId={}, indexSet={}, amount={}", [
    stakeholder.toHexString(),
    marketId.toHexString(),
    indexSet.toString(),
    amount.toString()
  ]);

  // Note: The actual balance updates from position conversions will be reflected
  // in the TransferSingle/TransferBatch events on the CTF contract, which we
  // already handle. This event provides context about the conversion operation.
}
