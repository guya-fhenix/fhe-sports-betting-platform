import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
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
  Field,
} from '@chakra-ui/react';
import { FiArrowLeft, FiCheck, FiUser, FiLogOut, FiAlertTriangle, FiX, FiLock, FiShield } from 'react-icons/fi';
import { ethers } from 'ethers';
import { getGroupByAddress } from '../services/api';
import { BETTING_GROUP_ABI, TOURNAMENT_ABI } from '../config';
import { formatBlockchainDateToLocal, getCurrentBlockchainTime } from '../utils/time';
import { toaster } from './ui/toaster';
import { Button } from './ui/button';
import { Card, CardBody, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { EncryptedTag } from './ui/encrypted-tag';
import type { Group } from '../types';
import { CopyAddress } from './ui/copy-address';
// Static imports for cofhejs
import { cofhejs, Encryptable, EncryptStep, FheTypes } from 'cofhejs/web';

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
  predictedOption: string;
  pointsAwarded: string;
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
  const [participantCount, setParticipantCount] = useState(0);
  const [prizePool, setPrizePool] = useState('0');
  const [bets, setBets] = useState<UserBet[]>([]);
  const [tournamentStarted, setTournamentStarted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bettingOpportunities, setBettingOpportunities] = useState<BettingOpportunity[]>([]);
  const [userBetIds, setUserBetIds] = useState<number[]>([]);
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [placingBetId, setPlacingBetId] = useState<number | null>(null);
  const [encryptionStep, setEncryptionStep] = useState<EncryptStep | null>(null);
  const [isCofhejsInitialized, setIsCofhejsInitialized] = useState(false);
  const [unsealingValues, setUnsealingValues] = useState<{[key: string]: boolean}>({});
  const [unsealedValues, setUnsealedValues] = useState<{[key: string]: string}>({});
  
  // Add state for user's total points
  const [userTotalPoints, setUserTotalPoints] = useState<string>('');
  
  // Add state for finalization process
  const [isDecryptionRequested, setIsDecryptionRequested] = useState(false);
  const [isRequestingDecryption, setIsRequestingDecryption] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [tournamentEnded, setTournamentEnded] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{addresses: string[], points: number[]} | null>(null);
  const [participantNames, setParticipantNames] = useState<{[address: string]: string}>({});
  const [userClaimableBalance, setUserClaimableBalance] = useState<string>('0');
  const [isClaiming, setIsClaiming] = useState(false);
  const [currentUserAddress, setCurrentUserAddress] = useState<string>('');
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  
  // Add state for betting statistics
  const [bettingStats, setBettingStats] = useState<{[betId: number]: {
    encryptedCorrectUsers: string;
    decryptedCorrectUsers: number | null;
    totalUsers: number;
    isDecrypting: boolean;
  }}>({});
  
  // Local storage key for caching decrypted values - now global cache
  const getCacheKey = () => `fhe-betting-decrypted-values-global`;
  
  // Load cached decrypted values from local storage
  const loadCachedValues = useCallback(() => {
    try {
      const cached = localStorage.getItem(getCacheKey());
      if (cached) {
        const parsedCache = JSON.parse(cached);
        console.log('Loaded cached decrypted values:', parsedCache);
        setUnsealedValues(parsedCache);
        
        // Show toast if cached values were loaded
        const cacheCount = Object.keys(parsedCache).length;
        if (cacheCount > 0) {
          toaster.success({
            title: 'Cache Loaded',
            description: `Loaded ${cacheCount} previously decrypted values from cache`
          });
        }
      }
    } catch (error) {
      console.error('Error loading cached values:', error);
    }
  }, []);
  
  // Save decrypted value to local storage using encrypted value as key
  const saveCachedValue = useCallback((encryptedValue: string, decryptedValue: string) => {
    try {
      const cacheKey = getCacheKey();
      const cached = localStorage.getItem(cacheKey);
      const existingCache = cached ? JSON.parse(cached) : {};
      const updatedCache = {
        ...existingCache,
        [encryptedValue]: decryptedValue
      };
      localStorage.setItem(cacheKey, JSON.stringify(updatedCache));
      console.log(`Cached decrypted value for encrypted value ${encryptedValue}:`, decryptedValue);
    } catch (error) {
      console.error('Error saving cached value:', error);
    }
  }, []);
  
  // Reference to provider and initialization status
  const providerRef = useRef<ethers.BrowserProvider | null>(null);
  const initializingRef = useRef<boolean>(false);
  
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
    // Prevent duplicate initialization
    if (!providerRef.current || isCofhejsInitialized || initializingRef.current) {
      console.log("Skipping cofhejs initialization:", {
        hasProvider: !!providerRef.current,
        isInitialized: isCofhejsInitialized,
        isInitializing: initializingRef.current
      });
      return;
    }
    
    // Set initializing flag
    initializingRef.current = true;
    
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
    } finally {
      // Reset initializing flag
      initializingRef.current = false;
    }
  }, [isCofhejsInitialized]);
  
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
      setCurrentUserAddress(userAddress);
      
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
      console.log("betIdNumbers", betIdNumbers);
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
  
  // Fetch user's total points
  const fetchUserTotalPoints = useCallback(async () => {
    if (!groupAddress || !providerRef.current || !isUserRegistered) return;
    
    try {
      const signer = await providerRef.current.getSigner();
      const userAddress = await signer.getAddress();
      
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      console.log("Fetching user total points for address:", userAddress);
      
      // Get user's encrypted total points
      const encryptedTotalPoints = await contract.getParticipantTotalPoints(userAddress);
      
      console.log("Encrypted total points:", encryptedTotalPoints);
      
      // Convert to string for storage
      const totalPointsString = encryptedTotalPoints.toString();
      setUserTotalPoints(totalPointsString);
      
      console.log("User total points set:", totalPointsString);
    } catch (error) {
      console.error('Error fetching user total points:', error);
    }
  }, [groupAddress, providerRef, isUserRegistered]);
  
  // Check if tournament has ended
  const checkTournamentEnded = useCallback(async () => {
    if (!tournamentAddress || !providerRef.current) return;
    
    try {
      const tournamentContract = new ethers.Contract(
        tournamentAddress,
        TOURNAMENT_ABI,
        providerRef.current
      );
      
      const endTime = await tournamentContract.endTime();
      const now = getCurrentBlockchainTime();
      
      setTournamentEnded(now >= Number(endTime));
    } catch (error) {
      console.error('Error checking if tournament has ended:', error);
    }
  }, [tournamentAddress]);
  
  // Check decryption status
  const checkDecryptionStatus = useCallback(async () => {
    if (!groupAddress || !providerRef.current) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      const decryptionRequested = await contract.isDecryptionRequested();
      setIsDecryptionRequested(decryptionRequested);
    } catch (error) {
      console.error('Error checking decryption status:', error);
    }
  }, [groupAddress]);
  
  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    if (!groupAddress || !providerRef.current || isActive) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      const [addresses, points] = await contract.getLeaderboard();
      setLeaderboard({
        addresses: addresses,
        points: points.map((p: any) => Number(p))
      });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      // Leaderboard might not be finalized yet, this is expected
    }
  }, [groupAddress, isActive]);
  
  // Check user's claimable balance
  const checkClaimableBalance = useCallback(async () => {
    if (!groupAddress || !providerRef.current || !isUserRegistered) return;
    
    try {
      const signer = await providerRef.current.getSigner();
      const userAddress = await signer.getAddress();
      
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      const balance = await contract.claimableBalance(userAddress);
      setUserClaimableBalance(ethers.formatEther(balance));
    } catch (error) {
      console.error('Error checking claimable balance:', error);
    }
  }, [groupAddress, isUserRegistered]);
  
  // Fetch participant names from events
  const fetchParticipantNames = useCallback(async () => {
    if (!groupAddress || !providerRef.current) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      // Get ParticipantRegistered events
      const filter = contract.filters.ParticipantRegistered();
      const events = await contract.queryFilter(filter);
      
      const names: {[address: string]: string} = {};
      events.forEach((event: any) => {
        if (event.args) {
          names[event.args.participant.toLowerCase()] = event.args.name;
        }
      });
      
      setParticipantNames(names);
    } catch (error) {
      console.error('Error fetching participant names:', error);
    }
  }, [groupAddress]);
  
  // Check if current user is platform admin
  const checkPlatformAdmin = useCallback(async () => {
    if (!groupAddress || !providerRef.current || !currentUserAddress) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      const platformAdmin = await contract.getPlatformAdmin();
      setIsPlatformAdmin(platformAdmin.toLowerCase() === currentUserAddress.toLowerCase());
    } catch (error) {
      console.error('Error checking platform admin:', error);
    }
  }, [groupAddress, currentUserAddress]);
  
  // Fetch betting statistics for scored opportunities
  const fetchBettingStats = async () => {
    if (!providerRef.current || !groupAddress || !isCofhejsInitialized) return;
    
    try {
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        providerRef.current
      );
      
      const newStats: {[betId: number]: {
        encryptedCorrectUsers: string;
        decryptedCorrectUsers: number | null;
        totalUsers: number;
        isDecrypting: boolean;
      }} = {};
      
      // Check each betting opportunity to see if it's been scored
      for (const opportunity of bettingOpportunities) {
        if (opportunity.resultsFinalized) {
          try {
            // Get encrypted correct users count and participant count directly
            const encryptedCorrectUsers = await contract.encryptedCorrectUsersCount(opportunity.id);
            const totalUsers = await contract.participantCount();
            
            const encryptedValue = encryptedCorrectUsers.toString();
            
            newStats[opportunity.id] = {
              encryptedCorrectUsers: encryptedValue,
              decryptedCorrectUsers: null,
              totalUsers: Number(totalUsers),
              isDecrypting: true
            };
            
            console.log(`Stats for bet ${opportunity.id}:`, newStats[opportunity.id]);
            
            // Check if already decrypted in cache
            if (unsealedValues[encryptedValue] !== undefined) {
              newStats[opportunity.id].decryptedCorrectUsers = parseInt(unsealedValues[encryptedValue]);
              newStats[opportunity.id].isDecrypting = false;
            }
          } catch (error) {
            console.error(`Error fetching stats for bet ${opportunity.id}:`, error);
          }
        }
      }
      
      setBettingStats(newStats);
      
      // Automatically decrypt encrypted values that aren't cached
      for (const [betIdStr, stats] of Object.entries(newStats)) {
        if (stats.isDecrypting && stats.encryptedCorrectUsers !== '0') {
          // Decrypt automatically without user interaction
          setTimeout(() => {
            autoDecryptCorrectUsers(parseInt(betIdStr), stats.encryptedCorrectUsers);
          }, 100); // Small delay to avoid overwhelming the system
        }
      }
      
    } catch (error) {
      console.error('Error fetching betting statistics:', error);
    }
  };
  
  // Auto-decrypt correct users count
  const autoDecryptCorrectUsers = async (betId: number, encryptedValue: string) => {
    if (!isCofhejsInitialized || !providerRef.current) return;
    
    // Check if already decrypted
    if (unsealedValues[encryptedValue] !== undefined) {
      setBettingStats(prev => ({
        ...prev,
        [betId]: {
          ...prev[betId],
          decryptedCorrectUsers: parseInt(unsealedValues[encryptedValue]),
          isDecrypting: false
        }
      }));
      return;
    }

    try {
      // Get or create permit
      const signer = await providerRef.current.getSigner();
      const userAddress = await signer.getAddress();
      
      const permit = await cofhejs.createPermit({
        type: 'self',
        issuer: userAddress
      });

      if (!permit.data) {
        throw new Error('Failed to create permit');
      }

      // Unseal the value
      const permitHash = permit.data.getHash();
      const unsealResult = await cofhejs.unseal(
        BigInt(encryptedValue), 
        FheTypes.Uint256, 
        permit.data.issuer, 
        permitHash
      );

      if (!unsealResult.success) {
        throw new Error(unsealResult.error?.message || 'Failed to unseal value');
      }

      // Store the unsealed value
      const decryptedValue = parseInt(unsealResult.data.toString());
      
      setUnsealedValues(prev => ({ 
        ...prev, 
        [encryptedValue]: decryptedValue.toString()
      }));
      
      // Save to cache
      saveCachedValue(encryptedValue, decryptedValue.toString());
      
      // Update betting stats
      setBettingStats(prev => ({
        ...prev,
        [betId]: {
          ...prev[betId],
          decryptedCorrectUsers: decryptedValue,
          isDecrypting: false
        }
      }));

      console.log(`Auto-decrypted correct users for bet ${betId}:`, decryptedValue);

    } catch (error: any) {
      console.error(`Error auto-decrypting correct users for bet ${betId}:`, error);
      
      // Mark as failed to decrypt
      setBettingStats(prev => ({
        ...prev,
        [betId]: {
          ...prev[betId],
          isDecrypting: false
        }
      }));
    }
  };
  
  // Request points decryption (Step 1)
  const requestPointsDecryption = async () => {
    if (!groupAddress || !providerRef.current || !tournamentEnded || isDecryptionRequested) return;
    
    try {
      setIsRequestingDecryption(true);
      
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        signer
      );
      
      const loadingToastId = toaster.create({
        title: 'Requesting Decryption',
        description: 'Please confirm the transaction...',
        type: 'loading'
      });
      
      const tx = await contract.requestPointsDecryption();
      
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      await tx.wait();
      
      toaster.dismiss(loadingToastId);
      toaster.success({
        title: 'Decryption Requested',
        description: 'Points decryption has been initiated. You can now proceed to finalize the group.'
      });
      
      setIsDecryptionRequested(true);
      
    } catch (error: any) {
      console.error('Error requesting decryption:', error);
      toaster.error({
        title: 'Decryption Request Failed',
        description: error.message || 'Failed to request points decryption'
      });
    } finally {
      setIsRequestingDecryption(false);
    }
  };
  
  // Finalize and distribute (Step 2)
  const finalizeAndDistribute = async () => {
    if (!groupAddress || !providerRef.current || !isDecryptionRequested || !isActive) return;
    
    try {
      setIsFinalizing(true);
      
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        signer
      );
      
      const loadingToastId = toaster.create({
        title: 'Finalizing Group',
        description: 'Please confirm the transaction...',
        type: 'loading'
      });
      
      const tx = await contract.finalizeAndDistribute();
      
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      await tx.wait();
      
      toaster.dismiss(loadingToastId);
      toaster.success({
        title: 'Group Finalized',
        description: 'The betting group has been finalized and prizes distributed!'
      });
      
      // Update states
      setIsActive(false);
      checkClaimableBalance();
      fetchLeaderboard();
      
    } catch (error: any) {
      console.error('Error finalizing group:', error);
      toaster.error({
        title: 'Finalization Failed',
        description: error.message || 'Failed to finalize the betting group'
      });
    } finally {
      setIsFinalizing(false);
    }
  };
  
  // Claim winnings
  const claimWinnings = async () => {
    if (!groupAddress || !providerRef.current || userClaimableBalance === '0') return;
    
    try {
      setIsClaiming(true);
      
      const signer = await providerRef.current.getSigner();
      const contract = new ethers.Contract(
        groupAddress,
        BETTING_GROUP_ABI,
        signer
      );
      
      const loadingToastId = toaster.create({
        title: 'Claiming Winnings',
        description: 'Please confirm the transaction...',
        type: 'loading'
      });
      
      const tx = await contract.claim();
      
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      await tx.wait();
      
      toaster.dismiss(loadingToastId);
      toaster.success({
        title: 'Winnings Claimed',
        description: `Successfully claimed ${userClaimableBalance} ETH!`
      });
      
      // Update claimable balance
      setUserClaimableBalance('0');
      
    } catch (error: any) {
      console.error('Error claiming winnings:', error);
      toaster.error({
        title: 'Claim Failed',
        description: error.message || 'Failed to claim winnings'
      });
    } finally {
      setIsClaiming(false);
    }
  };
  
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

      const logEncryptionStep = (state: EncryptStep) => {
        setEncryptionStep(state);
        toaster.update(loadingToastId, {
          title: 'Encrypting Selection',
          description: `Step: ${state}`,
          type: 'loading'
        });
        console.log(`Log Encrypt Step :: ${state}`);
      };
    
      
      // Encrypt the option index using cofhejs
      console.log("Cofhejs instance:", cofhejs);
      console.log("Cofhejs state:", cofhejs.store.getState());
      console.log("Encrypting option index:", optionIndex);
      const encryptedOption = await cofhejs.encrypt(logEncryptionStep, [Encryptable.uint16(BigInt(optionIndex))]);
      
      console.log("Encrypted option:", encryptedOption);
      console.log("Encrypted option data:", encryptedOption.data);
      
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
      
      console.log("Placing bet with encrypted option:", encryptedOption.data[0]);
      // Call placeBet with the encrypted option
      const tx = await contract.placeBet(betId, encryptedOption.data[0]);
      
      // Update toast
      toaster.update(loadingToastId, {
        title: 'Transaction Sent',
        description: 'Please wait for confirmation...',
        type: 'loading'
      });
      
      // Wait for transaction to be mined
      await tx.wait();
      
      // Dismiss loading toast
      toaster.dismiss(loadingToastId);
      
      // Show success toast
      toaster.success({
        title: 'Bet Placed Successfully',
        description: `Your bet has been placed on option "${bettingOpportunities.find(o => o.id === betId)?.options[optionIndex]}"`
      });
      
      // Update user's bets
      fetchUserBets();
      fetchUserTotalPoints();
      
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
      setEncryptionStep(null);

      toaster.dismiss(loadingToastId);
    }
  };
  
  // Unseal an encrypted value
  const unsealValue = async (encryptedValue: string, fheType: FheTypes) => {
    if (!isCofhejsInitialized || !providerRef.current) {
      toaster.error({
        title: 'Unsealing Failed',
        description: 'Encryption system not initialized'
      });
      return;
    }

    // Check if already unsealed using encrypted value as key
    if (unsealedValues[encryptedValue] !== undefined) {
      return;
    }

    try {
      setUnsealingValues(prev => ({ ...prev, [encryptedValue]: true }));

      // Get or create permit
      const signer = await providerRef.current.getSigner();
      const userAddress = await signer.getAddress();
      
      const permit = await cofhejs.createPermit({
        type: 'self',
        issuer: userAddress
      });

      // Check if permit was created successfully
      if (!permit.data) {
        throw new Error('Failed to create permit');
      }

      // Unseal the value
      const permitHash = permit.data.getHash();
      console.log("ctHash", encryptedValue);
      const unsealResult = await cofhejs.unseal(
        BigInt(encryptedValue), 
        fheType, 
        permit.data.issuer, 
        permitHash
      );

      console.log("Unseal result:", unsealResult);

      // Check if unsealing was successful
      if (!unsealResult.success) {
        throw new Error(unsealResult.error?.message || 'Failed to unseal value');
      }

      // Store the unsealed value using encrypted value as key
      const unsealedString = unsealResult.data.toString();
      setUnsealedValues(prev => ({ 
        ...prev, 
        [encryptedValue]: unsealedString 
      }));
      
      // Save to local storage cache using encrypted value as key
      saveCachedValue(encryptedValue, unsealedString);

      toaster.success({
        title: 'Value Decrypted',
        description: `Decrypted value: ${unsealedString}`
      });

    } catch (error: any) {
      console.error('Error unsealing value:', error);
      toaster.error({
        title: 'Unsealing Failed',
        description: error.message || 'Failed to decrypt value'
      });
    } finally {
      setUnsealingValues(prev => ({ ...prev, [encryptedValue]: false }));
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
      await tx.wait();
      
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
      await tx.wait();
      
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
    loadCachedValues(); // Load cached decrypted values
  }, [fetchGroup, loadCachedValues]);
  
  // Fetch contract data when provider is available
  useEffect(() => {
    if (providerRef.current) {
      checkGroupActive();
      checkUserRegistered();
      checkTournamentStarted();
      checkTournamentEnded();
      checkDecryptionStatus();
      fetchParticipants();
      fetchBettingOpportunities();
      fetchParticipantNames();
      
      // Only initialize cofhejs if not already initialized or initializing
      if (!isCofhejsInitialized && !initializingRef.current) {
        initializeCofhejs();
      }
    }
  }, [checkGroupActive, checkUserRegistered, checkTournamentStarted, checkTournamentEnded, checkDecryptionStatus, fetchParticipants, fetchBettingOpportunities, fetchParticipantNames, initializeCofhejs, isCofhejsInitialized]);
  
  // Fetch user bets when registered status changes
  useEffect(() => {
    if (isUserRegistered) {
      fetchUserBets();
      fetchUserTotalPoints();
    }
  }, [isUserRegistered, fetchUserBets, fetchUserTotalPoints]);
  
  // Fetch finalization data when group becomes inactive
  useEffect(() => {
    if (!isActive && isUserRegistered) {
      fetchLeaderboard();
      checkClaimableBalance();
    }
  }, [isActive, isUserRegistered, fetchLeaderboard, checkClaimableBalance]);
  
  // Check platform admin when user address changes
  useEffect(() => {
    if (currentUserAddress) {
      checkPlatformAdmin();
    }
  }, [currentUserAddress, checkPlatformAdmin]);
  
  // Fetch betting statistics when betting opportunities change
  useEffect(() => {
    if (bettingOpportunities.length > 0) {
      fetchBettingStats();
    }
  }, [bettingOpportunities]);
  
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
  const formatEncryptedValue = (value: string, fheType: FheTypes, options?: string[]) => {
    if (!value || value === '0') {
      return 'No value';
    }
    
    return (
      <EncryptedTag 
        onUnseal={() => unsealValue(value, fheType)}
        isUnsealing={unsealingValues[value] || false}
        unsealedValue={unsealedValues[value]}
        options={options}
      />
    );
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
      
      {/* User Total Points Section */}
      {isUserRegistered && (
        <Card variant="outline">
          <CardHeader>
            <Heading size="lg" color="gray.800">Your Performance</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" gap={4}>
              <Box>
                <Text fontSize="sm" fontWeight="semibold" mb={3} color="gray.700">
                  Total Points Earned:
                </Text>
                <Box 
                  w="full" 
                  p={1}
                  bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  borderRadius="lg"
                  position="relative"
                  overflow="hidden"
                >
                  <Box
                    w="full"
                    p={4}
                    bg="white"
                    borderRadius="md"
                    position="relative"
                    overflow="hidden"
                  >
                    <Box
                      position="absolute"
                      top={0}
                      left={0}
                      right={0}
                      bottom={0}
                      opacity={0.05}
                      backgroundImage="repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(102, 126, 234, 0.1) 10px, rgba(102, 126, 234, 0.1) 20px)"
                      animation="slide 20s linear infinite"
                      css={{
                        '@keyframes slide': {
                          '0%': { transform: 'translateX(-20px)' },
                          '100%': { transform: 'translateX(20px)' }
                        }
                      }}
                    />
                    
                    <HStack justify="space-between" align="center" position="relative" zIndex={1}>
                      <VStack align="start" gap={1}>
                        <HStack gap={2}>
                          <Box w={2} h={2} bg="blue.400" borderRadius="full" />
                          <Text fontSize="sm" color="gray.800" fontWeight="bold">
                            Performance Score
                          </Text>
                        </HStack>
                        <HStack gap={2} align="center">
                          <Icon as={FiLock} color="purple.600" boxSize={3} />
                          <Text fontSize="sm" color="purple.700" fontWeight="bold" letterSpacing="wide">
                            PROTECTED BY FHE
                          </Text>
                        </HStack>
                      </VStack>
                      
                      <HStack 
                        bg="gray.100" 
                        px={4} 
                        py={3} 
                        borderRadius="full"
                        gap={2}
                      >
                        <Text fontSize="xs" color="gray.600" fontWeight="medium">
                          TOTAL POINTS
                        </Text>
                        {userTotalPoints && userTotalPoints !== '0' ? 
                          formatEncryptedValue(userTotalPoints, FheTypes.Uint256) : 
                          <HStack 
                            gap={1} 
                            px={2} 
                            py={1} 
                            bg="white" 
                            borderRadius="md"
                            opacity={0.8}
                            transition="all 0.3s ease"
                            _hover={{ opacity: 1, transform: 'scale(1.05)' }}
                          >
                            <Text fontSize="xs" color="gray.500" fontWeight="bold" letterSpacing="wide">
                              NO VALUE
                            </Text>
                          </HStack>
                        }
                      </HStack>
                      
                      <Box 
                        p={3} 
                        bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                        borderRadius="xl"
                        boxShadow="0 4px 12px rgba(102, 126, 234, 0.3)"
                        css={{
                          '@keyframes pulse': {
                            '0%, 100%': { transform: 'scale(1)', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)' },
                            '50%': { transform: 'scale(1.05)', boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)' }
                          },
                          animation: 'pulse 3s ease-in-out infinite'
                        }}
                      >
                        <Icon 
                          as={FiShield} 
                          color="white" 
                          boxSize={5}
                          filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))"
                        />
                      </Box>
                    </HStack>
                  </Box>
                </Box>
              </Box>
            </VStack>
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
                  const canPlaceBet = isBettingWindowOpen(opportunity);
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
                              ) : !canPlaceBet && opportunity.startTime > 0 ? (
                                <Badge variant="ended">Betting Closed</Badge>
                              ) : opportunity.startTime > 0 ? (
                                <Badge variant="active">Betting Open</Badge>
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
                                      loadingText={encryptionStep || "Placing..."}
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
                                    variant={opportunity.resultsFinalized && opportunity.result === index ? "solid" : "outline"}
                                    colorScheme={opportunity.resultsFinalized && opportunity.result === index ? "green" : "gray"}
                                    px={3}
                                    py={2}
                                    fontSize="sm"
                                    bg={opportunity.resultsFinalized && opportunity.result === index ? "green.500" : undefined}
                                    color={opportunity.resultsFinalized && opportunity.result === index ? "white" : undefined}
                                    borderColor={opportunity.resultsFinalized && opportunity.result === index ? "green.500" : undefined}
                                  >
                                    {option}
                                    {opportunity.resultsFinalized && opportunity.result === index && (
                                      <Icon as={FiCheck} ml={2} color="white" />
                                    )}
                                  </Badge>
                                ))}
                              </HStack>
                            )}
                            
                            {!canPlaceBet && !hasPlacedBet && opportunity.startTime === 0 && (
                              <Card variant="outline" bg="gray.50" borderColor="gray.200" mt={3}>
                                <CardBody p={4}>
                                  <HStack gap={2} align="start">
                                    <Text fontSize="lg">⏳</Text>
                                    <VStack align="start" gap={1}>
                                      <Text fontSize="sm" color="gray.700" fontWeight="semibold">
                                        Event start time not set
                                      </Text>
                                      <Text fontSize="xs" color="gray.600">
                                        Betting will open once the event start time is announced
                                      </Text>
                                    </VStack>
                                  </HStack>
                                </CardBody>
                              </Card>
                            )}
                            
                            {canPlaceBet && !isCofhejsInitialized && (
                              <Card variant="outline" bg="error.50" borderColor="error.200" mt={3}>
                                <CardBody p={4}>
                                  <HStack gap={2} align="start">
                                    <Text fontSize="lg">🔐</Text>
                                    <VStack align="start" gap={1}>
                                      <Text fontSize="sm" color="error.700" fontWeight="semibold">
                                        Encryption setup required
                                      </Text>
                                      <Text fontSize="xs" color="error.600">
                                        Please refresh the page and try again
                                      </Text>
                                    </VStack>
                                  </HStack>
                                </CardBody>
                              </Card>
                            )}
                          </Box>
                          
                          {/* User's Bet Details - Progress Bar Style */}
                          {hasPlacedBet && userBet && (
                            <Box 
                              w="full" 
                              p={1}
                              bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                              borderRadius="lg"
                              position="relative"
                              overflow="hidden"
                            >
                              {/* Inner content box */}
                              <Box
                                w="full"
                                p={4}
                                bg="white"
                                borderRadius="md"
                                position="relative"
                                overflow="hidden"
                              >
                                {/* Animated background pattern */}
                                <Box
                                  position="absolute"
                                  top={0}
                                  left={0}
                                  right={0}
                                  bottom={0}
                                  opacity={0.05}
                                  backgroundImage="repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(102, 126, 234, 0.1) 10px, rgba(102, 126, 234, 0.1) 20px)"
                                  animation="slide 20s linear infinite"
                                  css={{
                                    '@keyframes slide': {
                                      '0%': { transform: 'translateX(-20px)' },
                                      '100%': { transform: 'translateX(20px)' }
                                    }
                                  }}
                                />
                                
                                {/* Content */}
                                <HStack justify="space-between" align="center" position="relative" zIndex={1}>
                                  {/* Left: Status */}
                                  <VStack align="start" gap={1}>
                                    <HStack gap={2}>
                                      <Box w={2} h={2} bg="green.400" borderRadius="full" />
                                      <Text fontSize="sm" color="gray.800" fontWeight="bold">
                                        Bet Active
                                      </Text>
                                    </HStack>
                                    <HStack gap={2} align="center">
                                      <Icon as={FiLock} color="purple.600" boxSize={3} />
                                      <Text fontSize="sm" color="purple.700" fontWeight="bold" letterSpacing="wide">
                                        PROTECTED BY FHE
                                      </Text>
                                    </HStack>
                                  </VStack>
                                  
                                  {/* Center: Data Pills */}
                                  <HStack gap={4}>
                                    <HStack 
                                      bg="gray.100" 
                                      px={3} 
                                      py={2} 
                                      borderRadius="full"
                                      gap={2}
                                    >
                                      <Text fontSize="xs" color="gray.600" fontWeight="medium">
                                        CHOICE
                                      </Text>
                                      {userBet.predictedOption && userBet.predictedOption !== '0' ? 
                                        formatEncryptedValue(userBet.predictedOption, FheTypes.Uint16, opportunity.options) : 
                                        <HStack 
                                          gap={1} 
                                          px={2} 
                                          py={1} 
                                          bg="white" 
                                          borderRadius="md"
                                          opacity={0.8}
                                          transition="all 0.3s ease"
                                          _hover={{ opacity: 1, transform: 'scale(1.05)' }}
                                        >
                                          <Text fontSize="xs" color="gray.500" fontWeight="bold" letterSpacing="wide">
                                            NO VALUE
                                          </Text>
                                        </HStack>
                                      }
                                    </HStack>
                                    
                                    <HStack 
                                      bg="gray.100" 
                                      px={3} 
                                      py={2} 
                                      borderRadius="full"
                                      gap={2}
                                    >
                                      <Text fontSize="xs" color="gray.600" fontWeight="medium">
                                        SCORE
                                      </Text>
                                      {userBet.pointsAwarded && userBet.pointsAwarded !== '0' ? 
                                        formatEncryptedValue(userBet.pointsAwarded, FheTypes.Uint256) : 
                                        <HStack 
                                          gap={1} 
                                          px={2} 
                                          py={1} 
                                          bg="white" 
                                          borderRadius="md"
                                          opacity={0.8}
                                          transition="all 0.3s ease"
                                          _hover={{ opacity: 1, transform: 'scale(1.05)' }}
                                        >
                                          <Text fontSize="xs" color="gray.500" fontWeight="bold" letterSpacing="wide">
                                            NO VALUE
                                          </Text>
                                        </HStack>
                                      }
                                    </HStack>
                                  </HStack>
                                  
                                  {/* Right: Security Icon */}
                                  <Box 
                                    p={3} 
                                    bg="linear-gradient(135deg, #667eea 0%, #764ba2 100%)" 
                                    borderRadius="xl"
                                    boxShadow="0 4px 12px rgba(102, 126, 234, 0.3)"
                                    css={{
                                      '@keyframes pulse': {
                                        '0%, 100%': { transform: 'scale(1)', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)' },
                                        '50%': { transform: 'scale(1.05)', boxShadow: '0 6px 16px rgba(102, 126, 234, 0.5)' }
                                      },
                                      animation: 'pulse 3s ease-in-out infinite'
                                    }}
                                  >
                                    <Icon 
                                      as={FiShield} 
                                      color="white" 
                                      boxSize={5}
                                      filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))"
                                    />
                                  </Box>
                                </HStack>
                              </Box>
                            </Box>
                          )}
                          
                          {/* Betting Statistics - Show for finalized opportunities */}
                          {opportunity.resultsFinalized && bettingStats[opportunity.id] && (
                            <Card variant="outline" bg="blue.50" borderColor="blue.200">
                              <CardBody p={4}>
                                <VStack align="stretch" gap={3}>
                                  <HStack justify="space-between" align="center">
                                    <Text fontSize="sm" fontWeight="semibold" color="blue.800">
                                      📊 Betting Statistics
                                    </Text>
                                    <Badge variant="outline" colorScheme="blue" fontSize="xs">
                                      Simple Scoring
                                    </Badge>
                                  </HStack>
                                  
                                  <HStack justify="space-around" wrap="wrap" gap={4}>
                                    <VStack align="center" gap={1}>
                                      <Text fontSize="xs" color="blue.600" fontWeight="medium">
                                        Correct Predictions
                                      </Text>
                                      <HStack gap={2}>
                                        {bettingStats[opportunity.id].isDecrypting ? (
                                          <HStack gap={2}>
                                            <Spinner size="sm" color="blue.500" />
                                            <Text fontSize="sm" color="blue.600">Decrypting...</Text>
                                          </HStack>
                                        ) : bettingStats[opportunity.id].decryptedCorrectUsers !== null ? (
                                          <Text fontSize="xl" color="blue.800" fontWeight="bold">
                                            {bettingStats[opportunity.id].decryptedCorrectUsers}
                                          </Text>
                                        ) : (
                                          <Text fontSize="xl" color="blue.800" fontWeight="bold">0</Text>
                                        )}
                                        <Text fontSize="xl" color="blue.800" fontWeight="bold">
                                          / {bettingStats[opportunity.id].totalUsers}
                                        </Text>
                                      </HStack>
                                    </VStack>
                                  </HStack>
                                  
                                  <Box textAlign="center">
                                    <Text fontSize="xs" color="blue.500">
                                      🎯 1 point awarded for each correct prediction
                                    </Text>
                                    <Text fontSize="xs" color="blue.400">
                                      🔐 Automatically decrypted from FHE-protected data
                                    </Text>
                                  </Box>
                                </VStack>
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
      
      {/* Finalization Section - Only show to platform admin when tournament has ended */}
      {tournamentEnded && isActive && isPlatformAdmin && (
        <Card variant="outline" borderColor="warning.200" bg="warning.50">
          <CardHeader>
            <Heading size="lg" color="warning.800">Finalize Betting Group</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" gap={6}>
              <Text color="warning.700" fontSize="sm">
                The tournament has ended. You can now finalize this betting group in two steps:
              </Text>
              
              {/* Step 1: Request Decryption */}
              <Card variant="outline" bg="white">
                <CardBody p={4}>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" gap={1}>
                      <HStack gap={2}>
                        <Box 
                          w={6} 
                          h={6} 
                          bg={isDecryptionRequested ? "success.500" : "gray.300"} 
                          borderRadius="full" 
                          display="flex" 
                          alignItems="center" 
                          justifyContent="center"
                        >
                          {isDecryptionRequested ? (
                            <Icon as={FiCheck} color="white" boxSize={3} />
                          ) : (
                            <Text color="white" fontSize="xs" fontWeight="bold">1</Text>
                          )}
                        </Box>
                        <Text fontWeight="semibold" color="gray.800">
                          Request Points Decryption
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.600" ml={8}>
                        Initiate decryption of all participant points for final ranking
                      </Text>
                    </VStack>
                    
                    <Button
                      variant={isDecryptionRequested ? "outline" : "solid"}
                      size="sm"
                      loading={isRequestingDecryption}
                      onClick={requestPointsDecryption}
                      disabled={isDecryptionRequested}
                    >
                      {isDecryptionRequested ? 'Decryption Requested' : 'Request Decryption'}
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
              
              {/* Step 2: Finalize and Distribute */}
              <Card variant="outline" bg="white">
                <CardBody p={4}>
                  <HStack justify="space-between" align="center">
                    <VStack align="start" gap={1}>
                      <HStack gap={2}>
                        <Box 
                          w={6} 
                          h={6} 
                          bg={!isActive ? "success.500" : isDecryptionRequested ? "blue.500" : "gray.300"} 
                          borderRadius="full" 
                          display="flex" 
                          alignItems="center" 
                          justifyContent="center"
                        >
                          {!isActive ? (
                            <Icon as={FiCheck} color="white" boxSize={3} />
                          ) : (
                            <Text color="white" fontSize="xs" fontWeight="bold">2</Text>
                          )}
                        </Box>
                        <Text fontWeight="semibold" color="gray.800">
                          Finalize and Distribute Prizes
                        </Text>
                      </HStack>
                      <Text fontSize="sm" color="gray.600" ml={8}>
                        Complete the finalization and distribute prizes to winners
                      </Text>
                    </VStack>
                    
                    <Button
                      variant={!isActive ? "outline" : "solid"}
                      size="sm"
                      loading={isFinalizing}
                      onClick={finalizeAndDistribute}
                      disabled={!isDecryptionRequested || !isActive}
                    >
                      {!isActive ? 'Group Finalized' : 'Finalize Group'}
                    </Button>
                  </HStack>
                </CardBody>
              </Card>
            </VStack>
          </CardBody>
        </Card>
      )}
      
      {/* Leaderboard Section - Show when group is finalized */}
      {!isActive && leaderboard && (
        <Card variant="outline">
          <CardHeader>
            <Heading size="lg" color="gray.800">Final Leaderboard</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" gap={4}>
              {leaderboard.addresses.map((address, index) => {
                const points = leaderboard.points[index];
                const isCurrentUser = address.toLowerCase() === currentUserAddress.toLowerCase();
                const prizePercentage = group?.prizeDistribution[index] ? group.prizeDistribution[index] / 10 : 0;
                const prizeAmount = prizePercentage > 0 ? (parseFloat(prizePool) * prizePercentage / 100).toFixed(4) : '0';
                
                return (
                  <Card 
                    key={address} 
                    variant={isCurrentUser ? "betting" : "outline"}
                    bg={isCurrentUser ? "blue.50" : "white"}
                    borderColor={isCurrentUser ? "blue.200" : "gray.200"}
                  >
                    <CardBody p={4}>
                      <HStack justify="space-between" align="center">
                        <HStack gap={4}>
                          <Box 
                            w={10} 
                            h={10} 
                            bg={index === 0 ? "yellow.400" : index === 1 ? "gray.400" : index === 2 ? "orange.400" : "gray.200"} 
                            borderRadius="full" 
                            display="flex" 
                            alignItems="center" 
                            justifyContent="center"
                          >
                            <Text color={index < 3 ? "white" : "gray.600"} fontSize="lg" fontWeight="bold">
                              {index + 1}
                            </Text>
                          </Box>
                          
                          <VStack align="start" gap={1}>
                            <HStack gap={2}>
                              <Text fontWeight="semibold" color="gray.800">
                                {participantNames[address] || `Player ${index + 1}`}
                              </Text>
                              {isCurrentUser && (
                                <Badge variant="solid" colorScheme="blue">You</Badge>
                              )}
                            </HStack>
                            <Text fontSize="sm" color="gray.600" fontFamily="mono">
                              {address.slice(0, 6)}...{address.slice(-4)}
                            </Text>
                          </VStack>
                        </HStack>
                        
                        <VStack align="end" gap={1}>
                          <Text fontWeight="bold" color="gray.800">
                            {points} points
                          </Text>
                          {prizePercentage > 0 && (
                            <VStack align="end" gap={0}>
                              <Text fontSize="sm" color="success.600" fontWeight="semibold">
                                {prizePercentage}% - {prizeAmount} ETH
                              </Text>
                            </VStack>
                          )}
                        </VStack>
                      </HStack>
                    </CardBody>
                  </Card>
                );
              })}
            </VStack>
          </CardBody>
        </Card>
      )}
      
      {/* Claim Winnings Section */}
      {!isActive && isUserRegistered && parseFloat(userClaimableBalance) > 0 && (
        <Card variant="outline" borderColor="success.200" bg="success.50">
          <CardHeader>
            <Heading size="lg" color="success.800">Congratulations! 🎉</Heading>
          </CardHeader>
          <CardBody>
            <VStack align="stretch" gap={4}>
              <Text color="success.700">
                You have winnings to claim from this betting group!
              </Text>
              
              <HStack justify="space-between" align="center">
                <VStack align="start" gap={1}>
                  <Text fontSize="sm" color="success.600" fontWeight="medium">
                    Claimable Amount
                  </Text>
                  <Text fontSize="2xl" color="success.800" fontWeight="bold">
                    {userClaimableBalance} ETH
                  </Text>
                </VStack>
                
                <Button
                  variant="solid"
                  colorScheme="green"
                  size="lg"
                  loading={isClaiming}
                  onClick={claimWinnings}
                >
                  Claim Winnings
                </Button>
              </HStack>
            </VStack>
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