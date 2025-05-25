# Export Scripts

These scripts help export contract artifacts (ABIs and addresses) from the compiled contracts to be used in your frontend and backend applications.

## Available Scripts

- `export-abi.ts`: Exports the Factory contract ABI
- `export-tournament-abi.ts`: Exports the Tournament contract ABI
- `export-bettinggroup-abi.ts`: Exports the BettingGroup contract ABI
- `export-deployed-addresses.ts`: Exports the deployed contract addresses for a specific network
- `export-all.sh`: Runs all export scripts in sequence

## Supported Networks

The export scripts support the following networks:

| Network     | RPC URL                | Description                    |
|-------------|------------------------|--------------------------------|
| `localhost` | `http://localhost:8545` | Standard Hardhat local network |
| `localcofhe`| `http://localhost:42069`| Local CoFHE network           |

## Usage

### Export Everything

The simplest way to use these scripts is to run the `export-all.sh` script after deploying your contracts:

```bash
# For localhost network (default)
./scripts/export-all.sh

# Or explicitly specify localhost
./scripts/export-all.sh localhost

# For localcofhe network
./scripts/export-all.sh localcofhe
```

You can also get help with:
```bash
./scripts/export-all.sh --help
```

This will:
1. Export all contract ABIs (Factory, Tournament, BettingGroup) to both web-app and cloud-service
2. Export the deployed addresses for the specified network
3. Create `.env` files for both applications with the correct RPC URLs

### Export Only ABIs

If you only want to export the ABIs (without addresses):

```bash
npx ts-node scripts/export-abi.ts
npx ts-node scripts/export-tournament-abi.ts
npx ts-node scripts/export-bettinggroup-abi.ts
```

### Export Only Addresses

If you only want to export the addresses for a specific network:

```bash
# For localhost
npx ts-node scripts/export-deployed-addresses.ts localhost

# For localcofhe
npx ts-node scripts/export-deployed-addresses.ts localcofhe
```

## How It Works

The export process creates the following files:

1. **ABIs:**
   - `web-app/src/abi/factory-abi.json`
   - `web-app/src/abi/tournament-abi.json`
   - `web-app/src/abi/bettinggroup-abi.json`
   - `cloud-service/abi/factory-abi.json`
   - `cloud-service/abi/tournament-abi.json`
   - `cloud-service/abi/bettinggroup-abi.json`

2. **Addresses:**
   - `web-app/src/abi/deployed-addresses.json`
   - `cloud-service/abi/deployed-addresses.json`

3. **Environment Files:**
   - `web-app/.env` (with `VITE_FACTORY_CONTRACT_ADDRESS`, `VITE_RPC_URL`, `VITE_NETWORK`)
   - `cloud-service/.env` (with `FACTORY_CONTRACT_ADDRESS`, `RPC_URL`, `NETWORK`, etc.)

## Network Configuration

The scripts automatically configure the correct RPC URLs and environment variables based on the selected network:

### Localhost Network
- **RPC URL:** `http://localhost:8545`
- **Deployment File:** `deployments/localhost.json`
- **Use Case:** Standard Hardhat development

### LocalCoFHE Network
- **RPC URL:** `http://localhost:42069`
- **Deployment File:** `deployments/localcofhe.json`
- **Use Case:** FHE (Fully Homomorphic Encryption) development

## Workflow

The recommended workflow is:

1. **Compile your contracts:**
   ```bash
   npx hardhat compile
   ```

2. **Deploy your contracts:**
   ```bash
   # For localhost
   npx hardhat deploy-factory --network localhost
   
   # For localcofhe
   npx hardhat deploy-factory --network localcofhe
   ```

3. **Export the ABI and deployed addresses:**
   ```bash
   # For localhost
   ./scripts/export-all.sh localhost
   
   # For localcofhe
   ./scripts/export-all.sh localcofhe
   ```

4. **Start your applications:**
   ```bash
   # Start the cloud service
   cd ../cloud-service
   python main.py

   # Start the web app
   cd ../web-app
   pnpm dev
   ```

This ensures that both your applications use the correct ABI, deployed contract addresses, and RPC URLs for the selected network.

## Troubleshooting

### Deployment File Not Found
If you get an error about a missing deployment file, make sure you've deployed your contracts to the correct network first:

```bash
# Check available deployment files
ls deployments/

# Deploy if missing
npx hardhat deploy-factory --network [localhost|localcofhe]
```

### Unsupported Network
The scripts only support `localhost` and `localcofhe` networks. If you need to add support for other networks, update the `networkConfig` object in `export-deployed-addresses.ts`. 