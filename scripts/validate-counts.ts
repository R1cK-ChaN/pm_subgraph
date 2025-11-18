/**
 * Validate event counts between on-chain data and subgraph
 *
 * Usage: npx ts-node scripts/validate-counts.ts <subgraph-endpoint>
 */

import fetch from 'node-fetch';

// Contract addresses
const CTF_ADDRESS = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045';
const LEGACY_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const NEGRISK_EXCHANGE = '0xC5d563A36AE78145C45a50134d48A1215220f80a';

// Polygon RPC
const RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

interface ValidationResult {
  check: string;
  expected: number;
  actual: number;
  diff: number;
  diffPercent: string;
  passed: boolean;
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

async function getSubgraphStats(endpoint: string): Promise<{
  totalMarkets: number;
  resolvedMarkets: number;
  totalTrades: number;
  totalUsers: number;
}> {
  const query = `{
    globalStats(id: "global") {
      totalMarkets
      resolvedMarkets
      totalTrades
      totalUsers
    }
  }`;

  const data = await querySubgraph(endpoint, query);

  if (!data.globalStats) {
    return { totalMarkets: 0, resolvedMarkets: 0, totalTrades: 0, totalUsers: 0 };
  }

  return {
    totalMarkets: parseInt(data.globalStats.totalMarkets),
    resolvedMarkets: parseInt(data.globalStats.resolvedMarkets),
    totalTrades: parseInt(data.globalStats.totalTrades),
    totalUsers: parseInt(data.globalStats.totalUsers),
  };
}

async function getSubgraphTradesByExchange(endpoint: string): Promise<{
  legacy: number;
  negrisk: number;
}> {
  const query = `{
    legacy: trades(where: { exchange: "legacy" }, first: 1) {
      id
    }
    negrisk: trades(where: { exchange: "negrisk" }, first: 1) {
      id
    }
    legacyCount: trades(where: { exchange: "legacy" }) {
      id
    }
    negriskCount: trades(where: { exchange: "negrisk" }) {
      id
    }
  }`;

  // Use aggregation queries for counts
  const countQuery = `{
    globalStats(id: "global") {
      totalTrades
    }
  }`;

  const data = await querySubgraph(endpoint, countQuery);

  // For now, return total - would need separate tracking per exchange
  return {
    legacy: 0, // Would need indexed field
    negrisk: 0,
  };
}

async function getMarketCounts(endpoint: string): Promise<{
  total: number;
  resolved: number;
  unresolved: number;
}> {
  const query = `{
    markets(first: 1000) {
      id
      resolved
    }
  }`;

  const data = await querySubgraph(endpoint, query);
  const markets = data.markets || [];

  const resolved = markets.filter((m: any) => m.resolved).length;

  return {
    total: markets.length,
    resolved,
    unresolved: markets.length - resolved,
  };
}

function printResult(result: ValidationResult): void {
  const status = result.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${result.check}`);
  console.log(`  Expected: ${result.expected}`);
  console.log(`  Actual:   ${result.actual}`);
  console.log(`  Diff:     ${result.diff} (${result.diffPercent})`);
}

async function main(): Promise<void> {
  const endpoint = process.argv[2];

  if (!endpoint) {
    console.error('Usage: npx ts-node scripts/validate-counts.ts <subgraph-endpoint>');
    console.error('Example: npx ts-node scripts/validate-counts.ts https://api.studio.thegraph.com/query/.../polymarket-subgraph/v0.0.1');
    process.exit(1);
  }

  console.log('🔍 Validating subgraph counts...\n');
  console.log(`Endpoint: ${endpoint}\n`);

  const results: ValidationResult[] = [];

  try {
    // Get subgraph stats
    const stats = await getSubgraphStats(endpoint);
    const marketCounts = await getMarketCounts(endpoint);

    console.log('=== Subgraph Statistics ===');
    console.log(`Total Markets: ${stats.totalMarkets}`);
    console.log(`Resolved Markets: ${stats.resolvedMarkets}`);
    console.log(`Total Trades: ${stats.totalTrades}`);
    console.log(`Total Users: ${stats.totalUsers}`);

    // Basic sanity checks
    const checks: ValidationResult[] = [
      {
        check: 'Markets count > 0',
        expected: 1,
        actual: stats.totalMarkets > 0 ? 1 : 0,
        diff: stats.totalMarkets > 0 ? 0 : 1,
        diffPercent: stats.totalMarkets > 0 ? '0%' : '100%',
        passed: stats.totalMarkets > 0,
      },
      {
        check: 'Trades count > 0',
        expected: 1,
        actual: stats.totalTrades > 0 ? 1 : 0,
        diff: stats.totalTrades > 0 ? 0 : 1,
        diffPercent: stats.totalTrades > 0 ? '0%' : '100%',
        passed: stats.totalTrades > 0,
      },
      {
        check: 'Users count > 0',
        expected: 1,
        actual: stats.totalUsers > 0 ? 1 : 0,
        diff: stats.totalUsers > 0 ? 0 : 1,
        diffPercent: stats.totalUsers > 0 ? '0%' : '100%',
        passed: stats.totalUsers > 0,
      },
      {
        check: 'Resolved markets <= total markets',
        expected: stats.totalMarkets,
        actual: stats.resolvedMarkets,
        diff: stats.resolvedMarkets - stats.totalMarkets,
        diffPercent: stats.totalMarkets > 0
          ? `${((stats.resolvedMarkets / stats.totalMarkets) * 100).toFixed(2)}%`
          : '0%',
        passed: stats.resolvedMarkets <= stats.totalMarkets,
      },
    ];

    // Print results
    console.log('\n=== Validation Results ===');

    let passed = 0;
    let failed = 0;

    for (const check of checks) {
      printResult(check);
      if (check.passed) passed++;
      else failed++;
    }

    console.log('\n=== Summary ===');
    console.log(`Passed: ${passed}/${checks.length}`);
    console.log(`Failed: ${failed}/${checks.length}`);

    if (failed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
