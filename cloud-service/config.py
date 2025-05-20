import os
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Try to load deployed addresses
DEPLOYED_ADDRESSES_PATH = os.path.join(os.path.dirname(__file__), 'abi/deployed-addresses.json')
deployed_factory_address = None

try:
    if os.path.exists(DEPLOYED_ADDRESSES_PATH):
        with open(DEPLOYED_ADDRESSES_PATH, 'r') as f:
            deployed_addresses = json.load(f)
            deployed_factory_address = deployed_addresses.get('FACTORY_CONTRACT_ADDRESS')
            print(f"Loaded deployed Factory address from file: {deployed_factory_address}")
except Exception as e:
    print(f"Error loading deployed addresses: {e}")

# Blockchain settings
# Priority: ENV var -> deployed address -> default
FACTORY_CONTRACT_ADDRESS = os.getenv("FACTORY_CONTRACT_ADDRESS") or deployed_factory_address or "0x0000000000000000000000000000000000000000"
RPC_URL = os.getenv("RPC_URL", "http://localhost:8545")
STARTING_BLOCK = int(os.getenv("STARTING_BLOCK", "0"))  # Default to 0 (genesis block)

# Redis settings
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

# Check required environment variables
if not FACTORY_CONTRACT_ADDRESS or FACTORY_CONTRACT_ADDRESS == "0x0000000000000000000000000000000000000000":
    print("Warning: FACTORY_CONTRACT_ADDRESS not set or is zero address") 