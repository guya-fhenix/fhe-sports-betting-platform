import { useState } from 'react';
import {
  Box,
  Button as ChakraButton,
  Text,
  VStack,
  Input,
  Heading,
  HStack,
  Icon,
  Field
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { createBettingGroup } from '../services/blockchain';
import type { Tournament } from '../types';
import { toaster } from './ui/toaster';
import { Button } from './ui/button';
import { Card, CardBody, CardHeader } from './ui/card';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { CopyAddress } from './ui/copy-address';

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
    <Box maxW="800px" mx="auto">
      <form onSubmit={handleSubmit}>
        <VStack gap={8} align="stretch">
          {/* Group Details */}
          <Card variant="default">
            <CardHeader>
              <Heading size="lg" color="gray.800">Group Details</Heading>
            </CardHeader>
            <CardBody>
              <VStack gap={6} align="stretch">
                <Field.Root>
                  <Field.Label fontWeight="medium" color="gray.700">Group Description</Field.Label>
                  <Input 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter betting group description"
                    size="lg"
                    required
                  />
                </Field.Root>
                
                <Box
                  bg="gray.50"
                  p={4}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor="gray.200"
                >
                  <Text fontSize="sm" color="gray.500" mb={2} fontWeight="medium">
                    Tournament
                  </Text>
                  <Text fontWeight="semibold" color="gray.800" mb={3}>{tournament.description}</Text>
                  <CopyAddress 
                    address={tournament.address}
                    label="Tournament Address"
                    fontSize="sm"
                    variant="default"
                  />
                </Box>
              </VStack>
            </CardBody>
          </Card>
          
          {/* Entry Settings */}
          <Card variant="default">
            <CardHeader>
              <Heading size="lg" color="gray.800">Entry Settings</Heading>
            </CardHeader>
            <CardBody>
              <VStack gap={6} align="stretch">
                <Field.Root>
                  <Field.Label fontWeight="medium" color="gray.700">Entry Fee (ETH)</Field.Label>
                  <HStack gap={3}>
                    <Input 
                      type="number"
                      min="0.0001"
                      step="0.001"
                      value={entryFee}
                      onChange={(e) => setEntryFee(e.target.value)}
                      size="lg"
                      flex="1"
                      required
                    />
                    <Text fontWeight="semibold" color="gray.700" fontSize="lg">ETH</Text>
                  </HStack>
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Amount each participant must pay to join the betting group
                  </Text>
                </Field.Root>
                
                <Field.Root>
                  <Field.Label fontWeight="medium" color="gray.700">General Closing Window (minutes)</Field.Label>
                  <Input 
                    type="number"
                    min={1}
                    max={1440} // 24 hours in minutes
                    value={generalClosingWindowMinutes}
                    onChange={(e) => setGeneralClosingWindowMinutes(parseInt(e.target.value) || 60)}
                    size="lg"
                    required
                  />
                  <Text fontSize="sm" color="gray.500" mt={1}>
                    Time before tournament end when all bets are automatically closed (1-1440 minutes)
                  </Text>
                </Field.Root>
              </VStack>
            </CardBody>
          </Card>
          
          {/* Prize Distribution */}
          <Card variant="default">
            <CardHeader>
              <HStack justify="space-between" align="center">
                <Heading size="lg" color="gray.800">Prize Distribution</Heading>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={addPrizePlace}
                >
                  <Icon as={FiPlus} mr={2} />
                  Add Place
                </Button>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack gap={6} align="stretch">
                <Box
                  bg={getTotalPrizeDist() === 99.5 ? "success.50" : "error.50"}
                  p={4}
                  borderRadius="lg"
                  border="1px solid"
                  borderColor={getTotalPrizeDist() === 99.5 ? "success.200" : "error.200"}
                >
                  <Text 
                    fontSize="lg" 
                    color={getTotalPrizeDist() === 99.5 ? "success.700" : "error.700"} 
                    fontWeight="bold"
                    textAlign="center"
                  >
                    Total: {getTotalPrizeDist()}%
                  </Text>
                  {getTotalPrizeDist() !== 99.5 && (
                    <Text fontSize="sm" color="error.600" textAlign="center" mt={1}>
                      Must equal 99.5%
                    </Text>
                  )}
                </Box>
                
                <VStack gap={4} align="stretch">
                  {prizeDistValues.map((value, index) => (
                    <Card key={index} variant="outline">
                      <CardBody p={4}>
                        <HStack gap={4} align="end">
                          <Field.Root flex="1">
                            <Field.Label fontWeight="medium" color="gray.700">
                              {index + 1}{getOrdinal(index + 1)} Place (%)
                            </Field.Label>
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={value}
                              onChange={(e) => handlePrizeDistChange(index, parseFloat(e.target.value) || 0)}
                              size="md"
                            />
                          </Field.Root>
                          {prizeDistValues.length > 1 && (
                            <ChakraButton 
                              colorScheme="red" 
                              variant="ghost"
                              size="sm"
                              onClick={() => removePrizePlace(index)}
                              aria-label={`Remove ${index + 1}${getOrdinal(index + 1)} place`}
                            >
                              <Icon as={FiTrash2} />
                            </ChakraButton>
                          )}
                        </HStack>
                      </CardBody>
                    </Card>
                  ))}
                </VStack>
                
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  Note: 0.5% is reserved as platform fee
                </Text>
              </VStack>
            </CardBody>
          </Card>
          
          {/* Submit Section */}
          <Card variant="outline">
            <CardBody p={6}>
              <VStack gap={4} align="stretch">
                <Button
                  variant="solid"
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  loadingText="Creating Group..."
                  disabled={!provider || getTotalPrizeDist() !== 99.5}
                  w="100%"
                >
                  Create Betting Group
                </Button>
                
                {!provider && (
                  <Text color="error.500" fontSize="sm" textAlign="center">
                    Connect your wallet to create a betting group
                  </Text>
                )}
                
                {getTotalPrizeDist() !== 99.5 && (
                  <Text color="warning.500" fontSize="sm" textAlign="center">
                    Prize distribution must total 99.5% to continue
                  </Text>
                )}
              </VStack>
            </CardBody>
          </Card>
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