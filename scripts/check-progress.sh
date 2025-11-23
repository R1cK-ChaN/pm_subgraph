#!/bin/bash
# Monitor subgraph sync progress

ENDPOINT="https://api.studio.thegraph.com/query/117232/polymarket-subgraph/v1.0.0"

echo "=== Polymarket Subgraph Sync Status ==="
echo ""

# Get metadata
RESPONSE=$(curl -s "$ENDPOINT" \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "{ _meta { block { number timestamp } hasIndexingErrors } globalStats(id: \"global\") { totalMarkets totalTrades totalVolume totalUsers } }"
  }')

# Parse and display
echo "$RESPONSE" | jq -r '
  .data._meta.block as $block |
  .data._meta.hasIndexingErrors as $errors |
  .data.globalStats as $stats |

  "Current Block: " + ($block.number | tostring) +
  "\nTimestamp: " + ($block.timestamp | tostring | tonumber | strftime("%Y-%m-%d %H:%M:%S")) +
  "\nIndexing Errors: " + ($errors | tostring) +
  "\n" +
  "\n📊 Global Statistics:" +
  "\n  Markets: " + ($stats.totalMarkets | tostring) +
  "\n  Trades: " + ($stats.totalTrades | tostring) +
  "\n  Users: " + ($stats.totalUsers | tostring) +
  "\n  Volume: $" + (($stats.totalVolume | tonumber / 1000000) | tostring | .[0:10]) + "M"
'

# Get current Polygon block
CURRENT_BLOCK=$(curl -s https://polygon-rpc.com \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | \
  jq -r '.result' | xargs printf "%d\n")

INDEXED_BLOCK=$(echo "$RESPONSE" | jq -r '.data._meta.block.number')
PROGRESS=$(echo "scale=2; $INDEXED_BLOCK * 100 / $CURRENT_BLOCK" | bc)

echo ""
echo "⏳ Progress:"
echo "  Indexed: $INDEXED_BLOCK"
echo "  Current: $CURRENT_BLOCK"
echo "  Progress: $PROGRESS%"
