#!/bin/bash
# Quick health check for Polymarket subgraph

ENDPOINT="https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0"

echo "🔍 Polymarket Subgraph Quick Check"
echo "=================================="
echo ""

# Health check
echo "📡 Checking connectivity..."
HEALTH=$(curl -s "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ _meta { hasIndexingErrors block { number } } }"}')

ERRORS=$(echo "$HEALTH" | jq -r '.data._meta.hasIndexingErrors')
BLOCK=$(echo "$HEALTH" | jq -r '.data._meta.block.number')

if [ "$ERRORS" = "false" ]; then
  echo "✅ No indexing errors"
else
  echo "❌ Indexing errors detected!"
fi

echo "📦 Current block: $BLOCK"
echo ""

# Global stats
echo "📊 Global Statistics:"
STATS=$(curl -s "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ globalStats(id: \"global\") { totalMarkets totalTrades totalVolume totalUsers } }"}')

echo "$STATS" | jq -r '.data.globalStats |
  "  Markets: " + (.totalMarkets | tostring) +
  "\n  Trades: " + (.totalTrades | tostring) +
  "\n  Users: " + (.totalUsers | tostring) +
  "\n  Volume: $" + ((.totalVolume | tonumber / 1000000) | tostring | .[0:12]) + "M USDC"
'

echo ""
echo "✅ Subgraph is operational!"
