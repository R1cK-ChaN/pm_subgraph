// Export subgraph data for analysis
// Usage: ts-node scripts/export-data.ts <ENDPOINT>

import fetch from 'node-fetch';
import * as fs from 'fs';

const ENDPOINT = process.argv[2] || 'https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0';

async function query(query: string, variables = {}) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const json = await response.json();
  return json.data;
}

async function exportTopTraders() {
  console.log('Exporting top traders...');
  const data = await query(`{
    users(first: 1000, orderBy: totalVolume, orderDirection: desc) {
      id
      tradeCount
      totalVolume
      totalFeesPaid
      marketsTraded
      firstTradeTimestamp
      lastTradeTimestamp
    }
  }`);

  fs.writeFileSync('exports/top-traders.json', JSON.stringify(data.users, null, 2));
  console.log(`✓ Exported ${data.users.length} traders to exports/top-traders.json`);
}

async function exportMarketStats() {
  console.log('Exporting market statistics...');
  const data = await query(`{
    markets(first: 1000, orderBy: totalVolume, orderDirection: desc) {
      id
      outcomeSlotCount
      tradeCount
      totalVolume
      uniqueTraders
      resolved
      winningOutcome
      creationTimestamp
    }
  }`);

  fs.writeFileSync('exports/markets.json', JSON.stringify(data.markets, null, 2));
  console.log(`✓ Exported ${data.markets.length} markets to exports/markets.json`);
}

async function exportDailyStats() {
  console.log('Exporting daily statistics...');
  const data = await query(`{
    dailyStats(first: 1000, orderBy: dayTimestamp, orderDirection: asc) {
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

  fs.writeFileSync('exports/daily-stats.json', JSON.stringify(data.dailyStats, null, 2));
  console.log(`✓ Exported ${data.dailyStats.length} days to exports/daily-stats.json`);
}

async function exportGlobalStats() {
  console.log('Exporting global statistics...');
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
  }`);

  fs.writeFileSync('exports/global-stats.json', JSON.stringify(data.globalStats, null, 2));
  console.log('✓ Exported global stats to exports/global-stats.json');
}

async function main() {
  // Create exports directory
  if (!fs.existsSync('exports')) {
    fs.mkdirSync('exports');
  }

  console.log(`Exporting data from: ${ENDPOINT}\n`);

  await exportGlobalStats();
  await exportTopTraders();
  await exportMarketStats();
  await exportDailyStats();

  console.log('\n✅ All data exported successfully!');
}

main().catch(console.error);
