# Export Scripts

These scripts help export contract artifacts (ABIs and addresses) from the compiled contracts to be used in your frontend and backend applications.

## Available Scripts

- `export-abi.ts`: Exports the Factory contract ABI
- `export-deployed-addresses.ts`: Exports the deployed contract addresses for a specific network
- `export-all.sh`: Runs both export scripts in sequence

## Usage

### Export Everything

The simplest way to use these scripts is to run the `export-all.sh` script after deploying your contracts:

```bash
# Deploy your contracts first
npx hardhat deploy --network localhost

# Then export everything
./scripts/export-all.sh localhost
```

This will:
1. Export the Factory ABI to both web-app and cloud-service
2. Export the deployed addresses for the specified network
3. Create `.env` files for both applications

### Export Only ABI

If you only want to export the ABI (without addresses):

```bash
npx ts-node scripts/export-abi.ts
```

### Export Only Addresses

If you only want to export the addresses for a specific network:

```bash
npx ts-node scripts/export-deployed-addresses.ts localhost
```

Replace `localhost` with the name of the network you deployed to (`hardhat`, `goerli`, etc.).

## How It Works

The export process creates the following files:

1. ABIs:
   - `web-app/src/abi/factory-abi.json`
   - `cloud-service/abi/factory-abi.json`

2. Addresses:
   - `web-app/src/abi/deployed-addresses.json`
   - `cloud-service/abi/deployed-addresses.json`

3. Environment Files:
   - `web-app/.env` (with `VITE_FACTORY_CONTRACT_ADDRESS`)
   - `cloud-service/.env` (with `FACTORY_CONTRACT_ADDRESS`, `RPC_URL`, etc.)

## Workflow

The recommended workflow is:

1. Compile your contracts:
   ```bash
   npx hardhat compile
   ```

2. Deploy your contracts:
   ```bash
   npx hardhat deploy --network localhost
   ```

3. Export the ABI and deployed addresses:
   ```bash
   ./scripts/export-all.sh localhost
   ```

4. Start your applications:
   ```bash
   # Start the cloud service
   cd ../cloud-service
   python main.py

   # Start the web app
   cd ../web-app
   pnpm dev
   ```

This ensures that both your applications use the correct ABI and deployed contract addresses. 