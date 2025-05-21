import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
  Drawer
} from '@chakra-ui/react';
import { FiPlus, FiArrowLeft, FiX, FiRefreshCw, FiClock, FiCalendar, FiTerminal } from 'react-icons/fi';
import { getTournamentByAddress, getTournamentGroups } from '../services/api';
import { ethers } from 'ethers';
import type { Tournament, Group } from '../types';
import CreateGroup from './CreateGroup';
import { toaster } from './ui/toaster';

// Tournament ABI
const TOURNAMENT_ABI = [
  "function getBettingOpportunities() view returns (tuple(uint16 id, string description, uint256 startTime, string[] options, uint256 endTime, bool resultsFinalized, uint16 result)[])",
  "function setResults(uint16 _betId, uint16 _result, uint256 _endTime) external",
  "function updateBettingOpportunityStartTime(uint16 _betId, uint256 _startTime) external"
];

// Current ETH price in USD (would be better to fetch from an API)
const ETH_PRICE_USD = 3500;

const TournamentScreen = () => {
  const navigate = useNavigate();
  const { address } = useParams<{ address: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [bettingOpportunities, setBettingOpportunities] = useState<any[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(true);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{
    betId: number,
    resultIndex: number,
    description: string,
    option: string
  } | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  
  // Use ref to stabilize provider reference
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  
  // Try to access parent component context if available
  const drawerContext = (window as any).__drawerContext;
  
  // Only update provider ref if it changes significantly
  if (drawerContext?.provider && drawerContext.provider !== providerRef.current) {
    providerRef.current = drawerContext.provider;
  }
  
  // Fetch tournament data
  useEffect(() => {
    fetchTournament();
  }, [address]);
  
  // Fetch betting opportunities just once on initial load
  useEffect(() => {
    if (tournament && providerRef.current) {
      fetchBettingOpportunities();
    }
  }, [tournament?.address]);
  
  // Fetch groups with polling
  useEffect(() => {
    if (!address) return;
    
    // Initial fetch
    fetchGroups();
    
    // Set up polling interval (every 5 seconds)
    const intervalId = setInterval(() => {
      fetchGroups();
    }, 5000);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [address]);
  
  const fetchTournament = useCallback(async () => {
    if (!address) return;
    
    try {
      const data = await getTournamentByAddress(address);
      setTournament(data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setLoading(false);
    }
  }, [address]);
  
  // Improved fetchBettingOpportunities with better debugging
  const fetchBettingOpportunities = useCallback(async () => {
    if (!providerRef.current || !tournament) {
      console.log("Cannot fetch: provider or tournament not available");
      return;
    }
    
    try {
      console.log("Starting to fetch betting opportunities for tournament:", tournament.address);
      setOpportunitiesLoading(true);
      
      // Create contract instance directly
      const contract = new ethers.Contract(
        tournament.address, 
        TOURNAMENT_ABI, 
        providerRef.current
      );
      
      console.log("Contract instance created, calling getBettingOpportunities()");
      
      // Call the getBettingOpportunities method with explicit error handling
      let opportunities;
      try {
        opportunities = await contract.getBettingOpportunities();
        console.log("Raw opportunities data:", opportunities);
      } catch (callError: any) {
        console.error("Contract call error:", callError);
        showErrorToast(
          'Contract Call Failed', 
          `Failed to call getBettingOpportunities: ${callError.message || 'Unknown error'}`
        );
        setOpportunitiesLoading(false);
        return;
      }
      
      // Verify we received valid data
      if (!opportunities || !Array.isArray(opportunities)) {
        console.error("Invalid opportunities data:", opportunities);
        showErrorToast(
          'Invalid Data', 
          'Received invalid data from contract'
        );
        setBettingOpportunities([]);
        setOpportunitiesLoading(false);
        return;
      }
      
      // Format opportunities for display with more careful handling
      const formattedOpportunities = opportunities.map((opp: any, index: number) => {
        console.log(`Processing opportunity ${index}:`, opp);
        return {
          id: Number(opp.id || 0),
          description: opp.description || `Bet #${index + 1}`,
          startTime: Number(opp.startTime || 0),
          options: Array.isArray(opp.options) ? opp.options : [],
          endTime: Number(opp.endTime || 0),
          resultsFinalized: Boolean(opp.resultsFinalized),
          result: opp.resultsFinalized ? Number(opp.result || 0) : null
        };
      });
      
      console.log("Formatted opportunities:", formattedOpportunities);
      setBettingOpportunities(formattedOpportunities);
      setOpportunitiesLoading(false);
    } catch (error: any) {
      console.error('Error fetching betting opportunities:', error);
      showErrorToast(
        'Failed to Load Bets', 
        error.message || 'An unexpected error occurred'
      );
      setBettingOpportunities([]);
      setOpportunitiesLoading(false);
    }
  }, [tournament]);
  
  // Modified version of toaster error calls with proper text wrapping
  const showErrorToast = (title: string, message: string) => {
    toaster.error({
      title,
      description: message
    });
  };
  
  // Modified setResults to use our custom dialog
  const setResults = async (betId: number, resultIndex: number) => {
    if (!providerRef.current || !tournament) return;
    
    // Find the opportunity
    const opportunity = bettingOpportunities.find(o => o.id === betId);
    if (!opportunity) return;
    
    // Open dialog with data
    setDialogData({
      betId,
      resultIndex,
      description: opportunity.description,
      option: opportunity.options[resultIndex]
    });
    setIsDialogOpen(true);
  };
  
  // Execute result setting after confirmation
  const confirmSetResult = async () => {
    if (!dialogData || !providerRef.current || !tournament) return;
    
    try {
      // Create contract instance with signer
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        tournament.address, 
        TOURNAMENT_ABI, 
        signer
      );
      
      // Current timestamp in seconds
      const currentTime = Math.floor(Date.now() / 1000);
      
      // Call setResults with the betId, resultIndex, and current time
      const tx = await contract.setResults(
        dialogData.betId, 
        dialogData.resultIndex, 
        currentTime
      );
      
      // Close dialog
      setIsDialogOpen(false);
      setDialogData(null);
      
      // Show transaction sent toast
      toaster.create({
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Calculate gas used and cost
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice || await providerRef.current.getFeeData().then(data => data.gasPrice);
      
      if (gasUsed && gasPrice) {
        // Calculate gas cost in ETH
        const gasCostWei = gasUsed * gasPrice;
        const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));
        const gasCostUsd = gasCostEth * ETH_PRICE_USD;
        
        // Show success toast with gas fees
        showSuccessWithGas(
          'Result Set Successfully',
          gasUsed,
          gasCostEth,
          gasCostUsd
        );
        
        // Broadcast transaction info to event log
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('blockchain_tx', {
            detail: {
              type: 'setResults',
              txHash: receipt.hash,
              gasUsed: gasUsed.toString(),
              gasCostEth: gasCostEth.toFixed(6),
              gasCostUsd: gasCostUsd.toFixed(2),
              description: `Set result for "${dialogData.description}" to "${dialogData.option}"`
            }
          }));
        }
      } else {
        toaster.success({
          title: 'Result Set Successfully',
          description: 'Refreshing opportunities...'
        });
      }
      
      // Refresh opportunities
      fetchBettingOpportunities();
      
    } catch (error: any) {
      console.error('Error setting results:', error);
      
      showErrorToast(
        'Failed to Set Results',
        error.message || 'Check console for details'
      );
      
      // Close dialog
      setIsDialogOpen(false);
      setDialogData(null);
    }
  };
  
  // Update start time function with gas tracking
  const updateStartTime = async (betId: number) => {
    if (!providerRef.current || !tournament) return;
    
    try {
      // Prompt user for new start time
      const dateInput = prompt("Enter new start time (YYYY-MM-DD HH:MM):");
      if (!dateInput) return;
      
      // Parse the date input
      const newDate = new Date(dateInput);
      if (isNaN(newDate.getTime())) {
        showErrorToast(
          'Invalid Date Format',
          'Please use YYYY-MM-DD HH:MM'
        );
        return;
      }
      
      // Convert to Unix timestamp (seconds)
      const newStartTime = Math.floor(newDate.getTime() / 1000);
      
      // Ensure the time is in the future
      const now = Math.floor(Date.now() / 1000);
      if (newStartTime <= now) {
        showErrorToast(
          'Invalid Start Time',
          'Start time must be in the future'
        );
        return;
      }
      
      // Create contract instance with signer
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        tournament.address, 
        TOURNAMENT_ABI, 
        signer
      );
      
      // Confirm with user
      const opportunity = bettingOpportunities.find(o => o.id === betId);
      if (!confirm(`Update start time for "${opportunity?.description}" to ${new Date(newStartTime * 1000).toLocaleString()}?`)) {
        return;
      }
      
      // Call updateBettingOpportunityStartTime with the betId and new start time
      const tx = await contract.updateBettingOpportunityStartTime(betId, newStartTime);
      
      // Show transaction sent toast
      const loadingToastId = toaster.create({
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Dismiss loading toast
      toaster.dismiss(loadingToastId);
      
      // Calculate gas used and cost
      const gasUsed = receipt.gasUsed;
      const gasPrice = receipt.gasPrice || await providerRef.current.getFeeData().then(data => data.gasPrice);
      
      if (gasUsed && gasPrice) {
        // Calculate gas cost in ETH
        const gasCostWei = gasUsed * gasPrice;
        const gasCostEth = parseFloat(ethers.formatEther(gasCostWei));
        const gasCostUsd = gasCostEth * ETH_PRICE_USD;
        
        // Show success toast with gas fees
        showSuccessWithGas(
          'Start Time Updated Successfully',
          gasUsed,
          gasCostEth,
          gasCostUsd
        );
        
        // Broadcast transaction info to event log
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('blockchain_tx', {
            detail: {
              type: 'updateStartTime',
              txHash: receipt.hash,
              gasUsed: gasUsed.toString(),
              gasCostEth: gasCostEth.toFixed(6),
              gasCostUsd: gasCostUsd.toFixed(2),
              description: `Updated start time for "${opportunity?.description}" to ${new Date(newStartTime * 1000).toLocaleString()}`
            }
          }));
        }
      } else {
        toaster.success({
          title: 'Start Time Updated Successfully',
          description: 'Refreshing opportunities...'
        });
      }
      
      // Refresh opportunities
      fetchBettingOpportunities();
      
    } catch (error: any) {
      console.error('Error updating start time:', error);
      
      showErrorToast(
        'Failed to Update Start Time',
        error.message || 'Unknown error'
      );
    }
  };
  
  // For success toast with gas information, also ensure text wrapping
  const showSuccessWithGas = (title: string, gasUsed: ethers.BigNumberish, gasCostEth: number, gasCostUsd: number) => {
    toaster.success({
      title,
      description: `Gas used: ${gasUsed.toString()} units | Cost: ${gasCostEth.toFixed(6)} ETH ($${gasCostUsd.toFixed(2)})`
    });
  };
  
  // Add canUpdateStartTime function to check if start time can be updated
  const canUpdateStartTime = (opportunity: any): boolean => {
    if (!opportunity) return false;
    
    const now = Math.floor(Date.now() / 1000);
    
    // Can update if start time is 0 (not set) or 
    // if it's set but more than 60 seconds in the future
    return opportunity.startTime === 0 || 
           (opportunity.startTime > 0 && now < opportunity.startTime - 60);
  };
  
  const fetchGroups = async () => {
    if (!address) return;
    
    try {
      const data = await getTournamentGroups(address);
      setGroups(data);
      
      // Only set loading state on first load
      if (groupsLoading) {
        setGroupsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      // Only set loading state on first load
      if (groupsLoading) {
        setGroupsLoading(false);
      }
    }
  };
  
  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    try {
      if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
        return 'Invalid date';
      }
      
      const date = new Date(timestamp * 1000);
      
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Check if tournament is active and not ended
  const canCreateGroup = () => {
    if (!tournament) return false;
    
    const now = Math.floor(Date.now() / 1000);
    return now >= tournament.startTime && now <= tournament.endTime;
  };
  
  // Get tournament status
  const getTournamentStatus = () => {
    if (!tournament) return null;
    
    const now = Math.floor(Date.now() / 1000);
    
    if (now < tournament.startTime) {
      return <Box bg="blue.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Upcoming</Box>;
    } else if (now <= tournament.endTime) {
      return <Box bg="green.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Active</Box>;
    } else {
      return <Box bg="red.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Ended</Box>;
    }
  };
  
  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);
  
  // Handle successful group creation
  const handleGroupCreated = () => {
    // Close the drawer
    closeDrawer();
    // Fetch groups immediately to show the new group
    fetchGroups();
  };
  
  // Return to tournaments list
  const goBackToList = () => {
    navigate('/');
  };
  
  // Memoize the betting opportunities section to prevent unnecessary re-renders
  const BettingOpportunitiesSection = useMemo(() => {
    return (
      <Box>
        <HStack justify="space-between" mb={4}>
          <Heading size="md">Bets ({tournament?.bettingOpportunitiesCount || 0})</Heading>
          <Button 
            size="sm" 
            onClick={fetchBettingOpportunities}
            loading={opportunitiesLoading}
            variant="outline"
          >
            <Icon as={FiRefreshCw} mr={2} />
            Refresh
          </Button>
        </HStack>

        {opportunitiesLoading ? (
          <Flex justify="center" py={4}>
            <Spinner size="md" color="teal.500" />
          </Flex>
        ) : bettingOpportunities.length === 0 ? (
          <Text color="gray.500">No betting opportunities available</Text>
        ) : (
          <VStack align="stretch" gap={3}>
            {bettingOpportunities.map((opportunity) => (
              <Box key={opportunity.id} p={3} borderWidth="1px" borderRadius="md">
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="bold">{opportunity.description}</Text>
                  <HStack>
                    {opportunity.startTime > 0 ? (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => canUpdateStartTime(opportunity) && updateStartTime(opportunity.id)}
                        disabled={!canUpdateStartTime(opportunity)}
                        title={canUpdateStartTime(opportunity) ? "Click to update start time" : "Cannot update start time"}
                        colorScheme={canUpdateStartTime(opportunity) ? "blue" : "gray"}
                      >
                        {formatDate(opportunity.startTime)}
                        <Icon as={FiCalendar} ml={2} />
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => updateStartTime(opportunity.id)}
                        colorScheme="blue"
                      >
                        <Icon as={FiClock} mr={2} />
                        Set Start Time
                      </Button>
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
                
                <Grid templateColumns="repeat(8, 1fr)" gap={2} mt={2}>
                  {opportunity.options.map((option: string, idx: number) => (
                    <Box 
                      key={idx} 
                      p={2} 
                      bg={opportunity.resultsFinalized && opportunity.result === idx ? "green.100" : "gray.100"} 
                      borderRadius="md"
                      borderWidth="1px"
                      borderColor={opportunity.resultsFinalized && opportunity.result === idx ? "green.500" : "transparent"}
                      cursor={opportunity.resultsFinalized ? "default" : "pointer"}
                      onClick={() => !opportunity.resultsFinalized && setResults(opportunity.id, idx)}
                      _hover={!opportunity.resultsFinalized ? { bg: "blue.50" } : {}}
                    >
                      <Text fontSize="sm" textAlign="center">
                        {option}
                        {opportunity.resultsFinalized && opportunity.result === idx && (
                          <Text as="span" color="green.500" ml={1}>
                            ✓
                          </Text>
                        )}
                      </Text>
                    </Box>
                  ))}
                </Grid>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    );
  }, [bettingOpportunities, opportunitiesLoading, tournament?.bettingOpportunitiesCount, formatDate, fetchBettingOpportunities, setResults, updateStartTime, canUpdateStartTime]);
  
  if (loading) {
    return (
      <Flex justify="center" align="center" minH="400px">
        <VStack>
          <Spinner size="xl" color="teal.500" />
          <Text color="gray.500">Loading tournament...</Text>
        </VStack>
      </Flex>
    );
  }
  
  if (!tournament) {
    return (
      <Box p={8}>
        <Heading size="md" textAlign="center">Tournament not found</Heading>
      </Box>
    );
  }
  
  return (
    <Box p={6} color={"gray.700"}>
      {/* Tournament header */}
      <VStack align="stretch" gap={6} mb={8}>
        <HStack justify="space-between" wrap="wrap">
          <HStack>
            <Button 
              aria-label="Back to Tournaments"
              variant="ghost" 
              onClick={goBackToList} 
              size="md"
              borderRadius="full"
              p={0}
            >
              <Icon as={FiArrowLeft} boxSize={5} />
            </Button>
            <Heading size="lg">{tournament.description}</Heading>
          </HStack>
          {getTournamentStatus()}
        </HStack>
        
        <Box>
          <Text fontSize="sm" color="gray.500" mb={2}>Tournament Address:</Text>
          <Text fontSize="sm" fontFamily="monospace" p={2} bg="gray.100" borderRadius="md">
            {tournament.address}
          </Text>
        </Box>
        
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          <Box>
            <Text fontWeight="bold">Start Time:</Text>
            <Text>{formatDate(tournament.startTime)}</Text>
          </Box>
          <Box>
            <Text fontWeight="bold">End Time:</Text>
            <Text>{formatDate(tournament.endTime)}</Text>
          </Box>
        </Grid>
        
        {/* Betting Opportunities Section */}
        {BettingOpportunitiesSection}
        
        <Box borderTop="1px" borderColor="gray.200" pt={4} />
      </VStack>
      
      {/* Groups section */}
      <Box mt={6}>
        <Flex justify="space-between" align="center" mb={4}>
          <Heading size="md">Betting Groups</Heading>
          <Button
            colorScheme="teal"
            onClick={openDrawer}
            disabled={!canCreateGroup() || !providerRef.current}
            borderWidth="1px"
            borderColor="gray.500"
            title={
              !providerRef.current 
                ? "Please connect your wallet first" 
                : !canCreateGroup() 
                  ? "Groups can only be created for active tournaments" 
                  : "Create new betting group"
            }
          >
            <Icon as={FiPlus} mr={2} />
            Create Betting Group
          </Button>
        </Flex>
        
        {groupsLoading ? (
          <Flex justify="center" align="center" h="200px">
            <Spinner size="lg" color="teal.500" />
          </Flex>
        ) : groups.length === 0 ? (
          <Text textAlign="center" p={6} color="gray.500">
            No betting groups found for this tournament
          </Text>
        ) : (
          <Grid 
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)"
            }} 
            gap={4}
          >
            {groups.map(group => (
              <GridItem key={group.address}>
                <Box borderWidth="1px" borderRadius="md" p={4} boxShadow="sm" height="100%">
                  <VStack align="stretch" gap={2}>
                    <Heading size="sm">{group.description}</Heading>
                    
                    <Text fontSize="xs" color="gray.500" fontFamily="monospace" maxW="100%" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                      {group.address}
                    </Text>
                    
                    <Box mt={2}>
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="bold">Registration Ends: </Text>
                        {formatDate(group.registrationEndTime)}
                      </Text>
                      
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="bold">Prize Distribution: </Text>
                        {group.prizeDistribution.join(', ')}%
                      </Text>
                      
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="bold">Closing Window: </Text>
                        {group.generalClosingWindow} seconds
                      </Text>
                    </Box>
                  </VStack>
                </Box>
              </GridItem>
            ))}
          </Grid>
        )}
      </Box>
      
      {/* Create Group Drawer */}
      <Drawer.Root
        open={isDrawerOpen}
        onOpenChange={({ open }) => setIsDrawerOpen(open)}
        modal={true}
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content width="50vw" maxWidth="50vw" bg="gray.900">
            <Drawer.Header borderBottomColor="whiteAlpha.300">
              <Drawer.Title color="white">Create Betting Group</Drawer.Title>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={closeDrawer} 
                position="absolute" 
                right="8px" 
                top="8px"
                color="white"
              >
                <Icon>
                  <FiX />
                </Icon>
              </Button>
            </Drawer.Header>
            <Drawer.Body color="white">
              {tournament && (
                <CreateGroup 
                  provider={providerRef.current} 
                  tournament={tournament}
                  onSuccess={handleGroupCreated} 
                />
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
      
      {/* Custom Confirmation Dialog */}
      {isDialogOpen && dialogData && (
        <Box
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="blackAlpha.600"
          zIndex={1000}
          display="flex"
          alignItems="center"
          justifyContent="center"
          onClick={() => {
            setIsDialogOpen(false);
            setDialogData(null);
          }}
        >
          <Box
            bg="white"
            p={4}
            borderRadius="md"
            width="400px"
            boxShadow="lg"
            onClick={(e) => e.stopPropagation()}
          >
            <Heading size="md" mb={3}>Confirm Result</Heading>
            
            <Text mb={4}>
              Are you sure you want to set the result for "{dialogData.description}" to "{dialogData.option}"?
            </Text>
            
            <Flex justify="flex-end" gap={2}>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDialogOpen(false);
                  setDialogData(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={confirmSetResult}
              >
                Confirm
              </Button>
            </Flex>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default TournamentScreen; 