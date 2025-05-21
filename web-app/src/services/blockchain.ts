import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_ABI } from '../config';
import type { TournamentCreateInput, GroupCreateInput } from '../types';

// Get the Factory contract
export const getFactoryContract = (provider: ethers.BrowserProvider, withSigner = false) => {
  if (!FACTORY_CONTRACT_ADDRESS) {
    throw new Error('Factory contract address not defined');
  }

  // Create the contract instance
  const contract = new ethers.Contract(FACTORY_CONTRACT_ADDRESS, FACTORY_ABI, provider);

  // If we need a signer, connect the contract to the signer
  if (withSigner) {
    return provider.getSigner().then(signer => {
      return contract.connect(signer);
    });
  }

  return Promise.resolve(contract);
};

// Tournament ABI - simplified for the specific functions we need
const TOURNAMENT_ABI = [
  "function getBettingOpportunities() view returns (tuple(string description, uint256 startTime, string[] options)[])",
  "function getResults() view returns (int8[])"
];

// Get a tournament contract instance
export const getTournamentContract = (provider: ethers.BrowserProvider, address: string) => {
  // Create the contract instance
  return new ethers.Contract(address, TOURNAMENT_ABI, provider);
};

// Get betting opportunities and results from a tournament
export const getTournamentOpportunities = async (
  provider: ethers.BrowserProvider,
  tournamentAddress: string
) => {
  try {
    // Get tournament contract
    const contract = getTournamentContract(provider, tournamentAddress);
    
    // Get betting opportunities
    const opportunities = await contract.getBettingOpportunities();
    
    // Get results if available
    let results: number[] = [];
    try {
      results = await contract.getResults();
    } catch (error) {
      console.log('No results set yet:', error);
      // Results not set yet, this is fine
    }
    
    // Format and merge opportunities with results
    const formattedOpportunities = opportunities.map((opp: any, index: number) => {
      return {
        description: opp.description,
        startTime: Number(opp.startTime),
        options: opp.options,
        result: results[index] >= 0 ? Number(results[index]) : null
      };
    });
    
    return formattedOpportunities;
  } catch (error) {
    console.error('Error fetching tournament opportunities:', error);
    return [];
  }
};

// Create a tournament
export const createTournament = async (
  provider: ethers.BrowserProvider,
  input: TournamentCreateInput
): Promise<string> => {
  const contract = await getFactoryContract(provider, true) as any;
  
  console.log('input', input);
  
  // Format the betting opportunities for blockchain:
  // 1. Keep the string options in the input for UI/storage
  // 2. Convert to numeric IDs for the contract
  const blockchainBettingOpportunities = input.bettingOpportunities.map(opportunity => {
    return {
      id: opportunity.id,
      description: opportunity.description,
      startTime: 0, // Explicitly set to 0
      options: opportunity.options
    };
  });
  
  console.log('Blockchain format:', blockchainBettingOpportunities);
  
  // Call the createTournament function
  const tx = await contract.createTournament(
    input.description,
    input.startTime,
    input.endTime,
    blockchainBettingOpportunities
  );

  console.log('Transaction:', tx);
  
  // Wait for transaction to be mined
  const receipt = await tx.wait();
  
  console.log('Receipt:', receipt);
  
  // Extract the tournament address from the event logs
  const event = receipt.logs
    .filter((log: any) => log.eventName === 'TournamentCreated')
    .map((log: any) => log.args)[0];
  
  return event.tournamentAddress;
};

// Create a betting group for a tournament
export const createBettingGroup = async (
  provider: ethers.BrowserProvider,
  tournamentAddress: string,
  data: {
    description: string;
    registrationEndTime: number;
    prizeDistribution: number[];
    generalClosingWindow: number;
  }
): Promise<string> => {
  const contract = await getFactoryContract(provider, true) as any;
  
  console.log('Creating betting group with data:', {
    tournamentAddress,
    description: data.description,
    registrationEndTime: data.registrationEndTime,
    prizeDistribution: data.prizeDistribution,
    generalClosingWindow: data.generalClosingWindow
  });
  
  // Call the createBettingGroup function
  const tx = await contract.createBettingGroup(
    tournamentAddress,
    data.description,
    data.registrationEndTime,
    data.prizeDistribution,
    data.generalClosingWindow
  );
  
  console.log('Transaction sent:', tx.hash);
  
  // Wait for transaction to be mined
  const receipt = await tx.wait();
  console.log('Transaction confirmed:', receipt);
  
  // Extract the betting group address from the event logs
  const event = receipt.logs
    .filter((log: any) => log.eventName === 'BettingGroupCreated')
    .map((log: any) => log.args)[0];
  
  console.log('Betting group created at address:', event.bettingGroupAddress);
  
  return event.bettingGroupAddress;
}; 