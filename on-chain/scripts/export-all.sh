#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Get the network from arguments or use localhost as default
NETWORK=${1:-localhost}
echo "Exporting contract data for network: $NETWORK"

# Change to the scripts directory
cd "$(dirname "$0")"

# Export ABI
echo "Exporting contract ABIs..."
npx ts-node export-abi.ts

# Export deployed addresses
echo "Exporting deployed addresses for $NETWORK..."
npx ts-node export-deployed-addresses.ts $NETWORK

echo "Export complete!"
echo ""
echo "You can now use the exported contract ABI and addresses in your applications."
echo "The following files have been created:"
echo "  - web-app/src/abi/factory-abi.json"
echo "  - web-app/src/abi/deployed-addresses.json"
echo "  - cloud-service/abi/factory-abi.json"
echo "  - cloud-service/abi/deployed-addresses.json"
echo ""
echo "Environment files have also been created:"
echo "  - web-app/.env"
echo "  - cloud-service/.env" 