import fs from 'fs';
import path from 'path';

// Path to the BettingGroup artifact JSON file
const bettingGroupArtifactPath = path.join(
  __dirname, 
  '../artifacts/contracts/BettingGroup.sol/BettingGroup.json'
);

// Destinations for the exported ABI
const webAppDestination = path.join(
  __dirname, 
  '../../web-app/src/abi/bettinggroup-abi.json'
);
const cloudServiceDestination = path.join(
  __dirname, 
  '../../cloud-service/abi/bettinggroup-abi.json'
);

async function main() {
  console.log('Reading BettingGroup artifact from:', bettingGroupArtifactPath);
  
  // Read the BettingGroup artifact
  const bettingGroupArtifact = JSON.parse(
    fs.readFileSync(bettingGroupArtifactPath, 'utf8')
  );
  
  // Extract the ABI
  const abi = bettingGroupArtifact.abi;
  
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
  console.log('Exported BettingGroup ABI to:', webAppDestination);
  
  // Write the ABI to the cloud-service
  fs.writeFileSync(
    cloudServiceDestination,
    JSON.stringify(abi, null, 2)
  );
  console.log('Exported BettingGroup ABI to:', cloudServiceDestination);
  
  console.log('BettingGroup ABI export complete!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error exporting BettingGroup ABI:', error);
    process.exit(1);
  }); 