import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
  Input,
  Dialog,

  Badge,
  Wrap,
  WrapItem
} from '@chakra-ui/react';
import { FiArrowLeft, FiCheck, FiUser, FiLogOut, FiAlertTriangle, FiX } from 'react-icons/fi';
import { ethers } from 'ethers';
import { getGroupByAddress } from '../services/api';
import { BETTING_GROUP_ABI, TOURNAMENT_ABI } from '../config';
import { formatBlockchainDateToLocal, getCurrentBlockchainTime } from '../utils/time';
import { toaster } from './ui/toaster';
import type { Group } from '../types';
// We'll use dynamic imports instead of static imports for cofhejs
// import { cofhejs, Encryptable } from 'cofhejs/web';
// import { FheTypes } from 'cofhejs/common';

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
  
  // Reference to provider and signer
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const cofhejsRef = useRef<any>(null);
  
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
      // Dynamically import cofhejs
      const cofhejsModule = await import('cofhejs/web');
      const signer = await providerRef.current.getSigner();
      
      // Initialize cofhejs with ethers
      await cofhejsModule.cofhejs.initializeWithEthers({
        ethersProvider: providerRef.current,
        ethersSigner: signer,
        environment: "MOCK"
      });
      
      // Store reference
      cofhejsRef.current = cofhejsModule;
      
      setIsCofhejsInitialized(true);
      console.log("Cofhejs initialized successfully");
    } catch (error) {
      console.error("Error initializing Cofhejs:", error);
      toaster.error({
        title: 'Encryption Setup Failed',
        description: 'Failed to initialize encryption. Some features may not work.'
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
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      // Get user bets
      const [betIds, betsData] = await contract.getParticipantBets();
      
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
      }
    } catch (error) {
      console.error('Error fetching bets:', error);
    }
  }, [groupAddress, providerRef, isUserRegistered, tournamentAddress]);
  
  // Place a bet on a betting opportunity
  const placeBet = async (betId: number, optionIndex: number) => {
    if (!groupAddress || !providerRef.current || !isCofhejsInitialized || !isUserRegistered || !cofhejsRef.current) return;
    
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
      
      // Get cofhejs and Encryptable from ref
      const { cofhejs, Encryptable } = cofhejsRef.current;
      
      // Encrypt the option index using cofhejs
      console.log("Cofhejs instance:", cofhejs);
      const encryptedOption = await cofhejs.encrypt(logEncryptionState, [Encryptable.uint16(optionIndex)]);
      
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
    if (!group || !isActive) {
      return <Box bg="red.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Inactive</Box>;
    }
    
    const now = getCurrentBlockchainTime();
    
    if (now < group.registrationEndTime) {
      return <Box bg="green.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Registration Open</Box>;
    } else {
      return <Box bg="blue.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">In Progress</Box>;
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
        <VStack>
          <Spinner size="xl" color="teal.500" />
          <Text color="gray.500">Loading betting group...</Text>
        </VStack>
      </Flex>
    );
  }
  
  if (!group) {
    return (
      <Box p={8}>
        <Heading size="md" textAlign="center">Betting group not found</Heading>
      </Box>
    );
  }
  
  return (
    <Box p={6} color="gray.700">
      {/* Group header */}
      <VStack align="stretch" gap={6} mb={8}>
        <HStack justify="space-between" wrap="wrap">
          <HStack>
            <Button 
              aria-label="Back to Tournament"
              variant="ghost" 
              onClick={goBackToTournament} 
              size="md"
              borderRadius="full"
              p={0}
            >
              <Icon as={FiArrowLeft} boxSize={5} />
            </Button>
            <Heading size="lg">{group.description}</Heading>
          </HStack>
          {getGroupStatus()}
        </HStack>
        
        <Box>
          <Text fontSize="sm" color="gray.500" mb={2}>Group Address:</Text>
          <Text fontSize="sm" fontFamily="monospace" p={2} bg="gray.100" borderRadius="md">
            {group.address}
          </Text>
        </Box>
        
        <Box>
          <Text fontSize="sm" color="gray.500" mb={2}>Tournament Address:</Text>
          <Text fontSize="sm" fontFamily="monospace" p={2} bg="gray.100" borderRadius="md">
            {group.tournamentAddress}
          </Text>
        </Box>
        
        <HStack justify="space-between" wrap="wrap">
          <Box>
            <Text fontWeight="bold">Registration Ends:</Text>
            <Text>{formatDate(group.registrationEndTime)}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold">Prize Distribution:</Text>
            <Text>{group.prizeDistribution.map(value => (value / 10)).join(', ')}%</Text>
          </Box>
          <Box>
            <Text fontWeight="bold">Closing Window:</Text>
            <Text>{Math.round(group.generalClosingWindow / 60)} minutes</Text>
          </Box>
        </HStack>
        
        <Box borderTop="1px" borderColor="gray.200" pt={4} />
      </VStack>
      
      {/* Registration section */}
      {isActive && !isUserRegistered && (
        <Box p={6} bg="gray.50" borderRadius="md" mb={8}>
          <Heading size="md" mb={4}>Register for this Betting Group</Heading>
          
          <Box mb={4}>
            <Text as="label" fontWeight="medium" mb={2} display="block">
              Your Name
            </Text>
            <Input 
              placeholder="Enter your name" 
              value={userName} 
              onChange={(e) => setUserName(e.target.value)}
              disabled={isRegistering}
            />
          </Box>
          
          <HStack>
            {/* We'll show entry fee from contract data */}
            <Button
              colorScheme="teal"
              loading={isRegistering}
              onClick={registerForGroup}
              disabled={!userName.trim() || !providerRef.current}
            >
              <HStack>
                <Icon as={FiUser} />
                <Text>Register</Text>
              </HStack>
            </Button>
          </HStack>
        </Box>
      )}
      
      {isUserRegistered && (
        <Box p={6} bg="green.50" borderRadius="md" mb={8}>
          <HStack justify="space-between" wrap={{ base: "wrap", md: "nowrap" }}>
            <HStack>
              <Icon as={FiCheck} color="green.500" boxSize={6} />
              <Heading size="md">You are registered for this betting group</Heading>
            </HStack>
            
            {/* Withdraw button - Only show if tournament hasn't started yet and group is active */}
            {isActive && !tournamentStarted && (
              <Button
                colorScheme="red"
                // variant="outline"
                size="sm"
                onClick={openDialog}
                mt={{ base: 4, md: 0 }}
              >
                <HStack>
                  <Icon as={FiLogOut} />
                  <Text>Withdraw Registration</Text>
                </HStack>
              </Button>
            )}
          </HStack>
        </Box>
      )}
      
      {/* Participants section */}
      <Box mt={6}>
        <Heading size="md" mb={4}>Participants ({participantCount})</Heading>
        
        <Box p={4} bg="gray.50" borderRadius="md" textAlign="center">
          <Text>
            {participantCount} participants have registered for this betting group
          </Text>
        </Box>
      </Box>
      
      {/* All betting opportunities section - only shown if user is registered */}
      {isUserRegistered && (
        <Box mt={6}>
          <Heading size="md" mb={4}>Betting Opportunities</Heading>
          
          {bettingOpportunities.length === 0 ? (
            <Box p={4} bg="gray.50" borderRadius="md" textAlign="center">
              <Text color="gray.500">No betting opportunities available for this tournament</Text>
            </Box>
          ) : (
            <VStack align="stretch" gap={3}>
              {bettingOpportunities.map((opportunity) => {
                const hasPlacedBet = hasBetBeenPlaced(opportunity.id);
                // const canPlaceBet = !hasPlacedBet && isBettingWindowOpen(opportunity);
                const canPlaceBet = true;
                const userBet = bets.find(bet => bet.id === opportunity.id);
                
                return (
                  <Box 
                    key={opportunity.id} 
                    p={3} 
                    borderWidth="1px" 
                    borderRadius="md" 
                    bg={hasPlacedBet ? "teal.50" : "white"}
                    borderColor={hasPlacedBet ? "teal.200" : "gray.200"}
                  >
                    <HStack justify="space-between" mb={2}>
                      <HStack>
                        <Text fontWeight="bold">{opportunity.description}</Text>
                        {hasPlacedBet && (
                          <Badge colorScheme="teal" variant="subtle">Bet Placed</Badge>
                        )}
                      </HStack>
                      <HStack>
                        {opportunity.startTime > 0 ? (
                          <Text fontSize="sm" color="gray.600">
                            Starts: {formatDate(opportunity.startTime)}
                          </Text>
                        ) : (
                          <Text fontSize="sm" color="gray.600">
                            Start time not set
                          </Text>
                        )}
                        {opportunity.resultsFinalized ? (
                          <Box bg="green.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Results In</Box>
                        ) : opportunity.startTime > 0 ? (
                          <Box bg="blue.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Active</Box>
                        ) : (
                          <Box bg="gray.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Not Started</Box>
                        )}
                      </HStack>
                    </HStack>
                    
                    {/* Show options as buttons if betting is available */}
                    <Box mt={2}>
                      <Text fontSize="sm" fontWeight="medium" mb={2}>Options:</Text>
                      {canPlaceBet ? (
                        // Render as clickable buttons for placing bets
                        <Wrap gap={2}>
                          {opportunity.options.map((option, index) => (
                            <WrapItem key={index}>
                              <Button
                                size="sm"
                                variant="outline"
                                colorScheme="teal"
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
                        // Render as non-clickable tags
                        <HStack flexWrap="wrap" gap={2}>
                          {opportunity.options.map((option, index) => (
                            <Box 
                              key={index} 
                              px={3} 
                              py={1} 
                              bg="gray.100" 
                              borderRadius="full"
                              fontSize="sm"
                            >
                              {option}
                            </Box>
                          ))}
                        </HStack>
                      )}
                      
                      {/* Show message if betting window closed */}
                      {!canPlaceBet && !hasPlacedBet && opportunity.startTime > 0 && (
                        <Text fontSize="sm" color="orange.500" mt={2}>
                          Betting window closed for this opportunity
                        </Text>
                      )}
                      
                      {/* Show message if cofhejs not initialized */}
                      {canPlaceBet && !isCofhejsInitialized && (
                        <Text fontSize="sm" color="red.500" mt={2}>
                          Encryption setup required. Please refresh and try again.
                        </Text>
                      )}
                    </Box>
                    
                    {/* Show user's bet details if they've placed a bet on this opportunity */}
                    {hasPlacedBet && userBet && (
                      <Box mt={3} p={3} bg="teal.50" borderRadius="md">
                        <VStack align="stretch" gap={1}>
                          <Text fontSize="sm" fontWeight="medium">Your Bet:</Text>
                          <HStack justify="space-between">
                            <Text fontSize="sm">Prediction:</Text>
                            <Text fontSize="sm" fontFamily="monospace">
                              {formatEncryptedValue(userBet.predictedOption)}
                            </Text>
                          </HStack>
                          <HStack justify="space-between">
                            <Text fontSize="sm">Points Awarded:</Text>
                            <Text fontSize="sm" fontFamily="monospace">
                              {formatEncryptedValue(userBet.pointsAwarded)}
                            </Text>
                          </HStack>
                        </VStack>
                      </Box>
                    )}
                    
                    {opportunity.resultsFinalized && (
                      <HStack bg="blue.50" p={2} borderRadius="md" mt={2}>
                        <Text fontWeight="bold">Result:</Text>
                        <Text>{opportunity.options[opportunity.result || 0]}</Text>
                      </HStack>
                    )}
                  </Box>
                );
              })}
            </VStack>
          )}
        </Box>
      )}
      
      {/* Prize Pool section */}
      <Box mt={6}>
        <Heading size="md" mb={4}>Prize Pool</Heading>
        <Box p={4} bg="teal.50" borderRadius="md" textAlign="center">
          <Heading size="lg" color="teal.600">{prizePool} ETH</Heading>
        </Box>
      </Box>

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
                <Box>
                  <HStack>
                    <Icon as={FiAlertTriangle} color="orange.500" boxSize={6} />
                    <Text fontWeight="bold">Are you sure you want to withdraw?</Text>
                  </HStack>
                </Box>
                <Text>
                  You will be removed from this betting group and your entry fee will be refunded.
                  All your bets will be deleted.
                </Text>
                <Text fontWeight="bold">
                  This action cannot be undone once the tournament starts.
                </Text>
              </VStack>
            </Dialog.Body>
            <Dialog.Footer>
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button 
                colorScheme="red" 
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
    </Box>
  );
};

export default BettingGroupScreen; 