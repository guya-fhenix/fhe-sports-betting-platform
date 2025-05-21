import { useState } from 'react';
import {
  Box,
  Button,
  Text,
  VStack,
  Input,
  Heading
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { createBettingGroup } from '../services/blockchain';
import type { Tournament } from '../types';
import { toaster } from './ui/toaster';

interface CreateGroupProps {
  provider: ethers.BrowserProvider | null;
  tournament: Tournament;
  onSuccess?: () => void; // Callback for successful creation
}

const CreateGroup = ({ provider, tournament, onSuccess }: CreateGroupProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [description, setDescription] = useState('');
  const [registrationEndDateValue, setRegistrationEndDateValue] = useState('');
  const [prizeDistValues, setPrizeDistValues] = useState<number[]>([70, 30, 0]);
  const [generalClosingWindow, setGeneralClosingWindow] = useState(3600); // 1 hour in seconds
  
  const handlePrizeDistChange = (index: number, value: number) => {
    const newValues = [...prizeDistValues];
    newValues[index] = value;
    setPrizeDistValues(newValues);
  };
  
  const getTotalPrizeDist = () => {
    return prizeDistValues.reduce((acc, val) => acc + val, 0);
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
    
    // Process registration end time
    let registrationEndTime = 0;
    try {
      if (registrationEndDateValue) {
        const registrationEndDate = new Date(registrationEndDateValue);
        if (isNaN(registrationEndDate.getTime())) {
          throw new Error('Invalid registration end time format');
        }
        registrationEndTime = Math.floor(registrationEndDate.getTime() / 1000);
      } else {
        throw new Error('Registration end time is required');
      }
    } catch (error) {
      console.error('Error processing date:', error);
      toaster.error({
        title: 'Invalid Date Format',
        description: 'Please select a valid registration end time'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Prepare data for the contract call
    const data = {
      description,
      registrationEndTime,
      prizeDistribution: prizeDistValues,
      generalClosingWindow
    };
    
    // Show loading toast
    const loadingToastId = toaster.create({
      title: 'Creating Betting Group',
      description: 'Please wait while your betting group is being created on the blockchain...',
      type: 'loading'
    });

    try {
      console.log('Creating betting group with data:', data);
      const groupAddress = await createBettingGroup(provider, tournament.address, data);
      
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
            <Text mb={2}>Registration End Time</Text>
            <Input 
              type="datetime-local" 
              value={registrationEndDateValue}
              onChange={(e) => setRegistrationEndDateValue(e.target.value)}
              required
            />
            <Text fontSize="sm" color="gray.500">
              After this time, users cannot join the betting group
            </Text>
          </Box>
          
          <Box>
            <Text mb={2}>General Closing Window (seconds)</Text>
            <Input 
              type="number"
              min={60}
              value={generalClosingWindow}
              onChange={(e) => setGeneralClosingWindow(parseInt(e.target.value) || 3600)}
              required
            />
            <Text fontSize="sm" color="gray.500">
              Time before tournament end when all bets are automatically closed
            </Text>
          </Box>
          
          <Box>
            <Heading size="sm" mb={2}>Prize Distribution (%)</Heading>
            <Text 
              fontSize="sm" 
              color={getTotalPrizeDist() === 99.5 ? "green.500" : "red.500"} 
              mb={2}
            >
              Total: {getTotalPrizeDist()}% {getTotalPrizeDist() !== 99.5 && '(must equal 99.5%)'}
            </Text>
            
            <VStack gap={3} align="stretch">
              <Box>
                <Text fontSize="sm">1st Place</Text>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={prizeDistValues[0]}
                  onChange={(e) => handlePrizeDistChange(0, parseInt(e.target.value) || 0)}
                />
              </Box>
              
              <Box>
                <Text fontSize="sm">2nd Place</Text>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={prizeDistValues[1]}
                  onChange={(e) => handlePrizeDistChange(1, parseInt(e.target.value) || 0)}
                />
              </Box>
              
              <Box>
                <Text fontSize="sm">3rd Place</Text>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={prizeDistValues[2]}
                  onChange={(e) => handlePrizeDistChange(2, parseInt(e.target.value) || 0)}
                />
              </Box>
            </VStack>
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

export default CreateGroup; 