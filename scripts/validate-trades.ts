/**
 * Validate trade data integrity
 *
 * Checks:
 * - Price bounds [0, 1]
 * - No duplicate trades (unique txHash-logIndex)
 * - Required fields present
 *
 * Usage: npx ts-node scripts/validate-trades.ts <subgraph-endpoint>
 */

import fetch from 'node-fetch';

interface Trade {
  id: string;
  price: string;
  amount: string;
  cost: string;
  side: string;
  transactionHash: string;
  logIndex: string;
  exchange: string;
}

interface ValidationResult {
  check: string;
  passed: boolean;
  details: string;
  samples?: string[];
}

async function querySubgraph(endpoint: string, query: string): Promise<any> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  if (data.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

async function fetchAllTrades(endpoint: string, limit: number = 10000): Promise<Trade[]> {
  const trades: Trade[] = [];
  let lastId = '';
  const pageSize = 1000;

  console.log(`Fetching trades (max ${limit})...`);

  while (trades.length < limit) {
    const query = `{
      trades(
        first: ${pageSize}
        where: { id_gt: "${lastId}" }
        orderBy: id
        orderDirection: asc
      ) {
        id
        price
        amount
        cost
        side
        transactionHash
        logIndex
        exchange
      }
    }`;

    const data = await querySubgraph(endpoint, query);
    const batch = data.trades || [];

    if (batch.length === 0) break;

    trades.push(...batch);
    lastId = batch[batch.length - 1].id;

    if (batch.length < pageSize) break;

    process.stdout.write(`\r  Fetched ${trades.length} trades...`);
  }

  console.log(`\n  Total: ${trades.length} trades`);
  return trades;
}

function checkPriceBounds(trades: Trade[]): ValidationResult {
  const outOfBounds: string[] = [];

  for (const trade of trades) {
    const price = parseFloat(trade.price);
    if (isNaN(price) || price < 0 || price > 1) {
      outOfBounds.push(`${trade.id}: price=${trade.price}`);
      if (outOfBounds.length >= 10) break; // Sample only
    }
  }

  return {
    check: 'Price bounds [0, 1]',
    passed: outOfBounds.length === 0,
    details: outOfBounds.length === 0
      ? `All ${trades.length} trades have valid prices`
      : `Found ${outOfBounds.length} trades with invalid prices`,
    samples: outOfBounds.slice(0, 5),
  };
}

function checkDuplicates(trades: Trade[]): ValidationResult {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const trade of trades) {
    const key = `${trade.transactionHash}-${trade.logIndex}`;
    if (seen.has(key)) {
      duplicates.push(`${key}: ${seen.get(key)} and ${trade.id}`);
      if (duplicates.length >= 10) break;
    } else {
      seen.set(key, trade.id);
    }
  }

  return {
    check: 'No duplicate trades (unique txHash-logIndex)',
    passed: duplicates.length === 0,
    details: duplicates.length === 0
      ? `All ${trades.length} trades have unique identifiers`
      : `Found ${duplicates.length} duplicate trades`,
    samples: duplicates.slice(0, 5),
  };
}

function checkRequiredFields(trades: Trade[]): ValidationResult {
  const invalid: string[] = [];

  for (const trade of trades) {
    const issues: string[] = [];

    if (!trade.side || (trade.side !== 'BUY' && trade.side !== 'SELL')) {
      issues.push(`invalid side: ${trade.side}`);
    }

    if (!trade.transactionHash) {
      issues.push('missing txHash');
    }

    if (!trade.exchange || (trade.exchange !== 'legacy' && trade.exchange !== 'negrisk')) {
      issues.push(`invalid exchange: ${trade.exchange}`);
    }

    if (issues.length > 0) {
      invalid.push(`${trade.id}: ${issues.join(', ')}`);
      if (invalid.length >= 10) break;
    }
  }

  return {
    check: 'Required fields present and valid',
    passed: invalid.length === 0,
    details: invalid.length === 0
      ? `All ${trades.length} trades have valid required fields`
      : `Found ${invalid.length} trades with invalid fields`,
    samples: invalid.slice(0, 5),
  };
}

function checkAmountCostConsistency(trades: Trade[]): ValidationResult {
  const inconsistent: string[] = [];

  for (const trade of trades) {
    const amount = parseFloat(trade.amount);
    const cost = parseFloat(trade.cost);
    const price = parseFloat(trade.price);

    if (amount > 0 && cost > 0 && price > 0) {
      // Price should approximately equal cost/amount
      const calculatedPrice = cost / amount;
      const diff = Math.abs(calculatedPrice - price);
      const tolerance = 0.0001; // Allow small floating point differences

      if (diff > tolerance) {
        inconsistent.push(`${trade.id}: price=${price}, calculated=${calculatedPrice.toFixed(6)}`);
        if (inconsistent.length >= 10) break;
      }
    }
  }

  return {
    check: 'Amount/cost/price consistency',
    passed: inconsistent.length === 0,
    details: inconsistent.length === 0
      ? `All ${trades.length} trades have consistent price calculations`
      : `Found ${inconsistent.length} trades with inconsistent prices`,
    samples: inconsistent.slice(0, 5),
  };
}

function printResult(result: ValidationResult): void {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${result.check}`);
  console.log(`  ${result.details}`);

  if (result.samples && result.samples.length > 0) {
    console.log('  Samples:');
    for (const sample of result.samples) {
      console.log(`    - ${sample}`);
    }
  }
}

async function main(): Promise<void> {
  const endpoint = process.argv[2];

  if (!endpoint) {
    console.error('Usage: npx ts-node scripts/validate-trades.ts <subgraph-endpoint>');
    process.exit(1);
  }

  console.log('🔍 Validating trade data integrity...\n');
  console.log(`Endpoint: ${endpoint}\n`);

  try {
    const trades = await fetchAllTrades(endpoint);

    if (trades.length === 0) {
      console.log('⚠️  No trades found. Subgraph may still be syncing.');
      process.exit(0);
    }

    const results: ValidationResult[] = [
      checkPriceBounds(trades),
      checkDuplicates(trades),
      checkRequiredFields(trades),
      checkAmountCostConsistency(trades),
    ];

    console.log('\n=== Validation Results ===');

    let passed = 0;
    let failed = 0;

    for (const result of results) {
      printResult(result);
      if (result.passed) passed++;
      else failed++;
    }

    console.log('\n=== Summary ===');
    console.log(`Passed: ${passed}/${results.length}`);
    console.log(`Failed: ${failed}/${results.length}`);

    if (failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
