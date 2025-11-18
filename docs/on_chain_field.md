Short answer: **No.** Every field in that `Market` entity can be filled **directly from on‑chain events** emitted by the Conditional Tokens (CTF) contract on Polygon; you do **not** need Gamma for these. Gamma is great for **human‑readable metadata** (market title, category, slugs, images, etc.) and CLOB token mapping, and you typically **join it later by `condition_id`** (which equals the CTF `conditionId`). ([Conditional Tokens][1])

---

## Where each field comes from (on‑chain)

All of these are available from the CTF contract and block context:

* **`id`** – use the CTF **`conditionId`** emitted when a condition (market) is created via `prepareCondition`. It’s the keccak of `(oracle, questionId, outcomeSlotCount)`. Map this 1:1 to your `Market.id`. ([Conditional Tokens][1])
* **`questionId`** – emitted in **`ConditionPreparation`**; it’s a `bytes32` identifier (not the human text). ([Conditional Tokens][1])
* **`oracle`** – emitted in **`ConditionPreparation`**. ([Conditional Tokens][1])
* **`outcomeSlotCount`** – emitted in **`ConditionPreparation`** (or obtainable from `getOutcomeSlotCount(conditionId)`). ([Conditional Tokens][1])
* **`creationTimestamp`** – the block timestamp of the **`ConditionPreparation`** event.
* **`resolved`** – becomes `true` once **`ConditionResolution`** fires. ([Conditional Tokens][2])
* **`resolutionTimestamp`** – the block timestamp of **`ConditionResolution`**. ([Conditional Tokens][2])
* **`winningOutcome`** – derive from the **`payoutNumerators`** array in **`ConditionResolution`**. For binary markets, the winning outcome is the index whose numerator is non‑zero (or max if you prefer a generic “argmax” rule); handle ties/invalids by leaving `winningOutcome` null or storing the full vector. ([Conditional Tokens][2])

> Tip: After resolution, holders of winning outcome tokens redeem via `redeemPositions` according to that payout vector; this validates your derivation logic. ([Polymarket Documentation][3])

---

## When to use Gamma (and what for)

Gamma is Polymarket’s hosted index that **enriches** on‑chain data with metadata. You’d typically pull from Gamma **outside** your subgraph and **join on `condition_id`**:

* Gamma’s market object explicitly maps a market to **`condition_id` (CTF conditionId)** and **`question_id`**, plus **CLOB token ids**, **market address**, etc. ([Polymarket Documentation][4])
* The CLOB “Get Markets” endpoint shows `condition_id: string — id of market which is also the CTF condition ID`, and returns things like `tokens`, `category`, and sizing constraints. ([Polymarket Documentation][5])
* The general Gamma Markets API provides **market lists/filters** for UI & research, and additional metadata (categorization, indexed volume). ([Polymarket Documentation][6])
* For human‑readable pieces (e.g., `question`, `slug`, `category`, `endDate`, `resolutionSource`) you can hit the **“Get market by id”** endpoint. ([Polymarket Documentation][7])

Your own slide deck captured the recommended architecture succinctly: **index on‑chain with a subgraph, then join Gamma off‑chain by `conditionId`** to produce a “complete dataset.” 

---

## Important implementation detail (The Graph)

Mapping code in subgraphs must remain **deterministic** and cannot call arbitrary HTTP APIs like Gamma during indexing. The supported off‑chain reads are file data sources (IPFS/Arweave). So the normal pattern is:

1. **Subgraph** indexes on‑chain events (CTF + Exchange).
2. **External worker** (cron/Lambda/etc.) calls Gamma and stores metadata (keyed by `condition_id`).
3. **Join in your app/warehouse**, or publish periodic snapshots to IPFS if you want the subgraph to ingest metadata deterministically. ([The Graph][8])

---

## Minimal mapping sketch for your `Market` entity

```ts
// mapping.ts (AssemblyScript)
import { Market } from "../generated/schema";
import {
  ConditionPreparation as ConditionPreparationEvent,
  ConditionResolution as ConditionResolutionEvent
} from "../generated/CTF/ConditionalTokens";

export function handleConditionPreparation(ev: ConditionPreparationEvent): void {
  const id = ev.params.conditionId.toHex();
  let m = Market.load(id);
  if (m == null) m = new Market(id);
  m.questionId = ev.params.questionId;
  m.oracle = ev.params.oracle;
  m.outcomeSlotCount = ev.params.outcomeSlotCount.toI32();
  m.creationTimestamp = ev.block.timestamp;
  m.resolved = false;
  m.save();
}

export function handleConditionResolution(ev: ConditionResolutionEvent): void {
  const id = ev.params.conditionId.toHex();
  let m = Market.load(id);
  if (m == null) m = new Market(id); // safety
  m.resolved = true;
  m.resolutionTimestamp = ev.block.timestamp;

  // derive a simple winner for binary cases:
  let winner: i32 = -1;
  let best = ev.params.payoutNumerators.length > 0 ? ev.params.payoutNumerators[0] : null;
  for (let i = 0; i < ev.params.payoutNumerators.length; i++) {
    if (best == null || ev.params.payoutNumerators[i] > best!) {
      best = ev.params.payoutNumerators[i];
      winner = i as i32;
    }
  }
  m.winningOutcome = winner >= 0 ? winner : null;
  m.save();
}
```

* The event names and fields (`ConditionPreparation`, `ConditionResolution`, `payoutNumerators`) come straight from the CTF contract spec. ([Conditional Tokens][1])

---

## Bottom line

For the `Market` schema you posted, **populate everything on‑chain via the CTF events**. Use **Gamma only to enrich with descriptive metadata** and CLOB details, and **join on `conditionId` / `condition_id`** in your app or data pipeline. This “on‑chain subgraph + Gamma join” approach is precisely the architecture we recommend for Polymarket historical indexing. ([Polymarket Documentation][4]) 

If you’d like, I can extend your schema with an optional **`MarketMetadata`** entity (holding `question`, `category`, `slug`, etc.) and outline the small worker that fetches Gamma and writes periodic snapshots you can join against.

[1]: https://conditional-tokens.readthedocs.io/en/latest/developer-guide.html?utm_source=chatgpt.com "Developer Guide — Conditional Tokens 1.0.3 documentation"
[2]: https://conditional-tokens.readthedocs.io/en/latest/developer-guide.html "Developer Guide — Conditional Tokens 1.0.3 documentation"
[3]: https://docs.polymarket.com/developers/CTF/redeem?utm_source=chatgpt.com "Reedeeming Tokens"
[4]: https://docs.polymarket.com/developers/gamma-markets-api/gamma-structure?utm_source=chatgpt.com "Gamma Structure"
[5]: https://docs.polymarket.com/developers/CLOB/markets/get-markets?utm_source=chatgpt.com "Get Markets"
[6]: https://docs.polymarket.com/developers/gamma-markets-api/get-markets?utm_source=chatgpt.com "Get Markets"
[7]: https://docs.polymarket.com/api-reference/markets/get-market-by-id?utm_source=chatgpt.com "Get market by id"
[8]: https://thegraph.com/docs/en/subgraphs/developing/creating/advanced/?utm_source=chatgpt.com "Advanced Subgraph Features | Docs"
