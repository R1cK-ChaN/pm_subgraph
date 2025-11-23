#!/usr/bin/env ts-node
/**
 * Export sample data from subgraph for testing and analysis
 * Usage: ts-node export-samples.ts [endpoint]
 */

import fetch from 'node-fetch';
import * as fs from 'fs';
import * as path from 'path';

const ENDPOINT = process.argv[2] || 'https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0';
const OUTPUT_DIR = 'sample-data';

interface QueryResponse {
  data?: any;
  errors?: any[];
}

async function query(queryString: string): Promise<any> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: queryString }),
  });

  const json: QueryResponse = await response.json();

  if (json.errors) {
    console.error('Query errors:', json.errors);
    throw new Error('Query failed');
  }

  return json.data;
}

async function exportGlobalStats() {
  console.log('📊 Exporting global statistics...');

  const data = await query(`{
    globalStats(id: "global") {
      totalMarkets
      resolvedMarkets
      totalTrades
      totalVolume
      totalFees
      totalUsers
      lastUpdatedBlock
      lastUpdatedTimestamp
    }
    _meta {
      block {
        number
        timestamp
      }
      hasIndexingErrors
    }
  }`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'global-stats.json'),
    JSON.stringify(data, null, 2)
  );

  console.log('  ✅ Saved to global-stats.json');
}

async function exportSampleMarkets() {
  console.log('🏪 Exporting sample markets...');

  const data = await query(`{
    markets(first: 100, orderBy: totalVolume, orderDirection: desc) {
      id
      questionId
      outcomeSlotCount
      tradeCount
      totalVolume
      uniqueTraders
      resolved
      winningOutcome
      creationTimestamp
      resolutionTimestamp
    }
  }`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'sample-markets.json'),
    JSON.stringify(data.markets, null, 2)
  );

  console.log(`  ✅ Exported ${data.markets.length} markets`);
}

async function exportSampleUsers() {
  console.log('👥 Exporting sample users...');

  const data = await query(`{
    users(first: 100, orderBy: totalVolume, orderDirection: desc) {
      id
      tradeCount
      totalVolume
      totalFeesPaid
      marketsTraded
      firstTradeTimestamp
      lastTradeTimestamp
    }
  }`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'sample-users.json'),
    JSON.stringify(data.users, null, 2)
  );

  console.log(`  ✅ Exported ${data.users.length} users`);
}

async function exportSampleTrades() {
  console.log('💱 Exporting sample trades...');

  const data = await query(`{
    trades(first: 100, orderBy: timestamp, orderDirection: desc) {
      id
      market { id }
      trader { id }
      outcomeIndex
      side
      amount
      price
      cost
      fee
      timestamp
      exchange
    }
  }`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'sample-trades.json'),
    JSON.stringify(data.trades, null, 2)
  );

  console.log(`  ✅ Exported ${data.trades.length} trades`);
}

async function exportDailyStats() {
  console.log('📈 Exporting daily statistics...');

  const data = await query(`{
    dailyStats_collection(first: 90, orderBy: dayTimestamp, orderDirection: desc) {
      id
      dayTimestamp
      newMarkets
      resolvedMarkets
      tradeCount
      volume
      fees
      newUsers
      activeUsers
    }
  }`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'daily-stats.json'),
    JSON.stringify(data.dailyStats_collection, null, 2)
  );

  console.log(`  ✅ Exported ${data.dailyStats_collection.length} days of data`);
}

async function exportSamplePositions() {
  console.log('📊 Exporting sample positions...');

  const data = await query(`{
    positions(first: 100, where: {balance_gt: "0"}, orderBy: balance, orderDirection: desc) {
      id
      outcomeIndex
      balance
      avgBuyPrice
      avgSellPrice
      realizedPnL
      tradeCount
      lastUpdated
    }
  }`);

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'sample-positions.json'),
    JSON.stringify(data.positions, null, 2)
  );

  console.log(`  ✅ Exported ${data.positions.length} positions`);
}

async function exportSummary() {
  console.log('📝 Creating summary...');

  const stats = JSON.parse(
    fs.readFileSync(path.join(OUTPUT_DIR, 'global-stats.json'), 'utf-8')
  );

  const summary = {
    exportDate: new Date().toISOString(),
    endpoint: ENDPOINT,
    globalStats: stats.globalStats,
    syncStatus: stats._meta,
    files: [
      'global-stats.json',
      'sample-markets.json',
      'sample-users.json',
      'sample-trades.json',
      'sample-positions.json',
      'daily-stats.json'
    ]
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'README.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('  ✅ Summary created');
}

async function main() {
  console.log('🚀 Polymarket Subgraph Sample Data Export');
  console.log('=========================================');
  console.log(`Endpoint: ${ENDPOINT}\n`);

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    await exportGlobalStats();
    await exportSampleMarkets();
    await exportSampleUsers();
    await exportSampleTrades();
    await exportDailyStats();
    await exportSamplePositions();
    await exportSummary();

    console.log('\n✅ All sample data exported successfully!');
    console.log(`📁 Files saved to: ${OUTPUT_DIR}/`);

  } catch (error) {
    console.error('\n❌ Export failed:', error);
    process.exit(1);
  }
}

main();
