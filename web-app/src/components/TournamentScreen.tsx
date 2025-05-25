import { useState, useEffect, useCallback, useRef } from 'react';
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
import { TOURNAMENT_ABI } from '../config';
import { 
  formatBlockchainDateToLocal, 
  convertLocalDateToBlockchainTime, 
  getCurrentBlockchainTime,
  isTimestampInFuture,
  formatDateForLocalInput
} from '../utils/time';

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
  const [ethPriceUsd, setEthPriceUsd] = useState(3500); // Default fallback value
  
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
  
  // Fetch current ETH price
  useEffect(() => {
    const fetchEthPrice = async () => {
      try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await response.json();
        if (data && data.ethereum && data.ethereum.usd) {
          setEthPriceUsd(data.ethereum.usd);
          console.log('Fetched ETH price:', data.ethereum.usd);
        }
      } catch (error) {
        console.error('Error fetching ETH price:', error);
        // Keep using default price if fetch fails
      }
    };
    
    fetchEthPrice();
  }, []);
  
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
      return <Box bg="blue.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Upcoming</Box>;
    } else if (now <= tournament.endTime) {
      return <Box bg="green.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Active</Box>;
    } else {
      return <Box bg="red.500" color="white" px={2} py={1} borderRadius="md" fontSize="sm">Ended</Box>;
    }
  };
  
  // Add canUpdateStartTime function to check if start time can be updated
  const canUpdateStartTime = (opportunity: any): boolean => {
    if (!opportunity) return false;
    
    // Can update if start time is 0 (not set) or 
    // if it's set but more than 60 seconds in the future
    return opportunity.startTime === 0 || 
           (opportunity.startTime > 0 && isTimestampInFuture(opportunity.startTime, 60));
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
        <Flex justify="center" py={4}>
          <Spinner size="md" color="teal.500" />
        </Flex>
      );
    }
    
    if (bettingOpportunities.length === 0) {
      return <Text color="gray.500">No betting opportunities available</Text>;
    }
    
    return (
      <VStack align="stretch" gap={3}>
        {bettingOpportunities.map((opportunity) => (
          <Box key={opportunity.id} p={3} borderWidth="1px" borderRadius="md">
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="bold">{opportunity.description}</Text>
              <HStack>
                {opportunity.startTime > 0 ? (
                  <Button
                    size="xs"
                    onClick={() => canUpdateStartTime(opportunity) && handleStartTimeClick(opportunity)}
                    disabled={!canUpdateStartTime(opportunity)}
                    title={canUpdateStartTime(opportunity) ? "Click to update start time" : "Cannot update start time"}
                    colorScheme={canUpdateStartTime(opportunity) ? "blue" : "gray"}
                  >
                    <Icon as={FiCalendar} mr={2} />
                    {formatDate(opportunity.startTime)}
                  </Button>
                ) : (
                  <Button
                    size="xs"
                    onClick={() => handleStartTimeClick(opportunity)}
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
                <Button 
                  key={idx}
                  size="sm"
                  onClick={() => !opportunity.resultsFinalized && setResults(opportunity.id, idx)}
                  disabled={opportunity.resultsFinalized}
                  cursor={opportunity.resultsFinalized ? "default" : "pointer"}
                  // variant="outline"
                  colorScheme={opportunity.resultsFinalized && opportunity.result === idx ? "green" : "gray"}
                  p={2}
                  h="auto"
                  fontSize="sm"
                  position="relative"
                  _hover={!opportunity.resultsFinalized ? { bg: "blue.50" } : {}}
                >
                  {option}
                  {opportunity.resultsFinalized && opportunity.result === idx && (
                    <Text as="span" color="green.500" ml={1}>
                      ✓
                    </Text>
                  )}
                </Button>
              ))}
            </Grid>
          </Box>
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
        <Box>
          <HStack justify="space-between" mb={4}>
            <Heading size="md">Bets ({tournament?.bettingOpportunitiesCount || 0})</Heading>
            <Button 
              size="sm" 
              onClick={refreshBettingOpportunities}
              disabled={opportunitiesLoading}
            >
              <Icon as={FiRefreshCw} mr={2} />
              Refresh
            </Button>
          </HStack>
          
          {renderBettingOpportunities()}
        </Box>
        
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
            title={getCreateGroupButtonTooltip()}
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
                <Box 
                  borderWidth="1px" 
                  borderRadius="md" 
                  p={4} 
                  boxShadow="sm" 
                  height="100%"
                  onClick={() => navigate(`/tournaments/${tournament.address}/groups/${group.address}`)}
                  cursor="pointer"
                  transition="all 0.2s"
                  _hover={{ transform: "translateY(-2px)", boxShadow: "md" }}
                >
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
                        {group.prizeDistribution.map(value => (value / 10)).join(', ')}%
                      </Text>
                      
                      <Text fontSize="sm">
                        <Text as="span" fontWeight="bold">Closing Window: </Text>
                        {Math.round(group.generalClosingWindow / 60)} minutes
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
      
      {/* Confirmation using Dialog */}
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
                <Text mb={4}>
                  Are you sure you want to set the result for "{dialogData.description}" to:
                </Text>
                
                <Box
                  p={2}
                  borderRadius="md"
                  bg="blue.50"
                  fontWeight="bold"
                  textAlign="center"
                  width="100%"
                  mb={4}
                >
                  {dialogData.option}
                </Box>
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
                colorScheme="blue" 
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
    </Box>
  );
};

export default TournamentScreen; 