import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Button as ChakraButton,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Icon,
  Spinner,
  Text,
  VStack,
  Drawer,
  Input,
  Dialog
} from '@chakra-ui/react';
import { FiPlus, FiArrowLeft, FiX, FiRefreshCw, FiClock, FiCalendar, FiCheck } from 'react-icons/fi';
import { getTournamentByAddress, getTournamentGroups } from '../services/api';
import { ethers } from 'ethers';
import type { Tournament, Group } from '../types';
import CreateGroup from './CreateGroup';
import { toaster } from './ui/toaster';
import { Button } from './ui/button';
import { Card, CardBody, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { TOURNAMENT_ABI } from '../config';
import { 
  formatBlockchainDateToLocal, 
  convertLocalDateToBlockchainTime, 
  getCurrentBlockchainTime,
  isTimestampInFuture,
  formatDateForLocalInput
} from '../utils/time';
import { CopyAddress } from './ui/copy-address';
import { BETTING_GROUP_ABI } from '../config';

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
  const [ethPriceUsd, setEthPriceUsd] = useState(3500); // Fallback ETH price for local gas calculations (detailed gas info available in EventLog)
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogData, setDialogData] = useState<{
    betId: number,
    resultIndex: number,
    description: string,
    option: string
  } | null>(null);
  
  // Use ref to stabilize provider reference
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  
  // Try to access parent component context if available
  const drawerContext = (window as any).__drawerContext;
  
  // Only update provider ref if it changes significantly
  if (drawerContext?.provider && drawerContext.provider !== providerRef.current) {
    providerRef.current = drawerContext.provider;
  }
  
  // Date picker state
  const [selectedBetId, setSelectedBetId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Improved fetchBettingOpportunities with better debugging
  const fetchBettingOpportunities = useCallback(async (tournamentData?: Tournament) => {
    // Use provided tournament data or fallback to state
    const targetTournament = tournamentData || tournament;
    
    if (!providerRef.current || !targetTournament) {
      console.log("Cannot fetch: provider or tournament not available");
      return;
    }
    
    try {
      console.log("Starting to fetch betting opportunities for tournament:", targetTournament.address);
      setOpportunitiesLoading(true);
      
      // Create contract instance directly
      const contract = new ethers.Contract(
        targetTournament.address, 
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
  }, [tournament, providerRef]);
  
  // Fetch tournament data
  const fetchTournament = useCallback(async () => {
    console.log("Fetching tournament for address:", address);
    if (!address) return;
    
    try {
      const data = await getTournamentByAddress(address);
      console.log("Tournament data:", data);
      setTournament(data);
      setLoading(false);
      
      // Always try to fetch betting opportunities immediately after loading tournament 
      // This helps ensure data is available on page refresh
      if (data && providerRef.current) {
        console.log("Fetching betting opportunities after tournament loaded");
        
        try {
          console.log("Starting to fetch betting opportunities for tournament:", data.address);
          setOpportunitiesLoading(true);
          
          // Create contract instance directly
          const contract = new ethers.Contract(
            data.address, 
            TOURNAMENT_ABI, 
            providerRef.current
          );
          
          console.log("Contract instance created, calling getBettingOpportunities()");
          
          // Call the getBettingOpportunities method
          const opportunities = await contract.getBettingOpportunities();
          console.log("Raw opportunities data:", opportunities);
          
          if (!opportunities || !Array.isArray(opportunities)) {
            console.error("Invalid opportunities data:", opportunities);
            setBettingOpportunities([]);
            setOpportunitiesLoading(false);
            return;
          }
          
          // Format opportunities for display
          const formattedOpportunities = opportunities.map((opp: any, index: number) => ({
            id: Number(opp.id || 0),
            description: opp.description || `Bet #${index + 1}`,
            startTime: Number(opp.startTime || 0),
            options: Array.isArray(opp.options) ? opp.options : [],
            endTime: Number(opp.endTime || 0),
            resultsFinalized: Boolean(opp.resultsFinalized),
            result: opp.resultsFinalized ? Number(opp.result || 0) : null
          }));
          
          console.log("Formatted opportunities:", formattedOpportunities);
          setBettingOpportunities(formattedOpportunities);
          setOpportunitiesLoading(false);
        } catch (error: any) {
          console.error('Error fetching betting opportunities:', error);
          setBettingOpportunities([]);
          setOpportunitiesLoading(false);
        }
      }
    } catch (error) {
      console.error('Error fetching tournament:', error);
      setLoading(false);
    }
  }, [address, providerRef]);
  
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
  
  // Fetch tournament and betting opportunities data when address changes
  useEffect(() => {
    console.log("Address changed, fetching tournament:", address);
    fetchTournament();
  }, [address, fetchTournament]);
  
  // Modified version of toaster error calls with proper text wrapping
  const showErrorToast = (title: string, message: string) => {
    toaster.error({
      title,
      description: message
    });
  };
  
  // Modified setResults to use Dialog for confirmation
  const setResults = async (betId: number, resultIndex: number) => {
    if (!providerRef.current || !tournament) return;
    
    // Find the opportunity
    const opportunity = bettingOpportunities.find(o => o.id === betId);
    if (!opportunity) return;
    
    // Store the data and set editing state
    setDialogData({
      betId,
      resultIndex,
      description: opportunity.description,
      option: opportunity.options[resultIndex]
    });
    setIsDialogOpen(true);
  };
  
  // Execute result setting
  const confirmSetResult = async () => {
    if (!dialogData || !providerRef.current || !tournament) return;
    
    // Declare loadingToastId outside try/catch so it's accessible in both blocks
    let loadingToastId: string | undefined;
    
    try {
      // Create contract instance with signer
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        tournament.address, 
        TOURNAMENT_ABI, 
        signer
      );
      
      // Current timestamp in seconds (UTC for blockchain)
      const currentUtcTime = getCurrentBlockchainTime();
      
      // Call setResults with the betId, resultIndex, and current UTC time
      const tx = await contract.setResults(
        dialogData.betId, 
        dialogData.resultIndex, 
        currentUtcTime
      );
      
      // Close dialog
      setIsDialogOpen(false);
      setDialogData(null);
      
      // Show transaction sent toast and store the ID
      loadingToastId = toaster.create({
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
        const gasCostUsd = gasCostEth * ethPriceUsd;
        
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
      
      // Automatically process results for all betting groups
      await processResultsForAllGroups(dialogData.betId);
      
    } catch (error: any) {
      console.error('Error setting results:', error);
      
      // Dismiss loading toast if it exists
      if (loadingToastId) {
        toaster.dismiss(loadingToastId);
      }
      
      showErrorToast(
        'Failed to Set Results',
        error.message || 'Check console for details'
      );
      
      // Close dialog
      setIsDialogOpen(false);
      setDialogData(null);
    }
  };
  
  // Update start time function just prepares data
  const handleStartTimeClick = (opportunity: any) => {
    let defaultDateString;
    
    if (opportunity.startTime > 0) {
      // If updating an existing time, convert from blockchain timestamp to local date
      // Blockchain timestamps are in UTC seconds
      const existingDate = new Date(opportunity.startTime * 1000);
      
      // Add debugging to see what's happening with the timestamp
      console.log(`
        Opportunity start time (UTC): ${opportunity.startTime}
        As Date object: ${existingDate.toString()}
        Local time: ${existingDate.toLocaleString()}
        UTC time: ${existingDate.toUTCString()}
        Timezone offset: ${existingDate.getTimezoneOffset()} minutes
      `);
      
      defaultDateString = formatDateForLocalInput(existingDate);
      console.log(`Using existing start time in local format: ${defaultDateString}`);
    } else {
      // Set default date (1 hour from now) in local time
      const futureDate = new Date(Date.now() + 3600000); // One hour in the future
      defaultDateString = formatDateForLocalInput(futureDate);
      console.log(`Setting default date in local time: ${defaultDateString}`);
    }
    
    // Set for the date picker
    setSelectedBetId(opportunity.id);
    setSelectedDate(defaultDateString);
    
    // Show the date picker dialog
    setIsModalOpen(true);
  };
  
  // Handle date submission - Convert from local time to UTC for blockchain
  const handleSubmitDateTime = useCallback(async () => {
    if (!selectedBetId || !selectedDate || !providerRef.current || !tournament) {
      setIsModalOpen(false);
      return;
    }
    
    // Declare loadingToastId outside the primary try/catch
    let loadingToastId: string | undefined;
    
    try {
      // Parse the date input (which is in local time from the datetime-local input)
      const localDate = new Date(selectedDate);
      if (isNaN(localDate.getTime())) {
        showErrorToast(
          'Invalid Date Format',
          'Please select a valid date and time'
        );
        return;
      }
      
      // Convert local time to UTC timestamp (seconds) for blockchain
      const utcTimestamp = convertLocalDateToBlockchainTime(localDate);
      
      // Ensure the time is in the future
      if (!isTimestampInFuture(utcTimestamp)) {
        showErrorToast(
          'Invalid Start Time',
          'Start time must be in the future'
        );
        return;
      }
      
      // Get opportunity
      const opportunity = bettingOpportunities.find(o => o.id === selectedBetId);
      if (!opportunity) {
        setIsModalOpen(false);
        return;
      }
      
      // Close the modal
      setIsModalOpen(false);
      
      // Create contract instance with signer
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        tournament.address, 
        TOURNAMENT_ABI, 
        signer
      );
      
      // Call updateBettingOpportunityStartTime with the betId and new start time
      const tx = await contract.updateBettingOpportunityStartTime(selectedBetId, utcTimestamp);
      
      // Show transaction sent toast
      loadingToastId = toaster.create({
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
        const gasCostUsd = gasCostEth * ethPriceUsd;
        
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
              description: `Updated start time for "${opportunity.description}" to ${formatDate(utcTimestamp)}`
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
      
      // Dismiss loading toast if it exists
      if (loadingToastId) {
        toaster.dismiss(loadingToastId);
      }
      
      showErrorToast(
        'Failed to Update Start Time',
        error.message || 'Unknown error'
      );
    }
  }, [selectedBetId, selectedDate, providerRef, tournament, bettingOpportunities, fetchBettingOpportunities, ethPriceUsd]);
  
  // For success toast with gas information, also ensure text wrapping
  const showSuccessWithGas = (title: string, gasUsed: ethers.BigNumberish, gasCostEth: number, gasCostUsd: number) => {
    toaster.success({
      title,
      description: `Gas used: ${gasUsed.toString()} units | Cost: ${gasCostEth.toFixed(6)} ETH ($${gasCostUsd.toFixed(2)})`
    });
  };
  
  // Get tournament status
  const getTournamentStatus = () => {
    if (!tournament) return null;
    
    const now = getCurrentBlockchainTime();
    
    if (now < tournament.startTime) {
      return <Badge variant="upcoming">Upcoming</Badge>;
    } else if (now <= tournament.endTime) {
      return <Badge variant="active">Active</Badge>;
    } else {
      return <Badge variant="ended">Ended</Badge>;
    }
  };
  
  // Check if we can update start time (not too close to start)
  const canUpdateStartTime = (opportunity: any) => {
    if (opportunity.resultsFinalized) return false;
    if (opportunity.startTime === 0) return true; // Can always set if not set
    
    const now = getCurrentBlockchainTime();
    const oneMinuteBuffer = 60; // 1 minute buffer before start time
    
    return now < opportunity.startTime - oneMinuteBuffer;
  };

  // Check if results can be set for a betting opportunity
  const canSetResults = (opportunity: any) => {
    if (opportunity.resultsFinalized) return false;
    if (!tournament) return false; // Tournament must be available
    if (opportunity.startTime === 0) return false; // Betting opportunity start time must be set
    
    const now = getCurrentBlockchainTime();
    // Both tournament must have started AND betting opportunity start time must have passed
    return now >= tournament.startTime && now >= opportunity.startTime;
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
  
  // Format timestamp to readable date - using utility function
  const formatDate = (timestamp: number) => {
    return formatBlockchainDateToLocal(timestamp);
  };
  
  // Check if tournament has NOT started yet (per Factory.sol requirements)
  const canCreateGroup = () => {
    if (!tournament) return false;
    
    const now = getCurrentBlockchainTime();
    // Groups can only be created BEFORE tournament starts
    return now < tournament.startTime;
  };
  
  // Get a more descriptive reason why group creation is disabled
  const getCreateGroupButtonTooltip = () => {
    if (!providerRef.current) {
      return "Please connect your wallet first";
    }
    
    if (!tournament) {
      return "Tournament information not available";
    }
    
    const now = getCurrentBlockchainTime();
    if (now >= tournament.startTime) {
      return "Groups can only be created before tournament starts";
    }
    
    return "Create new betting group";
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
  
  // Use a better implementation for betting opportunities rendering
  const renderBettingOpportunities = () => {
    if (opportunitiesLoading) {
      return (
        <Flex justify="center" py={8}>
          <VStack gap={3}>
            <Spinner size="lg" color="brand.500" />
            <Text color="gray.500">Loading betting opportunities...</Text>
          </VStack>
        </Flex>
      );
    }
    
    if (bettingOpportunities.length === 0) {
      return (
        <Card variant="outline">
          <CardBody p={8}>
            <Text color="gray.500" textAlign="center">No betting opportunities available</Text>
          </CardBody>
        </Card>
      );
    }
    
    return (
      <VStack align="stretch" gap={4}>
        {bettingOpportunities.map((opportunity) => (
          <Card key={opportunity.id} variant="betting">
            <CardBody p={6}>
              <VStack align="stretch" gap={4}>
                <HStack justify="space-between" align="start">
                  <Heading size="md" color="gray.800" flex="1">
                    {opportunity.description}
                  </Heading>
                  <HStack gap={2}>
                    {opportunity.startTime > 0 ? (
                      <ChakraButton
                        size="sm"
                        color="gray.500"
                        variant={canUpdateStartTime(opportunity) ? "outline" : "ghost"}
                        onClick={() => canUpdateStartTime(opportunity) && handleStartTimeClick(opportunity)}
                        disabled={!canUpdateStartTime(opportunity)}
                      >
                        <Icon as={FiCalendar} mr={2} />
                        {formatDate(opportunity.startTime)}
                      </ChakraButton>
                    ) : (
                      <ChakraButton
                        size="sm"
                        variant="outline"
                        color="gray.500"
                        onClick={() => handleStartTimeClick(opportunity)}
                      >
                        <Icon as={FiClock} mr={2} />
                        Set Start Time
                      </ChakraButton>
                    )}
                    {opportunity.resultsFinalized ? (
                      <Badge variant="success">Results In</Badge>
                    ) : opportunity.startTime > 0 ? (
                      <Badge variant="active">Active</Badge>
                    ) : (
                      <Badge variant="ended">Not Started</Badge>
                    )}
                  </HStack>
                </HStack>
                
                <Grid templateColumns="repeat(auto-fit, minmax(120px, 1fr))" gap={3}>
                  {opportunity.options.map((option: string, idx: number) => (
                    <ChakraButton 
                      key={idx}
                      size="md"
                      variant={opportunity.resultsFinalized && opportunity.result === idx ? "solid" : "outline"}
                      colorScheme={opportunity.resultsFinalized && opportunity.result === idx ? "green" : "gray"}
                      onClick={() => canSetResults(opportunity) && setResults(opportunity.id, idx)}
                      disabled={opportunity.resultsFinalized || !canSetResults(opportunity)}
                      cursor={opportunity.resultsFinalized || !canSetResults(opportunity) ? "default" : "pointer"}
                      h="auto"
                      py={3}
                      px={4}
                      fontSize="sm"
                      position="relative"
                      whiteSpace="normal"
                      textAlign="center"
                      opacity={!canSetResults(opportunity) && !opportunity.resultsFinalized ? 0.6 : 1}
                      bg={opportunity.resultsFinalized && opportunity.result === idx ? "green.500" : undefined}
                      color={opportunity.resultsFinalized && opportunity.result === idx ? "white" : "gray.700"}
                      borderColor={opportunity.resultsFinalized && opportunity.result === idx ? "green.500" : undefined}
                      _hover={opportunity.resultsFinalized && opportunity.result === idx ? {
                        bg: "green.600"
                      } : undefined}
                    >
                      {option}
                      {opportunity.resultsFinalized && opportunity.result === idx && (
                        <Icon as={FiCheck} ml={2} color="white" />
                      )}
                    </ChakraButton>
                  ))}
                </Grid>
                
                {/* Show message if results cannot be set yet */}
                {!opportunity.resultsFinalized && !canSetResults(opportunity) && (
                  <Card variant="outline" bg="blue.50" borderColor="blue.200" mt={3}>
                    <CardBody p={4}>
                      <HStack gap={2} align="start">
                        <Text fontSize="lg">⏰</Text>
                        <VStack align="start" gap={1}>
                          <Text fontSize="sm" color="blue.700" fontWeight="semibold">
                            Results cannot be set yet
                          </Text>
                          <Text fontSize="xs" color="blue.600">
                            {opportunity.startTime === 0 
                              ? "Betting opportunity start time must be set first"
                              : `Wait until both tournament starts (${formatDate(tournament?.startTime || 0)}) and betting opportunity starts (${formatDate(opportunity.startTime)})`
                            }
                          </Text>
                        </VStack>
                      </HStack>
                    </CardBody>
                  </Card>
                )}
              </VStack>
            </CardBody>
          </Card>
        ))}
      </VStack>
    );
  };
  
  // Memoized handlers for the dialogs to prevent unnecessary re-renders
  const handleDatePickerOpenChange = useCallback(({ open }: { open: boolean }) => {
    setIsModalOpen(open);
    if (!open) {
      console.log("Date picker dialog closed");
    }
  }, []);
  
  const handleConfirmDialogOpenChange = useCallback(({ open }: { open: boolean }) => {
    setIsDialogOpen(open);
    if (!open) setDialogData(null);
  }, []);
  
  // DateTimePicker component
  const DateTimePicker = useCallback(() => {
    if (!isModalOpen) return null;
    
    const opportunity = bettingOpportunities.find(o => o.id === selectedBetId);
    if (!opportunity) return null;
    
    // No hook calls inside this component now
    return (
      <Dialog.Root open={isModalOpen} onOpenChange={handleDatePickerOpenChange}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger position="absolute" top={3} right={3}>
              <Icon as={FiX} />
            </Dialog.CloseTrigger>
            
            <Dialog.Header>
              <Heading size="md">Set Start Time</Heading>
            </Dialog.Header>
            
            <Dialog.Body>
              <Text fontWeight="bold" mb={4}>
                {opportunity.description}
              </Text>
              
              <Box mb={5}>
                <Text mb={2}>Select Date and Time (Local Time):</Text>
                <Input 
                  type="datetime-local" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  size="md"
                  width="100%"
                />
                <Text fontSize="sm" color="gray.500" mt={1}>
                  Using your local time zone: {new Intl.DateTimeFormat().resolvedOptions().timeZone}
                </Text>
              </Box>
            </Dialog.Body>
            
            <Dialog.Footer>
              <Button 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                colorScheme="blue" 
                onClick={handleSubmitDateTime}
                ml={3}
              >
                Set Time
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  }, [isModalOpen, selectedBetId, selectedDate, bettingOpportunities, handleSubmitDateTime, handleDatePickerOpenChange]);
  
  // Function to manually refresh betting opportunities
  const refreshBettingOpportunities = useCallback(async () => {
    if (!tournament || !providerRef.current) {
      console.log("Cannot refresh: provider or tournament not available");
      return;
    }
    
    try {
      console.log("Manually refreshing betting opportunities for tournament:", tournament.address);
      setOpportunitiesLoading(true);
      
      // Create contract instance directly
      const contract = new ethers.Contract(
        tournament.address, 
        TOURNAMENT_ABI, 
        providerRef.current
      );
      
      console.log("Contract instance created, calling getBettingOpportunities()");
      
      // Call the getBettingOpportunities method
      const opportunities = await contract.getBettingOpportunities();
      console.log("Raw opportunities data:", opportunities);
      
      if (!opportunities || !Array.isArray(opportunities)) {
        console.error("Invalid opportunities data:", opportunities);
        setBettingOpportunities([]);
        setOpportunitiesLoading(false);
        return;
      }
      
      // Format opportunities for display
      const formattedOpportunities = opportunities.map((opp: any, index: number) => ({
        id: Number(opp.id || 0),
        description: opp.description || `Bet #${index + 1}`,
        startTime: Number(opp.startTime || 0),
        options: Array.isArray(opp.options) ? opp.options : [],
        endTime: Number(opp.endTime || 0),
        resultsFinalized: Boolean(opp.resultsFinalized),
        result: opp.resultsFinalized ? Number(opp.result || 0) : null
      }));
      
      console.log("Formatted opportunities:", formattedOpportunities);
      setBettingOpportunities(formattedOpportunities);
      setOpportunitiesLoading(false);
    } catch (error: any) {
      console.error('Error refreshing betting opportunities:', error);
      setBettingOpportunities([]);
      setOpportunitiesLoading(false);
    }
  }, [tournament, providerRef]);
  
  // Process results for all betting groups related to this tournament
  const processResultsForAllGroups = async (betId: number) => {
    if (!providerRef.current || !tournament || groups.length === 0) {
      console.log("Skipping processResults: no provider, tournament, or groups");
      return;
    }

    console.log(`Processing results for bet ${betId} across ${groups.length} betting groups`);
    
    // Show processing toast
    const processingToastId = toaster.create({
      title: 'Processing Results',
      description: `Processing results for ${groups.length} betting groups...`,
      type: 'loading'
    });

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const signer = await providerRef.current.getSigner();
      
      // Process each betting group sequentially to avoid overwhelming the network
      for (const group of groups) {
        try {
          console.log(`Processing results for group: ${group.address} (${group.description})`);
          
          // Create contract instance for this betting group
          const groupContract = new ethers.Contract(
            group.address,
            BETTING_GROUP_ABI,
            signer
          );
          
          // Call processResults for this bet ID
          const tx = await groupContract.processResults(betId);
          
          // Update toast with current progress
          toaster.update(processingToastId, {
            title: 'Processing Results',
            description: `Processing group ${successCount + errorCount + 1}/${groups.length}: ${group.description}`,
            type: 'loading'
          });
          
          // Wait for transaction to be mined
          const receipt = await tx.wait();
          
          console.log(`Successfully processed results for group: ${group.address}, tx: ${receipt.hash}`);
          successCount++;
          
        } catch (error: any) {
          console.error(`Error processing results for group ${group.address}:`, error);
          errorCount++;
          
          // Extract meaningful error message
          let errorMessage = error.message || 'Unknown error';
          if (error.reason) {
            errorMessage = error.reason;
          } else if (error.data?.message) {
            errorMessage = error.data.message;
          }
          
          errors.push(`${group.description}: ${errorMessage}`);
        }
      }
      
      // Dismiss processing toast
      toaster.dismiss(processingToastId);
      
      // Show summary toast based on results
      if (errorCount === 0) {
        toaster.success({
          title: 'Results Processed Successfully',
          description: `Results processed for all ${successCount} betting groups`
        });
        
        // Broadcast success event
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('blockchain_tx', {
            detail: {
              type: 'processResults',
              description: `Processed results for bet ${betId} across ${successCount} betting groups`,
              successCount,
              errorCount: 0
            }
          }));
        }
      } else if (successCount > 0) {
        toaster.warning({
          title: 'Partial Success',
          description: `Processed ${successCount} groups successfully, ${errorCount} failed. Check console for details.`
        });
      } else {
        toaster.error({
          title: 'Processing Failed',
          description: `Failed to process results for all ${errorCount} groups. Check console for details.`
        });
      }
      
      // Log detailed errors if any
      if (errors.length > 0) {
        console.error('Detailed processing errors:', errors);
      }
      
    } catch (error: any) {
      console.error('Error in processResultsForAllGroups:', error);
      toaster.dismiss(processingToastId);
      toaster.error({
        title: 'Processing Failed',
        description: error.message || 'Failed to process results for betting groups'
      });
    }
  };
  
  if (loading) {
    return (
      <Flex justify="center" align="center" minH="400px">
        <VStack gap={4}>
          <Spinner size="xl" color="brand.500" />
          <Text color="gray.500">Loading tournament...</Text>
        </VStack>
      </Flex>
    );
  }
  
  if (!tournament) {
    return (
      <Card variant="outline" maxW="md" mx="auto" mt={8}>
        <CardBody p={8}>
          <VStack gap={4}>
            <Heading size="md" textAlign="center" color="gray.700">Tournament not found</Heading>
            <Button variant="outline" onClick={goBackToList}>
              <Icon as={FiArrowLeft} mr={2} />
              Back to Tournaments
            </Button>
          </VStack>
        </CardBody>
      </Card>
    );
  }
  
  return (
    <VStack align="stretch" gap={8} w="100%">
      {/* Tournament Header */}
      <Card variant="elevated">
        <CardBody p={6}>
          <VStack align="stretch" gap={6}>
            <HStack justify="space-between" wrap="wrap" gap={4}>
              <HStack gap={3}>
                <Button 
                  variant="ghost" 
                  onClick={goBackToList} 
                  size="md"
                  p={2}
                >
                  <Icon as={FiArrowLeft} boxSize={5} />
                </Button>
                <Heading size="xl" color="gray.800">{tournament.description}</Heading>
              </HStack>
              {getTournamentStatus()}
            </HStack>
            
            <CopyAddress 
              address={tournament.address}
              label="Tournament Address"
              fontSize="sm"
              variant="default"
            />
            
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>Start Time</Text>
                <Text fontSize="lg" color="gray.800">{formatDate(tournament.startTime)}</Text>
              </Box>
              <Box>
                <Text fontWeight="semibold" color="gray.600" mb={1}>End Time</Text>
                <Text fontSize="lg" color="gray.800">{formatDate(tournament.endTime)}</Text>
              </Box>
            </Grid>
          </VStack>
        </CardBody>
      </Card>

      {/* Betting Opportunities Section */}
      <Card variant="default">
        <CardHeader>
          <HStack justify="space-between" align="center">
            <Heading size="lg" color="gray.800">
              Bets ({tournament?.bettingOpportunitiesCount || 0})
            </Heading>
            <Button 
              size="sm" 
              variant="outline"
              onClick={refreshBettingOpportunities}
              disabled={opportunitiesLoading}
            >
              <Icon as={FiRefreshCw} mr={2} />
              Refresh
            </Button>
          </HStack>
        </CardHeader>
        <CardBody>
          {renderBettingOpportunities()}
        </CardBody>
      </Card>
      
      {/* Betting Groups Section */}
      <Card variant="default">
        <CardHeader>
          <HStack justify="space-between" align="center">
            <Heading size="lg" color="gray.800">Betting Groups</Heading>
            <Button
              variant="solid"
              onClick={openDrawer}
              disabled={!canCreateGroup() || !providerRef.current}
            >
              <Icon as={FiPlus} mr={2} />
              Create Betting Group
            </Button>
          </HStack>
        </CardHeader>
        <CardBody>
          {groupsLoading ? (
            <Flex justify="center" align="center" py={12}>
              <VStack gap={3}>
                <Spinner size="lg" color="brand.500" />
                <Text color="gray.500">Loading betting groups...</Text>
              </VStack>
            </Flex>
          ) : groups.length === 0 ? (
            <Box textAlign="center" py={12}>
              <Text color="gray.500" fontSize="lg">
                No betting groups found for this tournament
              </Text>
              <Text color="gray.400" fontSize="sm" mt={2}>
                Create the first betting group to get started
              </Text>
            </Box>
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
                  <Card 
                    variant="betting"
                    cursor="pointer"
                    onClick={() => navigate(`/tournaments/${tournament.address}/groups/${group.address}`)}
                    h="full"
                  >
                    <CardBody p={5}>
                      <VStack align="stretch" gap={4} h="full">
                        <Heading size="md" color="gray.800" lineClamp={2}>
                          {group.description}
                        </Heading>
                        
                        <CopyAddress 
                          address={group.address}
                          label="Contract Address"
                          fontSize="sm"
                          variant="default"
                        />
                        
                        <VStack align="stretch" gap={3} mt="auto">
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.500" fontWeight="medium">
                              Registration Ends
                            </Text>
                            <Text fontSize="sm" color="gray.800" fontWeight="semibold">
                              {formatDate(group.registrationEndTime)}
                            </Text>
                          </HStack>
                          
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.500" fontWeight="medium">
                              Prize Distribution
                            </Text>
                            <Text fontSize="sm" color="gray.800" fontWeight="semibold">
                              {group.prizeDistribution.map(value => (value / 10)).join(', ')}%
                            </Text>
                          </HStack>
                          
                          <HStack justify="space-between">
                            <Text fontSize="sm" color="gray.500" fontWeight="medium">
                              Closing Window
                            </Text>
                            <Text fontSize="sm" color="gray.800" fontWeight="semibold">
                              {Math.round(group.generalClosingWindow / 60)} minutes
                            </Text>
                          </HStack>
                        </VStack>
                      </VStack>
                    </CardBody>
                  </Card>
                </GridItem>
              ))}
            </Grid>
          )}
        </CardBody>
      </Card>
      
      {/* Create Group Drawer */}
      <Drawer.Root
        open={isDrawerOpen}
        onOpenChange={({ open }) => setIsDrawerOpen(open)}
        modal={true}
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content width="50vw" maxWidth="50vw" bg="white">
            <Drawer.Header borderBottom="1px solid" borderColor="gray.200" p={6}>
              <Drawer.Title fontSize="xl" fontWeight="bold" color="gray.800">
                Create Betting Group
              </Drawer.Title>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={closeDrawer} 
                position="absolute" 
                right={4} 
                top={4}
                p={2}
              >
                <Icon>
                  <FiX />
                </Icon>
              </Button>
            </Drawer.Header>
            <Drawer.Body p={6}>
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
      
      {/* Confirmation Dialog */}
      <Dialog.Root 
        open={isDialogOpen} 
        onOpenChange={handleConfirmDialogOpenChange}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.CloseTrigger position="absolute" top={3} right={3}>
              <Icon as={FiX} />
            </Dialog.CloseTrigger>
            
            <Dialog.Header>
              <Heading size="md">Confirm Result</Heading>
            </Dialog.Header>
            
            {dialogData && (
              <Dialog.Body>
                <Text mb={4} color="gray.700">
                  Are you sure you want to set the result for "{dialogData.description}" to:
                </Text>
                
                <Card variant="outline">
                  <CardBody p={4}>
                    <Text
                      fontWeight="bold"
                      textAlign="center"
                      color="brand.600"
                      fontSize="lg"
                    >
                      {dialogData.option}
                    </Text>
                  </CardBody>
                </Card>
              </Dialog.Body>
            )}
            
            <Dialog.Footer>
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
                variant="solid" 
                onClick={confirmSetResult}
                ml={3}
              >
                <Icon as={FiCheck} mr={2} />
                Confirm
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
      
      {/* Date Time Picker */}
      <DateTimePicker />
    </VStack>
  );
};

export default TournamentScreen;