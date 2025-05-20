import fs from 'fs';
import path from 'path';

// Path to the Factory artifact JSON file
const factoryArtifactPath = path.join(
  __dirname, 
  '../artifacts/contracts/Factory.sol/Factory.json'
);

// Destinations for the exported ABI
const webAppDestination = path.join(
  __dirname, 
  '../../web-app/src/abi/factory-abi.json'
);
const cloudServiceDestination = path.join(
  __dirname, 
  '../../cloud-service/abi/factory-abi.json'
);

async function main() {
  console.log('Reading Factory artifact from:', factoryArtifactPath);
  
  // Read the Factory artifact
  const factoryArtifact = JSON.parse(
    fs.readFileSync(factoryArtifactPath, 'utf8')
  );
  
  // Extract the ABI
  const abi = factoryArtifact.abi;
  
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
  
  // Write the ABI to the web-app
  fs.writeFileSync(
    webAppDestination,
    JSON.stringify(abi, null, 2)
  );
  console.log('Exported ABI to:', webAppDestination);
  
  // Write the ABI to the cloud-service
  fs.writeFileSync(
    cloudServiceDestination,
    JSON.stringify(abi, null, 2)
  );
  console.log('Exported ABI to:', cloudServiceDestination);
  
  console.log('ABI export complete!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error exporting ABI:', error);
    process.exit(1);
  }); 