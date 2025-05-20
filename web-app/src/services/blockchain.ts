import { ethers } from 'ethers';
import { FACTORY_CONTRACT_ADDRESS, FACTORY_ABI } from '../config';
import type { TournamentCreateInput, GroupCreateInput, BettingOpportunity } from '../types';

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

// Create a tournament
export const createTournament = async (
  provider: ethers.BrowserProvider,
  input: TournamentCreateInput
): Promise<string> => {
  const contract = await getFactoryContract(provider, true);
  
  // Format the betting opportunities as expected by the contract
  const bettingOpportunities = input.betting_opportunities.map(
    (opportunity: BettingOpportunity) => [
      opportunity.id,
      opportunity.description,
      opportunity.options
    ]
  );

  // Call the createTournament function
  const tx = await contract.createTournament(
    input.description,
    input.start_time,
    input.end_time,
    bettingOpportunities
  );

  // Wait for transaction to be mined
  const receipt = await tx.wait();
  
  // Extract the tournament address from the event logs
  const event = receipt.logs
    .filter((log: any) => log.eventName === 'TournamentCreated')
    .map((log: any) => log.args)[0];
  
  return event.tournamentAddress;
};

// Create a betting group
export const createBettingGroup = async (
  provider: ethers.BrowserProvider,
  input: GroupCreateInput
): Promise<string> => {
  const contract = await getFactoryContract(provider, true);
  
  // Call the createBettingGroup function
  const tx = await contract.createBettingGroup(
    input.description,
    input.tournament_address,
    ethers.parseEther(input.entry_fee.toString()),
    input.prize_distribution,
    input.general_closing_window
  );

  // Wait for transaction to be mined
  const receipt = await tx.wait();
  
  // Extract the betting group address from the event logs
  const event = receipt.logs
    .filter((log: any) => log.eventName === 'BettingGroupCreated')
    .map((log: any) => log.args)[0];
  
  return event.bettingGroupAddress;
}; 