import fs from 'fs';
import path from 'path';

// Get the network name from command line arguments or use 'localhost' as default
const network = process.argv[2] || 'localhost';
console.log(`Exporting deployed addresses for network: ${network}`);

// Network configuration
const networkConfig = {
  localhost: {
    rpcUrl: 'http://localhost:8545',
    apiUrl: 'http://localhost:8000'
  },
  localcofhe: {
    rpcUrl: 'http://localhost:42069',
    apiUrl: 'http://localhost:8000'
  }
};

// Validate network
if (!networkConfig[network as keyof typeof networkConfig]) {
  console.error(`Unsupported network: ${network}`);
  console.error(`Supported networks: ${Object.keys(networkConfig).join(', ')}`);
  process.exit(1);
}

const config = networkConfig[network as keyof typeof networkConfig];

// Path to the network deployment file
const deploymentFilePath = path.join(__dirname, '../deployments', `${network}.json`);

// Destinations for the exported addresses
const webAppDestination = path.join(
  __dirname, 
  '../../web-app/src/abi/deployed-addresses.json'
);
const cloudServiceDestination = path.join(
  __dirname, 
  '../../cloud-service/abi/deployed-addresses.json'
);

async function main() {
  // Check if deployment file exists
  if (!fs.existsSync(deploymentFilePath)) {
    console.error(`Deployment file not found for network: ${network}`);
    console.error(`Expected file: ${deploymentFilePath}`);
    console.error(`Available deployment files:`);
    const deploymentsDir = path.join(__dirname, '../deployments');
    if (fs.existsSync(deploymentsDir)) {
      const files = fs.readdirSync(deploymentsDir).filter(f => f.endsWith('.json'));
      files.forEach(file => console.error(`  - ${file}`));
    }
    return;
  }

  // Read deployment file
  const deployments = JSON.parse(
    fs.readFileSync(deploymentFilePath, 'utf8')
  );

  // Check if Factory deployment exists
  if (!deployments.Factory) {
    console.error(`Factory deployment not found in network: ${network}`);
    console.error(`Available deployments: ${Object.keys(deployments).join(', ')}`);
    return;
  }

  // Get the Factory address
  const factoryAddress = deployments.Factory;

  // Create the addresses object
  const addresses = {
    FACTORY_CONTRACT_ADDRESS: factoryAddress,
    networkName: network,
    rpcUrl: config.rpcUrl,
    deploymentTime: new Date().toISOString()
  };

  console.log('Extracted addresses:', addresses);

  // Create directories if they don't exist
  const webAppDir = path.dirname(webAppDestination);
  const cloudServiceDir = path.dirname(cloudServiceDestination);
  
  if (!fs.existsSync(webAppDir)) {
    fs.mkdirSync(webAppDir, { recursive: true });
    console.log('Created directory:', webAppDir);
  }
  
  if (!fs.existsSync(cloudServiceDir)) {
    fs.mkdirSync(cloudServiceDir, { recursive: true });
    console.log('Created directory:', cloudServiceDir);
  }

  // Write the addresses to the web-app
  fs.writeFileSync(
    webAppDestination,
    JSON.stringify(addresses, null, 2)
  );
  console.log('Exported addresses to:', webAppDestination);
  
  // Write the addresses to the cloud-service
  fs.writeFileSync(
    cloudServiceDestination,
    JSON.stringify(addresses, null, 2)
  );
  console.log('Exported addresses to:', cloudServiceDestination);
  
  // Create .env files with deployed addresses
  const webAppEnvFile = path.join(__dirname, '../../web-app/.env');
  const cloudServiceEnvFile = path.join(__dirname, '../../cloud-service/.env');

  // Web app .env content
  const webAppEnvContent = 
    `# Contract addresses for ${network} network\n` +
    `VITE_FACTORY_CONTRACT_ADDRESS=${addresses.FACTORY_CONTRACT_ADDRESS}\n` +
    `VITE_API_BASE_URL=${config.apiUrl}\n` +
    `VITE_RPC_URL=${config.rpcUrl}\n` +
    `VITE_NETWORK=${network}\n`;

  // Cloud service .env content
  const cloudServiceEnvContent = 
    `# Blockchain settings for ${network} network\n` +
    `FACTORY_CONTRACT_ADDRESS=${addresses.FACTORY_CONTRACT_ADDRESS}\n` +
    `RPC_URL=${config.rpcUrl}\n` +
    `NETWORK=${network}\n` +
    `STARTING_BLOCK=0\n\n` +
    `# Redis settings\n` +
    `REDIS_HOST=localhost\n` +
    `REDIS_PORT=6379\n\n` +
    `# API settings\n` +
    `PORT=8000\n` +
    `NODE_ENV=development\n`;

  // Write .env files
  fs.writeFileSync(webAppEnvFile, webAppEnvContent);
  console.log('Created web-app .env file:', webAppEnvFile);

  fs.writeFileSync(cloudServiceEnvFile, cloudServiceEnvContent);
  console.log('Created cloud-service .env file:', cloudServiceEnvFile);

  console.log('\n✅ Address export complete!');
  console.log(`📡 Network: ${network}`);
  console.log(`🔗 RPC URL: ${config.rpcUrl}`);
  console.log(`🏭 Factory Address: ${factoryAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error exporting addresses:', error);
    process.exit(1);
  }); 