import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button as ChakraButton,
  Flex,
  Heading,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
  Input,
  Dialog,
  Wrap,
  WrapItem,
  Field
} from '@chakra-ui/react';
import { FiArrowLeft, FiCheck, FiUser, FiLogOut, FiAlertTriangle, FiX } from 'react-icons/fi';
import { ethers } from 'ethers';
import { getGroupByAddress } from '../services/api';
import { BETTING_GROUP_ABI, TOURNAMENT_ABI } from '../config';
import { formatBlockchainDateToLocal, getCurrentBlockchainTime } from '../utils/time';
import { toaster } from './ui/toaster';
import { Button } from './ui/button';
import { Card, CardBody, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import type { Group } from '../types';
import { CopyAddress } from './ui/copy-address';
// Static imports for cofhejs
import { cofhejs, Encryptable } from 'cofhejs/web';

// Define types for betting opportunities and user bets
interface BettingOpportunity {
  id: number;
  description: string;
  startTime: number;
  options: string[];
  endTime: number;
  resultsFinalized: boolean;
  result: number | null;
}

interface UserBet {
  id: number;
  placed: boolean;
  description: string;
  options: string[];
  startTime: number;
  endTime: number;
  resultsFinalized: boolean;
  result: number | null;
  predictedOption: string; // Raw value, could be encrypted
  pointsAwarded: string; // Raw value, could be encrypted
}

const BettingGroupScreen = () => {
  const navigate = useNavigate();
  const { tournamentAddress, groupAddress } = useParams<{ tournamentAddress: string; groupAddress: string }>();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [userName, setUserName] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isUserRegistered, setIsUserRegistered] = useState(false);
  const [participants, setParticipants] = useState<{address: string; name: string}[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [prizePool, setPrizePool] = useState('0');
  const [bets, setBets] = useState<UserBet[]>([]);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bettingOpportunities, setBettingOpportunities] = useState<BettingOpportunity[]>([]);
  const [userBetIds, setUserBetIds] = useState<number[]>([]);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [placingBetId, setPlacingBetId] = useState<number | null>(null);
  const [encryptionState, setEncryptionState] = useState<string>('');
  const [isCofhejsInitialized, setIsCofhejsInitialized] = useState(false);
  
  // Reference to provider
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  
  // Try to access parent component context if available
  const drawerContext = (window as any).__drawerContext;
  
  // Only update provider ref if it changes significantly
  if (drawerContext?.provider && drawerContext.provider !== providerRef.current) {
    providerRef.current = drawerContext.provider;
  }

  const openDialog = () => setDialogOpen(true);
  const closeDialog = () => setDialogOpen(false);
  
  // Initialize cofhejs
  const initializeCofhejs = useCallback(async () => {
    if (!providerRef.current || isCofhejsInitialized) return;
    
    console.log("Initializing cofhejs");

    try {
      const signer = await providerRef.current.getSigner();
      
      console.log("signer", signer);
      console.log("providerRef.current", providerRef.current);

      // Initialize with LOCAL environment
      console.log("Initializing with LOCAL environment...");
      const result = await cofhejs.initializeWithEthers({
        ethersProvider: providerRef.current,
        ethersSigner: signer,
        environment: "LOCAL"
      });

      console.log("LOCAL init results", result);
      if (!result.success) {
        throw new Error(`Failed to initialize cofhejs with LOCAL: ${result.error?.message}`);
      }
      
      console.log("cofhejs.store.getState()", cofhejs.store.getState());
      
      setIsCofhejsInitialized(true);
      console.log("Cofhejs initialized successfully with LOCAL environment");
    } catch (error) {
      console.error("Error initializing Cofhejs:", error);
      toaster.error({
        title: 'Encryption Setup Failed',
        description: `Failed to initialize encryption: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }, [providerRef, isCofhejsInitialized]);
  
  // Fetch group basic data
  const fetchGroup = useCallback(async () => {
    if (!groupAddress) return;
    
    try {
      const data = await getGroupByAddress(groupAddress);
      setGroup(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching group:', error);
      setLoading(false);
    }
  }, [groupAddress]);
  
  // Check if the betting group is active
  const checkGroupActive = useCallback(async () => {
    if (!groupAddress || !providerRef.current) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      const active = await contract.isActive();
      setIsActive(active);
    } catch (error) {
      console.error('Error checking if group is active:', error);
    }
  }, [groupAddress]);

  // Check if tournament has started
  const checkTournamentStarted = useCallback(async () => {
    if (!tournamentAddress || !providerRef.current) return;
    
    try {
      const tournamentContract = new ethers.Contract(
        tournamentAddress,
        TOURNAMENT_ABI,
        providerRef.current
      );
      
      const startTime = await tournamentContract.startTime();
      const now = getCurrentBlockchainTime();
      
      setTournamentStarted(now >= Number(startTime));
    } catch (error) {
      console.error('Error checking if tournament has started:', error);
    }
  }, [tournamentAddress]);
  
  // Check if the user is registered
  const checkUserRegistered = useCallback(async () => {
    if (!groupAddress || !providerRef.current) return;
    
    try {
      const signer = await providerRef.current.getSigner();
      const userAddress = await signer.getAddress();
      
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );

      console.log("userAddress", userAddress);
      console.log("groupAddress", groupAddress);
      console.log("checking if user is registered");
      
      const registered = await contract.isRegistered(userAddress);
      setIsUserRegistered(registered);
    } catch (error) {
      console.error('Error checking if user is registered:', error);
    }
  }, [groupAddress]);
  
  // Get participant information
  const fetchParticipants = useCallback(async () => {
    if (!groupAddress || !providerRef.current) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      // Get participant count
      const count = await contract.participantCount();
      setParticipantCount(Number(count));
      
      // Get prize pool
      const pool = await contract.getPrizePool();
      setPrizePool(ethers.formatEther(pool));
      
      // We can't easily get all participants without events or making custom functions
      // So we'll just show the count for now
    } catch (error) {
      console.error('Error fetching participants:', error);
    }
  }, [groupAddress]);
  
  // Fetch all betting opportunities from the tournament
  const fetchBettingOpportunities = useCallback(async () => {
    if (!tournamentAddress || !providerRef.current) return;
    
    try {
      const tournamentContract = new ethers.Contract(
        tournamentAddress,
        TOURNAMENT_ABI,
        providerRef.current
      );
      
      const opportunities = await tournamentContract.getBettingOpportunities();
      
      // Format opportunities
      const formattedOpportunities: BettingOpportunity[] = opportunities.map((opp: any) => ({
        id: Number(opp.id),
        description: opp.description,
        startTime: Number(opp.startTime),
        options: opp.options,
        endTime: Number(opp.endTime),
        resultsFinalized: opp.resultsFinalized,
        result: opp.resultsFinalized ? Number(opp.result) : null
      }));
      
      setBettingOpportunities(formattedOpportunities);
    } catch (error) {
      console.error('Error fetching betting opportunities:', error);
    }
  }, [tournamentAddress]);
  
  // Get user's bets
  const fetchUserBets = useCallback(async () => {
    if (!groupAddress || !providerRef.current || !isUserRegistered) return;
    
    try {
      const signer = await providerRef.current.getSigner();
      const userAddress = await signer.getAddress();
      
      console.log("=== FETCH USER BETS (Frontend) ===");
      console.log("User address (will be passed as parameter):", userAddress);
      console.log("Group address:", groupAddress);
      console.log("About to call getParticipantBets with user address...");
      
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );

      console.log("Contract instance created, calling getParticipantBets with address:", userAddress);
      
      // Get user bets - now passing userAddress as parameter
      const [betIds, betsData] = await contract.getParticipantBets(userAddress);

      console.log("getParticipantBets returned successfully");
      console.log("Bet IDs:", betIds);
      console.log("Bets data:", betsData);

      // Store the bet IDs that the user has placed
      const betIdNumbers = betIds.map((id: any) => Number(id));
      setUserBetIds(betIdNumbers);
      
      // Fetch betting opportunity details from tournament contract
      if (tournamentAddress) {
        const tournamentContract = new ethers.Contract(
          tournamentAddress,
          TOURNAMENT_ABI,
          providerRef.current
        );
        
        const opportunities = await tournamentContract.getBettingOpportunities();
        
        // Match bet IDs with opportunity details
        const formattedBets = betIds.map((id: number, index: number) => {
          const opportunity = opportunities.find((opp: any) => 
            Number(opp.id) === Number(id)
          );
          
          // Get the predicted option and points awarded values as strings
          // These may be encrypted values (starting with 'e')
          const predictedOption = betsData[index].predictedOption?.toString() || '0';
          const pointsAwarded = betsData[index].pointsAwarded?.toString() || '0';
          
          return {
            id: Number(id),
            placed: betsData[index].placed,
            description: opportunity ? opportunity.description : `Bet #${id}`,
            options: opportunity ? opportunity.options : [],
            startTime: opportunity ? Number(opportunity.startTime) : 0,
            endTime: opportunity ? Number(opportunity.endTime) : 0,
            resultsFinalized: opportunity ? opportunity.resultsFinalized : false,
            result: opportunity?.resultsFinalized ? Number(opportunity.result) : null,
            predictedOption,
            pointsAwarded
          };
        });
        
        setBets(formattedBets);
        console.log("Formatted bets:", formattedBets);
      }
    } catch (error) {
      console.error('Error fetching bets:', error);
    }
  }, [groupAddress, providerRef, isUserRegistered, tournamentAddress]);
  
  // Place a bet on a betting opportunity
  const placeBet = async (betId: number, optionIndex: number) => {
    if (!groupAddress || !providerRef.current || !isCofhejsInitialized || !isUserRegistered) return;
    
    // Show initial toast
    const loadingToastId = toaster.create({
      title: 'Preparing Bet',
      description: 'Encrypting your selected option...',
      type: 'loading'
    });

    try {
      setIsPlacingBet(true);
      setPlacingBetId(betId);
      
      // Log encryption state for toasts
      const logEncryptionState = (state: string) => {
        setEncryptionState(state);
        toaster.update(loadingToastId, {
          title: 'Encrypting Selection',
          description: `Status: ${state}`,
          type: 'loading'
        });
      };
      
      // Encrypt the option index using cofhejs
      console.log("Cofhejs instance:", cofhejs);
      console.log("Cofhejs state:", cofhejs.store.getState());
      const encryptedOption = await cofhejs.encrypt(logEncryptionState, [Encryptable.uint16(BigInt(optionIndex))]);
      
      console.log("Encrypted option:", encryptedOption);
      
      // Check if encryption was successful
      if (!encryptedOption.success) {
        // Encryption failed
        toaster.dismiss(loadingToastId);
        toaster.error({
          title: 'Encryption Failed',
          description: encryptedOption.error?.message || 'Failed to encrypt your bet'
        });
        return;
      }
      
      // Encryption successful, continue with transaction
      // Update toast
      toaster.update(loadingToastId, {
        title: 'Encryption Complete',
        description: 'Sending transaction to place bet...',
        type: 'loading'
      });
      
      // Get signer for transaction
      const signer = await providerRef.current.getSigner();
      
      // Get contract instance with signer
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        signer
      );
      
      // Call placeBet with the encrypted option
      const tx = await contract.placeBet(betId, encryptedOption.data[0]);
      
      // Update toast
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Dismiss loading toast
      toaster.dismiss(loadingToastId);
      
      // Show success toast
      toaster.success({
        title: 'Bet Placed Successfully',
        description: `Your bet has been placed on option "${bettingOpportunities.find(o => o.id === betId)?.options[optionIndex]}"`
      });
      
      // Update user's bets
      fetchUserBets();
      
    } catch (error: any) {
      console.error('Error placing bet:', error);
      
      // Only show error toast if the loading toast is still active
      // (avoid duplicate error messages)
      toaster.dismiss(loadingToastId);
      
      toaster.error({
        title: 'Bet Failed',
        description: error.message || 'Failed to place bet'
      });
    } finally {
      setIsPlacingBet(false);
      setPlacingBetId(null);
      setEncryptionState('');

      toaster.dismiss(loadingToastId);
    }
  };
  
  // Register for the betting group
  const registerForGroup = async () => {
    if (!groupAddress || !providerRef.current || !userName.trim() || !group) return;
    
    try {
      setIsRegistering(true);
      
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        signer
      );
      
      // Show transaction sent toast
      const loadingToastId = toaster.create({
        title: 'Registration Pending',
        description: 'Please confirm the transaction...',
        type: 'loading'
      });
      
      // Get the entry fee from the contract
      const entryFee = await contract.entryFee();
      
      // Register with payment of entry fee
      const tx = await contract.register(userName, {
        value: entryFee
      });
      
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Dismiss loading toast
      toaster.dismiss(loadingToastId);
      
      // Show success toast
      toaster.success({
        title: 'Registration Successful',
        description: `You are now registered as ${userName}`
      });
      
      // Update registration status and participants
      setIsUserRegistered(true);
      fetchParticipants();
      
    } catch (error: any) {
      console.error('Error registering for group:', error);
      toaster.error({
        title: 'Registration Failed',
        description: error.message || 'Unknown error'
      });
    } finally {
      setIsRegistering(false);
    }
  };

  // Withdraw from the betting group
  const withdrawFromBettingGroup = async () => {
    if (!groupAddress || !providerRef.current || !isUserRegistered || !isActive || tournamentStarted) return;
    
    try {
      setIsWithdrawing(true);
      
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        signer
      );
      
      // Show transaction sent toast
      const loadingToastId = toaster.create({
        title: 'Withdrawal Pending',
        description: 'Please confirm the transaction...',
        type: 'loading'
      });
      
      // Call the withdraw function
      const tx = await contract.withdrawFromBettingGroup();
      
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Dismiss loading toast
      toaster.dismiss(loadingToastId);
      
      // Show success toast
      toaster.success({
        title: 'Withdrawal Successful',
        description: 'You have successfully withdrawn from the betting group'
      });
      
      // Update registration status and participants
      setIsUserRegistered(false);
      fetchParticipants();
      closeDialog(); // Close the confirmation modal
      
    } catch (error: any) {
      console.error('Error withdrawing from group:', error);
      toaster.error({
        title: 'Withdrawal Failed',
        description: error.message || 'Unknown error'
      });
    } finally {
      setIsWithdrawing(false);
    }
  };
  
  // Fetch data when component mounts
  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);
  
  // Fetch contract data when provider is available
  useEffect(() => {
    if (providerRef.current) {
      checkGroupActive();
      checkUserRegistered();
      checkTournamentStarted();
      fetchParticipants();
      fetchBettingOpportunities();
      initializeCofhejs();
    }
  }, [checkGroupActive, checkUserRegistered, checkTournamentStarted, fetchParticipants, fetchBettingOpportunities, initializeCofhejs]);
  
  // Fetch user bets when registered status changes
  useEffect(() => {
    if (isUserRegistered) {
      fetchUserBets();
    }
  }, [isUserRegistered, fetchUserBets]);
  
  // Return to tournament page
  const goBackToTournament = () => {
    if (tournamentAddress) {
      navigate(`/tournaments/${tournamentAddress}`);
    } else {
      navigate('/');
    }
  };
  
  // Format date
  const formatDate = (timestamp: number) => {
    return formatBlockchainDateToLocal(timestamp);
  };
  
  // Get group status
  const getGroupStatus = () => {
    if (!group) return null;
    
    const now = getCurrentBlockchainTime();
    
    if (!isActive) {
      return <Badge variant="ended">Inactive</Badge>;
    } else if (now < group.registrationEndTime) {
      return <Badge variant="upcoming">Registration Open</Badge>;
    } else {
      return <Badge variant="active">Active</Badge>;
    }
  };

  // Check if a bet has been placed
  const hasBetBeenPlaced = (betId: number) => {
    return userBetIds.includes(betId);
  };
  
  // Check if betting window is open for an opportunity
  const isBettingWindowOpen = (opportunity: BettingOpportunity) => {
    if (!opportunity.startTime || opportunity.startTime === 0) {
      return false; // Start time not set
    }
    
    if (opportunity.resultsFinalized) {
      return false; // Results already finalized
    }
    
    const now = getCurrentBlockchainTime();
    const closingWindow = group?.generalClosingWindow || 0;
    
    // Betting is open if current time is before (startTime - closingWindow)
    return now < opportunity.startTime - closingWindow;
  };
  
  // Helper to format encrypted values for display
  const formatEncryptedValue = (value: string) => {
    if (!value || value === '0') {
      return 'No value';
    }
    
    // If the string starts with 'e', it's an encrypted value
    if (value.startsWith('e')) {
      return 'Encrypted value';
    }
    
    // Otherwise it's a regular value
    return value;
  };
  
  if (loading) {
    return (
      <Flex justify="center" align="center" minH="400px">
        <VStack gap={4}>
          <Spinner size="xl" color="brand.500" />
          <Text color="gray.500">Loading betting group...</Text>
        </VStack>
      </Flex>
    );
  }
  
  if (!group) {
    return (
      <Card variant="outline" maxW="md" mx="auto" mt={8}>
        <CardBody p={8}>
          <VStack gap={4}>
            <Heading size="md" textAlign="center" color="gray.700">Betting group not found</Heading>
            <Button variant="outline" onClick={goBackToTournament}>
              <Icon as={FiArrowLeft} mr={2} />
              Back to Tournament
            </Button>
          </VStack>
        </CardBody>
      </Card>
    );
  }
  
  return (
    <VStack align="stretch" gap={8} w="100%">
      {/* Group Header */}
      <Card variant="elevated">
        <CardBody p={6}>
          <VStack align="stretch" gap={6}>
            <HStack justify="space-between" wrap="wrap" gap={4}>
              <HStack gap={3}>
                <Button 
                  variant="ghost" 
                  onClick={goBackToTournament} 
                  size="md"
                  p={2}
                >
                  <Icon as={FiArrowLeft} boxSize={5} />
                </Button>
                <Heading size="xl" color="gray.800">{group.description}</Heading>
              </HStack>
              {getGroupStatus()}
            </HStack>
            
            <VStack align="stretch" gap={4}>
              <CopyAddress 
                address={group.address}
                label="Group Address"
                fontSize="sm"
                variant="default"
              />
              
              <CopyAddress 
                address={group.tournamentAddress}
                label="Tournament Address"
                fontSize="sm"
                variant="default"
              />
            </VStack>
            
            <HStack justify="space-between" wrap="wrap" gap={6}>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>Registration Ends</Text>
                <Text fontSize="lg" color="gray.800">{formatDate(group.registrationEndTime)}</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>Prize Distribution</Text>
                <Text fontSize="lg" color="gray.800">{group.prizeDistribution.map(value => (value / 10)).join(', ')}%</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>Closing Window</Text>
                <Text fontSize="lg" color="gray.800">{Math.round(group.generalClosingWindow / 60)} minutes</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>Participants</Text>
                <Text fontSize="lg" color="gray.800">{participantCount}</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>Prize Pool</Text>
                <Text fontSize="lg" color="brand.600" fontWeight="bold">{prizePool} ETH</Text>
              </Box>
            </HStack>
          </VStack>
        </CardBody>
      </Card>
      
      {/* Registration Section */}
      {isActive && !isUserRegistered && (
        <Card variant="outline">
          <CardHeader>
            <Heading size="lg" color="gray.800">Register for this Betting Group</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" gap={6}>
              <Field.Root>
                <Field.Label fontWeight="medium" color="gray.700">
                  Your Name
                </Field.Label>
                <Input 
                  placeholder="Enter your name" 
                  value={userName} 
                  onChange={(e) => setUserName(e.target.value)}
                  disabled={isRegistering}
                  size="lg"
                />
              </Field.Root>
              
              <Button
                variant="solid"
                size="lg"
                loading={isRegistering}
                onClick={registerForGroup}
                disabled={!userName.trim() || !providerRef.current}
                w="fit-content"
              >
                <Icon as={FiUser} mr={2} />
                Register for Group
              </Button>
            </VStack>
          </CardBody>
        </Card>
      )}
      
      {/* Registration Success */}
      {isUserRegistered && (
        <Card variant="outline" borderColor="success.200" bg="success.50">
          <CardBody p={6}>
            <HStack justify="space-between" wrap={{ base: "wrap", md: "nowrap" }} gap={4}>
              <HStack gap={3}>
                <Icon as={FiCheck} color="success.500" boxSize={6} />
                <Heading size="md" color="success.700">You are registered for this betting group</Heading>
              </HStack>
              
              {/* Withdraw button - Only show if tournament hasn't started yet and group is active */}
              {isActive && !tournamentStarted && (
                <Button
                  variant="error"
                  size="sm"
                  onClick={openDialog}
                >
                  <Icon as={FiLogOut} mr={2} />
                  Withdraw Registration
                </Button>
              )}
            </HStack>
          </CardBody>
        </Card>
      )}
      
      {/* Betting Opportunities Section */}
      {isUserRegistered && (
        <Card variant="default">
          <CardHeader>
            <Heading size="lg" color="gray.800">Bets</Heading>
          </CardHeader>
          <CardBody>
            {bettingOpportunities.length === 0 ? (
              <Box textAlign="center" py={12}>
                <Text color="gray.500" fontSize="lg">
                  No betting opportunities available for this tournament
                </Text>
                <Text color="gray.400" fontSize="sm" mt={2}>
                  Check back later for betting opportunities
                </Text>
              </Box>
            ) : (
              <VStack align="stretch" gap={4}>
                {bettingOpportunities.map((opportunity) => {
                  const hasPlacedBet = hasBetBeenPlaced(opportunity.id);
                  const canPlaceBet = true;
                  const userBet = bets.find(bet => bet.id === opportunity.id);
                  
                  return (
                    <Card 
                      key={opportunity.id} 
                      variant={hasPlacedBet ? "betting" : "outline"}
                      bg={hasPlacedBet ? "success.50" : "white"}
                      borderColor={hasPlacedBet ? "success.200" : "gray.200"}
                    >
                      <CardBody p={6}>
                        <VStack align="stretch" gap={4}>
                          <HStack justify="space-between" align="start">
                            <HStack gap={3}>
                              <Heading size="md" color="gray.800" flex="1">
                                {opportunity.description}
                              </Heading>
                              {hasPlacedBet && (
                                <Badge variant="success">Bet Placed</Badge>
                              )}
                            </HStack>
                            <VStack align="end" gap={2}>
                              {opportunity.startTime > 0 ? (
                                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                                  Starts: {formatDate(opportunity.startTime)}
                                </Text>
                              ) : (
                                <Text fontSize="sm" color="gray.600" fontWeight="medium">
                                  Start time not set
                                </Text>
                              )}
                              {opportunity.resultsFinalized ? (
                                <Badge variant="success">Results In</Badge>
                              ) : opportunity.startTime > 0 ? (
                                <Badge variant="active">Active</Badge>
                              ) : (
                                <Badge variant="ended">Not Started</Badge>
                              )}
                            </VStack>
                          </HStack>
                          
                          {/* Betting Options */}
                          <Box>
                            <Text fontSize="sm" fontWeight="semibold" mb={3} color="gray.700">
                              Betting Options:
                            </Text>
                            {canPlaceBet ? (
                              <Wrap gap={3}>
                                {opportunity.options.map((option, index) => (
                                  <WrapItem key={index}>
                                    <Button
                                      size="md"
                                      variant="outline"
                                      loading={isPlacingBet && placingBetId === opportunity.id}
                                      loadingText={encryptionState || "Placing..."}
                                      onClick={() => placeBet(opportunity.id, index)}
                                      disabled={!isCofhejsInitialized}
                                    >
                                      {option}
                                    </Button>
                                  </WrapItem>
                                ))}
                              </Wrap>
                            ) : (
                              <HStack flexWrap="wrap" gap={3}>
                                {opportunity.options.map((option, index) => (
                                  <Badge 
                                    key={index} 
                                    variant="outline"
                                    px={3}
                                    py={2}
                                    fontSize="sm"
                                  >
                                    {option}
                                  </Badge>
                                ))}
                              </HStack>
                            )}
                            
                            {/* Status Messages */}
                            {!canPlaceBet && !hasPlacedBet && opportunity.startTime > 0 && (
                              <Text fontSize="sm" color="warning.500" mt={3} fontWeight="medium">
                                Betting window closed for this opportunity
                              </Text>
                            )}
                            
                            {canPlaceBet && !isCofhejsInitialized && (
                              <Text fontSize="sm" color="error.500" mt={3} fontWeight="medium">
                                Encryption setup required. Please refresh and try again.
                              </Text>
                            )}
                          </Box>
                          
                          {/* User's Bet Details */}
                          {hasPlacedBet && userBet && (
                            <Card variant="outline" bg="success.25" borderColor="success.300">
                              <CardBody p={4}>
                                <VStack align="stretch" gap={3}>
                                  <Text fontSize="sm" fontWeight="semibold" color="success.700">
                                    Your Bet Details:
                                  </Text>
                                  <HStack justify="space-between">
                                    <Text fontSize="sm" color="gray.600">Prediction:</Text>
                                    <Text fontSize="sm" fontFamily="mono" color="gray.800">
                                      {formatEncryptedValue(userBet.predictedOption)}
                                    </Text>
                                  </HStack>
                                  <HStack justify="space-between">
                                    <Text fontSize="sm" color="gray.600">Points Awarded:</Text>
                                    <Text fontSize="sm" fontFamily="mono" color="gray.800">
                                      {formatEncryptedValue(userBet.pointsAwarded)}
                                    </Text>
                                  </HStack>
                                </VStack>
                              </CardBody>
                            </Card>
                          )}
                          
                          {/* Results */}
                          {opportunity.resultsFinalized && (
                            <Card variant="outline" bg="brand.50" borderColor="brand.200">
                              <CardBody p={4}>
                                <HStack gap={3}>
                                  <Text fontWeight="semibold" color="brand.700">Final Result:</Text>
                                  <Text color="brand.800" fontWeight="bold">
                                    {opportunity.options[opportunity.result || 0]}
                                  </Text>
                                </HStack>
                              </CardBody>
                            </Card>
                          )}
                        </VStack>
                      </CardBody>
                    </Card>
                  );
                })}
              </VStack>
            )}
          </CardBody>
        </Card>
      )}
      
      {/* Withdraw Confirmation Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={({ open }) => setDialogOpen(open)}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>Confirm Withdrawal</Dialog.Title>
              <Button
                size="sm"
                variant="ghost"
                onClick={closeDialog}
                position="absolute"
                right="8px"
                top="8px"
              >
                <Icon as={FiX} />
              </Button>
            </Dialog.Header>
            <Dialog.Body>
              <VStack align="stretch" gap={4}>
                <HStack gap={3}>
                  <Icon as={FiAlertTriangle} color="warning.500" boxSize={6} />
                  <Text fontWeight="bold" color="gray.800">Are you sure you want to withdraw?</Text>
                </HStack>
                <Text color="gray.700">
                  You will be removed from this betting group and your entry fee will be refunded.
                  All your bets will be deleted.
                </Text>
                <Text fontWeight="bold" color="error.600">
                  This action cannot be undone once the tournament starts.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button 
                variant="error" 
                onClick={withdrawFromBettingGroup}
                loading={isWithdrawing}
                loadingText="Withdrawing"
                ml={3}
              >
                Confirm Withdrawal
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    </VStack>
  );
};

export default BettingGroupScreen; 