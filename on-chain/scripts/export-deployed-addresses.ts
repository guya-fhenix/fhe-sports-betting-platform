import fs from 'fs';
import path from 'path';

// Get the network name from command line arguments or use 'localhost' as default
const network = process.argv[2] || 'localhost';
console.log(`Exporting deployed addresses for network: ${network}`);

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

  // Web app .env
  fs.writeFileSync(
    webAppEnvFile,
    `VITE_FACTORY_CONTRACT_ADDRESS=${addresses.FACTORY_CONTRACT_ADDRESS}\n` +
    `VITE_API_BASE_URL=http://localhost:8000\n`
  );
  console.log('Created web-app .env file:', webAppEnvFile);

  // Cloud service .env
  fs.writeFileSync(
    cloudServiceEnvFile,
    `# Blockchain settings\n` +
    `FACTORY_CONTRACT_ADDRESS=${addresses.FACTORY_CONTRACT_ADDRESS}\n` +
    `RPC_URL=http://localhost:8545\n` +
    `STARTING_BLOCK=0\n\n` +
    `# Redis settings\n` +
    `REDIS_HOST=localhost\n` +
    `REDIS_PORT=6379\n`
  );
  console.log('Created cloud-service .env file:', cloudServiceEnvFile);

  console.log('Address export complete!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error exporting addresses:', error);
    process.exit(1);
  }); 