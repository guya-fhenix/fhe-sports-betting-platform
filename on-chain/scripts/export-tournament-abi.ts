import fs from 'fs';
import path from 'path';

// Path to the Tournament artifact JSON file
const tournamentArtifactPath = path.join(
  __dirname, 
  '../artifacts/contracts/Tournament.sol/Tournament.json'
);

// Destinations for the exported ABI
const webAppDestination = path.join(
  __dirname, 
  '../../web-app/src/abi/tournament-abi.json'
);
const cloudServiceDestination = path.join(
  __dirname, 
  '../../cloud-service/abi/tournament-abi.json'
);

async function main() {
  console.log('Reading Tournament artifact from:', tournamentArtifactPath);
  
  // Read the Tournament artifact
  const tournamentArtifact = JSON.parse(
    fs.readFileSync(tournamentArtifactPath, 'utf8')
  );
  
  // Extract the ABI
  const abi = tournamentArtifact.abi;
  
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
  console.log('Exported Tournament ABI to:', webAppDestination);
  
  // Write the ABI to the cloud-service
  fs.writeFileSync(
    cloudServiceDestination,
    JSON.stringify(abi, null, 2)
  );
  console.log('Exported Tournament ABI to:', cloudServiceDestination);
  
  console.log('Tournament ABI export complete!');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error exporting Tournament ABI:', error);
    process.exit(1);
  }); 