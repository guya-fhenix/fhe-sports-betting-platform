#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Function to show usage
show_usage() {
  echo "Usage: $0 [NETWORK]"
  echo ""
  echo "Available networks:"
  echo "  localhost   - Uses localhost:8545 RPC (default)"
  echo "  localcofhe  - Uses localhost:42069 RPC"
  echo ""
  echo "Examples:"
  echo "  $0                # Uses localhost (default)"
  echo "  $0 localhost      # Uses localhost:8545"
  echo "  $0 localcofhe     # Uses localhost:42069"
  echo ""
}

# Check for help flag
if [[ "$1" == "-h" || "$1" == "--help" ]]; then
  show_usage
  exit 0
fi

# Get the network from arguments or use localhost as default
NETWORK=${1:-localhost}

# Validate network
if [[ "$NETWORK" != "localhost" && "$NETWORK" != "localcofhe" ]]; then
  echo "❌ Error: Unsupported network '$NETWORK'"
  echo ""
  show_usage
  exit 1
fi

echo "🚀 Exporting contract data for network: $NETWORK"

# Show network configuration
if [[ "$NETWORK" == "localhost" ]]; then
  echo "📡 RPC URL: http://localhost:8545"
elif [[ "$NETWORK" == "localcofhe" ]]; then
  echo "📡 RPC URL: http://localhost:42069"
fi

echo ""

# Change to the scripts directory
cd "$(dirname "$0")"

# Export ABIs
echo "📄 Exporting contract ABIs..."
npx ts-node export-abi.ts
npx ts-node export-tournament-abi.ts
npx ts-node export-bettinggroup-abi.ts

# Export deployed addresses
echo "🏭 Exporting deployed addresses for $NETWORK..."
npx ts-node export-deployed-addresses.ts $NETWORK

echo ""
echo "✅ Export complete!"
echo ""
echo "📁 The following files have been created:"
echo "  - web-app/src/abi/factory-abi.json"
echo "  - web-app/src/abi/tournament-abi.json"
echo "  - web-app/src/abi/bettinggroup-abi.json"
echo "  - web-app/src/abi/deployed-addresses.json"
echo "  - cloud-service/abi/factory-abi.json"
echo "  - cloud-service/abi/tournament-abi.json"
echo "  - cloud-service/abi/bettinggroup-abi.json"
echo "  - cloud-service/abi/deployed-addresses.json"
echo ""
echo "🔧 Environment files have also been created:"
echo "  - web-app/.env"
echo "  - cloud-service/.env"
echo ""
echo "🎯 Network: $NETWORK"
if [[ "$NETWORK" == "localhost" ]]; then
  echo "🔗 RPC URL: http://localhost:8545"
elif [[ "$NETWORK" == "localcofhe" ]]; then
  echo "🔗 RPC URL: http://localhost:42069"
fi 