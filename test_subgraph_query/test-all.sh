#!/bin/bash
# Test all query categories

ENDPOINT="https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0"

echo "🧪 Running All Test Queries"
echo "============================"
echo ""

test_query() {
  local name=$1
  local query=$2

  echo -n "Testing: $name... "

  # Use jq to properly construct JSON to avoid quote escaping issues
  RESULT=$(curl -s "$ENDPOINT" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg q "$query" '{query: $q}')")

  if echo "$RESULT" | jq -e '.data' > /dev/null 2>&1; then
    echo "✅"
    return 0
  else
    echo "❌"
    echo "$RESULT" | jq '.errors' 2>/dev/null
    return 1
  fi
}

# Test basic queries
echo "📋 Category 1: Basic Queries"
test_query "Health Check" "{ _meta { hasIndexingErrors } }"
test_query "Global Stats" "{ globalStats(id: \"global\") { totalMarkets } }"
echo ""

# Test market queries
echo "🏪 Category 2: Market Queries"
test_query "Active Markets" "{ markets(first: 5) { id tradeCount } }"
test_query "Resolved Markets" "{ markets(first: 5, where: {resolved: true}) { id winningOutcome } }"
echo ""

# Test user queries
echo "👥 Category 3: User Queries"
test_query "Top Traders" "{ users(first: 5, orderBy: totalVolume, orderDirection: desc) { id totalVolume } }"
test_query "Active Users" "{ users(first: 5, where: {tradeCount_gt: 0}) { id tradeCount } }"
echo ""

# Test trade queries
echo "💱 Category 4: Trade Queries"
test_query "Recent Trades" "{ trades(first: 5, orderBy: timestamp, orderDirection: desc) { id price } }"
test_query "Large Trades" "{ trades(first: 5, orderBy: cost, orderDirection: desc) { id cost } }"
echo ""

# Test position queries
echo "📊 Category 5: Position Queries"
test_query "Active Positions" "{ positions(first: 5, where: {balance_gt: \"0\"}) { id balance } }"
test_query "Profitable Positions" "{ positions(first: 5, where: {realizedPnL_gt: \"0\"}) { id realizedPnL } }"
echo ""

# Test analytics queries
echo "📈 Category 6: Analytics Queries"
test_query "Market Participation" "{ marketParticipations(first: 5) { id volume } }"
test_query "Token Registry" "{ tokenRegistries(first: 5) { id tokenId } }"
echo ""

# Test time series queries
echo "⏱️  Category 7: Time Series Queries"
test_query "Daily Stats" "{ dailyStats_collection(first: 5, orderBy: dayTimestamp, orderDirection: desc) { id volume } }"
test_query "Recent Activity" "{ dailyStats_collection(first: 1, orderBy: dayTimestamp, orderDirection: desc) { tradeCount activeUsers } }"
echo ""

echo "================================"
echo "✅ Test suite completed!"
echo ""
echo "💡 For detailed queries, check the .graphql files in this directory"
echo "💡 Use GraphQL Playground: $ENDPOINT"
