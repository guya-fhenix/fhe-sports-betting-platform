import { useState } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  Input,
  Heading,
  HStack,
  Icon
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { createBettingGroup } from '../services/blockchain';
import type { Tournament } from '../types';
import { toaster } from './ui/toaster';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

interface CreateGroupProps {
  provider: ethers.BrowserProvider | null;
  tournament: Tournament;
  onSuccess?: () => void; // Callback for successful creation
}

const CreateGroup = ({ provider, tournament, onSuccess }: CreateGroupProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [entryFee, setEntryFee] = useState('0.01'); // Default entry fee in ETH
  const [prizeDistValues, setPrizeDistValues] = useState<number[]>([99.5]); // Default to one place with 99.5%
  const [generalClosingWindowMinutes, setGeneralClosingWindowMinutes] = useState(60); // 1 hour in minutes
  
  const handlePrizeDistChange = (index: number, value: number) => {
    const newValues = [...prizeDistValues];
    newValues[index] = value;
    setPrizeDistValues(newValues);
  };
  
  const getTotalPrizeDist = () => {
    return prizeDistValues.reduce((acc, val) => acc + val, 0);
  };

  const addPrizePlace = () => {
    setPrizeDistValues([...prizeDistValues, 0]);
  };

  const removePrizePlace = (index: number) => {
    if (prizeDistValues.length <= 1) {
      // Always keep at least one prize place
      return;
    }
    const newValues = [...prizeDistValues];
    newValues.splice(index, 1);
    setPrizeDistValues(newValues);
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!provider) {
      toaster.error({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to create a betting group'
      });
      return;
    }
    
    if (!tournament) {
      toaster.error({
        title: 'Tournament Not Found',
        description: 'Tournament information is required to create a betting group'
      });
      return;
    }
    
    // Validate prize distribution
    if (getTotalPrizeDist() !== 99.5) {
      toaster.error({
        title: 'Invalid Prize Distribution',
        description: 'Prize distribution must add up to 99.5%'
      });
      return;
    }

    // Ensure we have at least one prize place
    if (prizeDistValues.length < 1) {
      toaster.error({
        title: 'Invalid Prize Distribution',
        description: 'You must have at least one prize place'
      });
      return;
    }
    
    // Validate entry fee
    try {
      // Parse entry fee to check if it's valid
      const entryFeeEth = parseFloat(entryFee);
      if (isNaN(entryFeeEth) || entryFeeEth <= 0) {
        throw new Error('Entry fee must be greater than 0');
      }
    } catch (error) {
      console.error('Error processing entry fee:', error);
      toaster.error({
        title: 'Invalid Entry Fee',
        description: error instanceof Error ? error.message : 'Please enter a valid entry fee amount'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Convert minutes to seconds for the contract
    const generalClosingWindowSeconds = generalClosingWindowMinutes * 60;
    
    // Show loading toast
    const loadingToastId = toaster.create({
      title: 'Creating Betting Group',
      description: 'Please wait while your betting group is being created on the blockchain...',
      type: 'loading'
    });

    try {
      console.log(`Creating betting group with entry fee: ${entryFee} ETH`);
      console.log(`Prize distribution (decimal): ${prizeDistValues.join(', ')}%`);
      
      // Call createBettingGroup with the required parameters
      // Note: The service will convert decimal percentages (99.5) to integers (995) for the contract
      const groupAddress = await createBettingGroup(
        provider, 
        tournament.address, 
        {
          description,
          registrationEndTime: tournament.startTime, // Use tournament start time
          prizeDistribution: prizeDistValues, // Decimal percentages (e.g., 99.5, 70.0, 29.5)
          generalClosingWindow: generalClosingWindowSeconds,
          entryFee // Pass the entry fee to the blockchain service
        }
      );
      
      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
      
      // Show success toast
      toaster.success({
        title: 'Betting Group Created',
        description: (
          <>
            Betting group created successfully.
            <Box as="div" mt={1} wordBreak="break-all" fontSize="sm">
              Address: {groupAddress}
            </Box>
          </>
        )
      });
      
    } catch (error) {
      console.error('Error creating betting group:', error);
      toaster.error({
        title: 'Group Creation Failed',
        description: 'Failed to create betting group. Please try again.'
      });
    } finally {
      // Remove loading toast
      toaster.dismiss(loadingToastId);
      setIsSubmitting(false);
    }
  };
  
  return (
    <Box maxW="800px" mx="auto" p={4}>
      <form onSubmit={handleSubmit}>
        <VStack gap={6} align="stretch">
          <Box>
            <Text mb={2}>Group Description</Text>
            <Input 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter betting group description"
              required
            />
          </Box>
          
          <Box>
            <Text fontSize="sm" color="gray.500" mb={2}>Tournament:</Text>
            <Text fontWeight="bold">{tournament.description}</Text>
            <Text fontSize="xs" fontFamily="monospace" mt={1}>{tournament.address}</Text>
          </Box>
          
          <Box borderTop="1px" borderColor="gray.200" pt={4} />
          
          <Box>
            <Text mb={2}>Entry Fee (ETH)</Text>
            <HStack>
              <Input 
                type="number"
                min="0.0001"
                step="0.001"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                required
              />
              <Text fontWeight="bold" ml={2}>ETH</Text>
            </HStack>
            <Text fontSize="sm" color="gray.500" mt={1}>
              Amount each participant must pay to join the betting group
            </Text>
          </Box>
          
          <Box>
            <Text mb={2}>General Closing Window (minutes)</Text>
            <Input 
              type="number"
              min={1}
              max={1440} // 24 hours in minutes
              value={generalClosingWindowMinutes}
              onChange={(e) => setGeneralClosingWindowMinutes(parseInt(e.target.value) || 60)}
              required
            />
            <Text fontSize="sm" color="gray.500">
              Time before tournament end when all bets are automatically closed (1-1440 minutes)
            </Text>
          </Box>
          
          <Box>
            <HStack justify="space-between" mb={2}>
              <Heading size="sm">Prize Distribution (%)</Heading>
              <Button 
                size="sm" 
                onClick={addPrizePlace}
                colorScheme="teal"
                variant="outline"
              >
                <Icon as={FiPlus} mr={2} />
                Add Place
              </Button>
            </HStack>
            
            <Text 
              fontSize="sm" 
              color={getTotalPrizeDist() === 99.5 ? "green.500" : "red.500"} 
              mb={2}
              fontWeight="bold"
            >
              Total: {getTotalPrizeDist()}% {getTotalPrizeDist() !== 99.5 && '(must equal 99.5%)'}
            </Text>
            
            <VStack gap={3} align="stretch">
              {prizeDistValues.map((value, index) => (
                <HStack key={index}>
                  <Box flex="1">
                    <Text fontSize="sm">{index + 1}{getOrdinal(index + 1)} Place</Text>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={value}
                      onChange={(e) => handlePrizeDistChange(index, parseFloat(e.target.value) || 0)}
                    />
                  </Box>
                  {prizeDistValues.length > 1 && (
                    <Button 
                      colorScheme="red" 
                      variant="ghost"
                      size="sm"
                      onClick={() => removePrizePlace(index)}
                      aria-label={`Remove ${index + 1}${getOrdinal(index + 1)} place`}
                    >
                      <Icon as={FiTrash2} />
                    </Button>
                  )}
                </HStack>
              ))}
            </VStack>
            
            <Text fontSize="xs" color="gray.500" mt={2}>
              Note: 0.5% is reserved as platform fee
            </Text>
          </Box>
          
          <Button
            colorScheme="teal"
            type="submit"
            size="lg"
            mt={4}
            disabled={!provider || getTotalPrizeDist() !== 99.5 || isSubmitting}
          >
            {isSubmitting ? "Creating..." : "Create Betting Group"}
          </Button>
          
          {!provider && (
            <Text color="red.500" fontSize="sm">
              Connect your wallet to create a betting group
            </Text>
          )}
        </VStack>
      </form>
    </Box>
  );
};

// Helper function to get ordinal suffix
const getOrdinal = (n: number): string => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export default CreateGroup; 