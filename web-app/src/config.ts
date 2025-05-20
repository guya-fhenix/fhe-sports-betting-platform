// Import deployed addresses if available
let deployedAddresses = {
  FACTORY_CONTRACT_ADDRESS: ''
};

try {
  // Try to import deployed addresses using dynamic import
  // This will work in Vite with JSON imports
  deployedAddresses = await import('./abi/deployed-addresses.json').then(m => m.default);
  console.log('Loaded deployed addresses:', deployedAddresses);
} catch (error) {
  console.log('No deployed addresses found, using environment variables');
}

// Contract addresses - prefer env vars, fall back to deployed addresses, then to default
export const FACTORY_CONTRACT_ADDRESS = 
  import.meta.env.VITE_FACTORY_CONTRACT_ADDRESS || 
  deployedAddresses.FACTORY_CONTRACT_ADDRESS || 
  '0x0000000000000000000000000000000000000000';

// API endpoints
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Import the Factory ABI from the exported file
// This will be imported at build time
import FactoryABI from './abi/factory-abi.json';
export const FACTORY_ABI = FactoryABI; 