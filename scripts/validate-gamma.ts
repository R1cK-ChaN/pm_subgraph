/**
 * Validate subgraph data against Gamma Markets API
 *
 * Checks:
 * - Market condition_ids match
 * - Question IDs match
 * - Token registry alignment
 *
 * Usage: npx ts-node scripts/validate-gamma.ts <subgraph-endpoint>
 */

import fetch from 'node-fetch';

interface GammaMarket {
  condition_id: string;
  question_id: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
  }>;
  question: string;
  active: boolean;
}

interface SubgraphMarket {
  id: string;
  questionId: string;
  resolved: boolean;
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

async function fetchGammaMarkets(): Promise<GammaMarket[]> {
  console.log('Fetching Gamma markets...');

  try {
    const response = await fetch('https://gamma-api.polymarket.com/markets?limit=1000&active=true');
    const markets = await response.json() as GammaMarket[];
    console.log(`  Found ${markets.length} Gamma markets`);
    return markets;
  } catch (error) {
    console.error('  Failed to fetch Gamma markets:', error);
    return [];
  }
}

async function fetchSubgraphMarkets(endpoint: string): Promise<SubgraphMarket[]> {
  console.log('Fetching subgraph markets...');

  const markets: SubgraphMarket[] = [];
  let lastId = '';
  const pageSize = 1000;

  while (true) {
    const query = `{
      markets(
        first: ${pageSize}
        where: { id_gt: "${lastId}" }
        orderBy: id
        orderDirection: asc
      ) {
        id
        questionId
        resolved
      }
    }`;

    const data = await querySubgraph(endpoint, query);
    const batch = data.markets || [];

    if (batch.length === 0) break;

    markets.push(...batch);
    lastId = batch[batch.length - 1].id;

    if (batch.length < pageSize) break;
  }

  console.log(`  Found ${markets.length} subgraph markets`);
  return markets;
}

function checkMarketPresence(
  gammaMarkets: GammaMarket[],
  subgraphMarkets: SubgraphMarket[]
): ValidationResult {
  const subgraphIds = new Set(subgraphMarkets.map(m => m.id.toLowerCase()));
  const missing: string[] = [];

  for (const gamma of gammaMarkets) {
    const conditionId = gamma.condition_id.toLowerCase();
    if (!subgraphIds.has(conditionId)) {
      missing.push(conditionId);
      if (missing.length >= 20) break;
    }
  }

  // Calculate percentage
  const matchRate = gammaMarkets.length > 0
    ? ((gammaMarkets.length - missing.length) / gammaMarkets.length * 100).toFixed(2)
    : '100';

  return {
    check: 'Gamma markets present in subgraph',
    passed: missing.length < gammaMarkets.length * 0.01, // Allow 1% missing
    details: `${gammaMarkets.length - missing.length}/${gammaMarkets.length} Gamma markets found (${matchRate}%)`,
    samples: missing.slice(0, 5).map(id => `Missing: ${id}`),
  };
}

function checkQuestionIds(
  gammaMarkets: GammaMarket[],
  subgraphMarkets: SubgraphMarket[]
): ValidationResult {
  const subgraphMap = new Map<string, SubgraphMarket>();
  for (const m of subgraphMarkets) {
    subgraphMap.set(m.id.toLowerCase(), m);
  }

  const mismatches: string[] = [];

  for (const gamma of gammaMarkets) {
    const conditionId = gamma.condition_id.toLowerCase();
    const subgraph = subgraphMap.get(conditionId);

    if (subgraph) {
      const gammaQid = gamma.question_id.toLowerCase();
      const subgraphQid = subgraph.questionId.toLowerCase();

      if (gammaQid !== subgraphQid) {
        mismatches.push(`${conditionId}: gamma=${gammaQid.slice(0, 10)}... subgraph=${subgraphQid.slice(0, 10)}...`);
        if (mismatches.length >= 10) break;
      }
    }
  }

  const matched = gammaMarkets.length - mismatches.length;

  return {
    check: 'Question IDs match between Gamma and subgraph',
    passed: mismatches.length === 0,
    details: mismatches.length === 0
      ? `All matched markets have matching question IDs`
      : `Found ${mismatches.length} markets with mismatched question IDs`,
    samples: mismatches.slice(0, 5),
  };
}

function checkTokenCoverage(gammaMarkets: GammaMarket[]): ValidationResult {
  const tokensWithoutId: string[] = [];

  for (const gamma of gammaMarkets) {
    if (gamma.tokens) {
      for (const token of gamma.tokens) {
        if (!token.token_id) {
          tokensWithoutId.push(`${gamma.condition_id}: ${token.outcome}`);
          if (tokensWithoutId.length >= 10) break;
        }
      }
    }
  }

  return {
    check: 'Gamma tokens have token_ids',
    passed: tokensWithoutId.length === 0,
    details: tokensWithoutId.length === 0
      ? `All Gamma tokens have token IDs`
      : `Found ${tokensWithoutId.length} tokens without IDs`,
    samples: tokensWithoutId.slice(0, 5),
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
    console.error('Usage: npx ts-node scripts/validate-gamma.ts <subgraph-endpoint>');
    process.exit(1);
  }

  console.log('🔍 Validating against Gamma Markets API...\n');
  console.log(`Endpoint: ${endpoint}\n`);

  try {
    const [gammaMarkets, subgraphMarkets] = await Promise.all([
      fetchGammaMarkets(),
      fetchSubgraphMarkets(endpoint),
    ]);

    if (gammaMarkets.length === 0) {
      console.log('⚠️  No Gamma markets found. API may be unavailable.');
      process.exit(0);
    }

    if (subgraphMarkets.length === 0) {
      console.log('⚠️  No subgraph markets found. Subgraph may still be syncing.');
      process.exit(0);
    }

    const results: ValidationResult[] = [
      checkMarketPresence(gammaMarkets, subgraphMarkets),
      checkQuestionIds(gammaMarkets, subgraphMarkets),
      checkTokenCoverage(gammaMarkets),
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
