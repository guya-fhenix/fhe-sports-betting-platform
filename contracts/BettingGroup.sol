// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./Tournament.sol";

/**
 * @title BettingGroup
 * @notice Contract for managing betting groups for sports tournaments
 * @dev This is a base implementation without FHE for betting logic
 */
contract BettingGroup {
    // Structs
    struct BettingGroupParams {
        string description;
        uint256 entryFee;
        uint256 minParticipants;
        uint256[] prizeDistribution; // Array of percentages (e.g. [50, 30, 20] for 1st, 2nd, 3rd), max 10 positions
        uint32 generalClosingWindowInSeconds; // Time in seconds before each event when betting closes
    }

    struct Participant {
        address addr;
        string name;
        bool hasRegistered;
        uint256 totalPoints;
        mapping(uint16 => Bet) bets; // betId => Bet
        mapping(uint16 => bool) betScored; // betId => whether points were awarded
    }

    struct Bet {
        uint8 betCount; // Number of bets placed by participant (max 3)
        bool placed;
        uint16[] predictedOption; // The predicted option for the bet
    }

    // For tracking winners and betting group state
    struct Leaderboard {
        address[] participants; // Sorted by points (highest first)
        bool finalized;
        uint256 finalizedTime;
    }

    // Constants
    uint256 public constant MINIMUM_REQUIRED_PARTICIPANTS = 5;
    uint256 public constant MAXIMUM_PRIZE_POSITIONS = 10; // Maximum number of prize positions
    uint256 public constant EXACT_MATCH_MULTIPLIER = 100; // Base percentage for exact match (100%)
    uint8 public constant MAX_BETS_PER_OPPORTUNITY = 3; // Maximum number of bets per betting opportunity
    
    // Fee percentages
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 1; // 1% to platform
    uint256 public constant CREATOR_FEE_PERCENTAGE = 5; // 0.5% to betting group creator
    uint256 public constant WINNER_DISTRIBUTION_PERCENTAGE = 985; // 98.5% to winners
    
    // State variables
    address public admin;
    address public factoryAddress;
    address public tournamentContract;
    BettingGroupParams public params;
    bool public active;
    uint256 public totalPrizePool;
    uint256 public participantCount;
    mapping(address => Participant) public participants;
    address[] public participantAddresses;
    
    // Results and ranking tracking
    Leaderboard public leaderboard;
    mapping(uint16 => bool) public bettingOpportunityScored;
    mapping(uint16 => uint16) public actualResults; // betId => actual result
    uint16 public scoredBettingOpportunities;
    
    // Events
    event BettingGroupCreated(string description, address tournamentContract, uint256 entryFee);
    event ParticipantRegistered(address indexed participant, string name);
    event BetPlaced(address indexed participant, uint16 betId, uint16 predictedOption);
    event BettingGroupStarted();
    event BettingGroupEnded();
    event BettingGroupCancelled(string reason);
    event PrizePaid(address indexed participant, uint256 amount, uint256 rank);
    event ResultsProcessed(uint16 betId, uint16 result);
    event PointsAwarded(address indexed participant, uint16 betId, uint256 points);
    event LeaderboardUpdated();
    event ParticipantWithdrawn(address indexed participant, uint256 amount);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyRegisteredParticipant() {
        require(participants[msg.sender].hasRegistered, "Only registered participants can perform this action");
        _;
    }

    modifier onlyDuringRegistration() {
        // Registration is only open until tournament starts
        Tournament tournament = Tournament(tournamentContract);
        require(
            block.timestamp < tournament.startTime(),
            "Registration closed: Tournament has started"
        );
        
        _;
    }

    modifier bettingGroupActive() {
        require(active, "Betting group is not active");
        _;
    }

    modifier bettingGroupStarted() {
        Tournament tournament = Tournament(tournamentContract);
        require(block.timestamp > tournament.startTime(), "Betting group has not started yet");
        require(active, "Betting group is not active");
        _;
    }

    modifier notFinalized() {
        require(!leaderboard.finalized, "Betting group already finalized");
        _;
    }

    /**
     * @notice Creates a new betting group for a tournament
     * @param _admin Address of the betting group administrator
     * @param _description Description of the betting group
     * @param _tournamentContract Address of the tournament contract
     * @param _entryFee Entry fee in wei
     * @param _prizeDistribution Array of percentages for prize distribution
     * @param _bonusPointsPercentage Additional points awarded for correct predictions
     * @param _generalClosingWindowInSeconds Time in seconds before tournament start when betting closes
     */
    constructor(
        address _admin,
        string memory _description,
        address _tournamentContract,
        uint256 _entryFee,
        uint256[] memory _prizeDistribution,
        uint8 _bonusPointsPercentage,
        uint32 _generalClosingWindowInSeconds
    ) {
        // All validations are now handled by the factory
        
        admin = _admin;
        factoryAddress = msg.sender; // The factory is the deployer
        tournamentContract = _tournamentContract;
        params = BettingGroupParams({
            description: _description,
            entryFee: _entryFee,
            minParticipants: MINIMUM_REQUIRED_PARTICIPANTS,
            prizeDistribution: _prizeDistribution,
            generalClosingWindowInSeconds: _generalClosingWindowInSeconds
        });
        
        active = true;
        totalPrizePool = 0;
        participantCount = 0;
        scoredBettingOpportunities = 0;
        
        // Initialize leaderboard
        leaderboard.finalized = false;
        leaderboard.finalizedTime = 0;
        
        emit BettingGroupCreated(_description, _tournamentContract, _entryFee);
    }

    /**
     * @notice Allows a participant to register for the betting group by paying the entry fee
     * @param _name Name of the participant
     */
    function register(string memory _name) external payable onlyDuringRegistration bettingGroupActive {
        require(!participants[msg.sender].hasRegistered, "Already registered");
        require(msg.value == params.entryFee, "Incorrect entry fee");
        
        Participant storage participant = participants[msg.sender];
        participant.addr = msg.sender;
        participant.name = _name;
        participant.hasRegistered = true;
        participant.totalPoints = 0;
        
        participantAddresses.push(msg.sender);
        participantCount++;
        totalPrizePool += msg.value;
        
        emit ParticipantRegistered(msg.sender, _name);
    }

    /**
     * @notice Allows a participant to withdraw from the betting group before it starts
     * @dev Only available during registration period and before placing any bets
     */
    function withdrawFromBettingGroup() external onlyRegisteredParticipant onlyDuringRegistration bettingGroupActive {
        // Check if participant has placed any bets
        bool hasPlacedBets = false;
        
        for (uint256 i = 0; i < params.prizeDistribution.length; i++) {
            uint16 betId = uint16(i + 1);
            if (participants[msg.sender].bets[betId].placed) {
                hasPlacedBets = true;
                break;
            }
        }
        
        require(!hasPlacedBets, "Cannot withdraw after placing bets");
        
        // Process withdrawal
        address payable participantAddress = payable(msg.sender);
        uint256 refundAmount = params.entryFee;
        
        // Update betting group state
        Participant storage participant = participants[msg.sender];
        participant.hasRegistered = false;
        
        // Remove from participant addresses array
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            if (participantAddresses[i] == msg.sender) {
                // Replace with the last element and then remove the last element
                participantAddresses[i] = participantAddresses[participantAddresses.length - 1];
                participantAddresses.pop();
                break;
            }
        }
        
        participantCount--;
        totalPrizePool -= refundAmount;
        
        // Transfer the entry fee back to the participant
        participantAddress.transfer(refundAmount);
        
        emit ParticipantWithdrawn(msg.sender, refundAmount);
    }

    /**
     * @notice Allows a registered participant to place a bet on a betting opportunity
     * @param _betId ID of the betting opportunity
     * @param _predictedOption The predicted option for the bet
     */
    function placeBet(uint16 _betId, uint16 _predictedOption) 
        external 
        onlyRegisteredParticipant 
        bettingGroupActive 
    {
        // Check if betting window is open in tournament
        Tournament tournament = Tournament(tournamentContract);
        require(tournament.isBettingWindowOpen(_betId, params.generalClosingWindowInSeconds), "Betting window is closed");
        
        // Get available options for this bet
        uint16[] memory options = tournament.getOptions(_betId);
        require(_predictedOption < options.length, "Invalid option selected");
        
        // Check if participant has reached the maximum number of bets for this opportunity
        Participant storage participant = participants[msg.sender];
        require(participant.bets[_betId].betCount < MAX_BETS_PER_OPPORTUNITY, "Maximum number of bets reached for this opportunity");
        
        // Initialize bet data structure if this is the first bet
        if (!participant.bets[_betId].placed) {
            participant.bets[_betId].placed = true;
            participant.bets[_betId].betCount = 0;
            participant.bets[_betId].predictedOption = new uint16[](MAX_BETS_PER_OPPORTUNITY);
        }
        
        // Store the bet in the next available slot
        uint8 currentBetIndex = participant.bets[_betId].betCount;
        participant.bets[_betId].predictedOption[currentBetIndex] = _predictedOption;
        participant.bets[_betId].betCount++;
        
        emit BetPlaced(msg.sender, _betId, _predictedOption);
    }

    /**
     * @notice Finalizes the betting group after tournament has started
     * @dev Cancels the betting group if minimum participants not met or if fewer participants than prizes
     */
    function finalizeBettingGroup() external onlyAdmin bettingGroupActive {
        // Betting group can be finalized once tournament has started
        Tournament tournament = Tournament(tournamentContract);
        bool tournamentStarted = block.timestamp >= tournament.startTime();
        
        require(tournamentStarted, "Tournament has not started yet");
        
        // Check if we have the minimum required participants
        if (participantCount < MINIMUM_REQUIRED_PARTICIPANTS) {
            cancelBettingGroup("Not enough participants");
            return;
        }
        
        // Check if we have enough participants for the prize distribution
        if (participantCount < params.prizeDistribution.length) {
            cancelBettingGroup("Fewer participants than prize positions");
            return;
        }
        
        // Betting group can proceed
        emit BettingGroupStarted();
    }

    /**
     * @notice Cancels the betting group and returns entry fees
     * @param _reason Reason for cancellation
     */
    function cancelBettingGroup(string memory _reason) internal {
        active = false;
        
        // Refund all participants
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address payable participant = payable(participantAddresses[i]);
            participant.transfer(params.entryFee);
        }
        
        totalPrizePool = 0;
        
        emit BettingGroupCancelled(_reason);
    }

    /**
     * @notice Checks if a participant has placed a bet for a specific betting opportunity
     * @param _participant Address of the participant
     * @param _betId ID of the betting opportunity
     * @return bool True if the participant has placed a bet, false otherwise
     */
    function hasBetPlaced(address _participant, uint16 _betId) external view returns (bool) {
        return participants[_participant].bets[_betId].placed;
    }

    /**
     * @notice Gets a participant's bet for a specific betting opportunity
     * @param _participant Address of the participant
     * @param _betId ID of the betting opportunity
     * @param _betIndex Index of the bet (0, 1, or 2)
     * @return predictedOption The predicted option for the bet
     */
    function getParticipantBet(address _participant, uint16 _betId, uint8 _betIndex) 
        external 
        view 
        returns (uint16) 
    {
        require(participants[_participant].bets[_betId].placed, "Bet not placed");
        require(_betIndex < participants[_participant].bets[_betId].betCount, "Bet index out of range");
        
        return participants[_participant].bets[_betId].predictedOption[_betIndex];
    }

    /**
     * @notice Gets the number of bets a participant has placed for a specific betting opportunity
     * @param _participant Address of the participant
     * @param _betId ID of the betting opportunity
     * @return Number of bets placed (0-3)
     */
    function getParticipantBetCount(address _participant, uint16 _betId) 
        external 
        view 
        returns (uint8) 
    {
        if (!participants[_participant].bets[_betId].placed) {
            return 0;
        }
        return participants[_participant].bets[_betId].betCount;
    }

    /**
     * @notice Gets the total prize pool of the betting group
     * @return Total prize pool in wei
     */
    function getPrizePool() external view returns (uint256) {
        return totalPrizePool;
    }

    /**
     * @notice Gets a participant's total points
     * @param _participant Address of the participant
     * @return totalPoints Total points earned by the participant
     */
    function getParticipantPoints(address _participant) external view returns (uint256) {
        require(participants[_participant].hasRegistered, "Participant not registered");
        return participants[_participant].totalPoints;
    }

    /**
     * @notice Processes results for a betting opportunity from the tournament
     * @dev Fetches results from the tournament contract and scores all bets
     * @param _betId ID of the betting opportunity to process
     */
    function processResults(uint16 _betId) 
        external 
        onlyAdmin 
        bettingGroupStarted 
        notFinalized 
    {
        // Verify results haven't been processed already
        require(!bettingOpportunityScored[_betId], "Results already processed");
        
        // Get tournament
        Tournament tournament = Tournament(tournamentContract);
        
        // Check if results are available
        uint16 result = tournament.getResults(_betId);
        
        // Store results
        actualResults[_betId] = result;
        bettingOpportunityScored[_betId] = true;
        scoredBettingOpportunities++;
        
        // Process all participant bets for this opportunity
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participantAddr = participantAddresses[i];
            Participant storage participant = participants[participantAddr];
            
            // Skip if participant hasn't placed a bet for this opportunity
            if (!participant.bets[_betId].placed || participant.betScored[_betId]) {
                continue;
            }
            
            // Process each bet for this opportunity
            uint256 totalPointsForBets = 0;
            for (uint8 betIndex = 0; betIndex < participant.bets[_betId].betCount; betIndex++) {
                // Get predicted option for this bet
                uint16 predictedOption = participant.bets[_betId].predictedOption[betIndex];
                
                // Calculate points for this bet
                uint256 points = calculatePoints(predictedOption, result);
                
                totalPointsForBets += points;
            }
            
            // Add points to participant's total
            participant.totalPoints += totalPointsForBets;
            participant.betScored[_betId] = true;
            
            emit PointsAwarded(participantAddr, _betId, totalPointsForBets);
        }
        
        emit ResultsProcessed(_betId, result);
        
        // If all betting opportunities have been scored, update leaderboard and distribute winnings
        if (scoredBettingOpportunities == params.prizeDistribution.length) {
            updateLeaderboard();
            distributeWinnings();
        }
    }
    
    /**
     * @notice Calculates points for a bet based on predicted vs actual result
     * @param _predicted Predicted option
     * @param _actual Actual result
     * @return Points earned for the bet
     */
    function calculatePoints(
        uint16 _predicted,
        uint16 _actual
    ) internal view returns (uint256) {
        if (_predicted == _actual) {
            return EXACT_MATCH_MULTIPLIER;
        }
        return 0;
    }
    
    /**
     * @notice Updates the leaderboard based on participant points
     * @dev Sorts participants by total points (highest first)
     */
    function updateLeaderboard() internal {
        // Create a memory array of all participants
        address[] memory sortedParticipants = new address[](participantAddresses.length);
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            sortedParticipants[i] = participantAddresses[i];
        }
        
        // Sort by points (simple bubble sort)
        for (uint256 i = 0; i < sortedParticipants.length; i++) {
            for (uint256 j = i + 1; j < sortedParticipants.length; j++) {
                if (participants[sortedParticipants[i]].totalPoints < participants[sortedParticipants[j]].totalPoints) {
                    address temp = sortedParticipants[i];
                    sortedParticipants[i] = sortedParticipants[j];
                    sortedParticipants[j] = temp;
                }
            }
        }
        
        // Store in leaderboard
        leaderboard.participants = sortedParticipants;
        
        emit LeaderboardUpdated();
    }
    
    /**
     * @notice Finalizes the betting group and distributes prizes
     * @dev Can only be called after all results have been processed
     */
    function distributeWinnings() internal {
        require(scoredBettingOpportunities == params.prizeDistribution.length, "Not all results processed");
        
        // Ensure leaderboard is updated
        if (leaderboard.participants.length == 0) {
            updateLeaderboard();
        }
        
        // Calculate platform and creator fees
        uint256 platformFee = totalPrizePool * PLATFORM_FEE_PERCENTAGE / 1000;
        uint256 creatorFee = totalPrizePool * CREATOR_FEE_PERCENTAGE / 1000;
        
        // Send platform fee to Factory contract (not to the platform admin directly)
        payable(factoryAddress).transfer(platformFee);
        
        // Pay betting group creator fee
        address payable creatorAddress = payable(admin);
        if (creatorAddress != address(0)) {
            creatorAddress.transfer(creatorFee);
        }
        
        // Calculate prize amounts based on distribution
        uint256 winnerPool = totalPrizePool * WINNER_DISTRIBUTION_PERCENTAGE / 1000;
        uint256[] memory prizeAmounts = new uint256[](params.prizeDistribution.length);
        for (uint256 i = 0; i < params.prizeDistribution.length; i++) {
            prizeAmounts[i] = winnerPool * params.prizeDistribution[i] / 985; // Adjust for 98.5%
        }
        
        // Distribute prizes to winners
        uint256 prizePositions = params.prizeDistribution.length;
        if (leaderboard.participants.length < prizePositions) {
            prizePositions = leaderboard.participants.length;
        }
        
        for (uint256 i = 0; i < prizePositions; i++) {
            address payable winner = payable(leaderboard.participants[i]);
            uint256 prize = prizeAmounts[i];
            
            winner.transfer(prize);
            
            emit PrizePaid(winner, prize, i + 1);
        }
        
        // Mark betting group as finalized
        leaderboard.finalized = true;
        leaderboard.finalizedTime = block.timestamp;
        active = false;
        
        emit BettingGroupEnded();
    }
    
    /**
     * @notice Publicly accessible function to finalize the betting group and distribute prizes
     * @dev Can only be called after all results have been processed
     */
    function distributeWinningsPublic() external onlyAdmin bettingGroupStarted notFinalized {
        distributeWinnings();
    }
    
    /**
     * @notice Gets the current leaderboard
     * @return addresses Array of participant addresses sorted by points
     * @return pointsArray Array of participant points
     * @return finalized Whether the betting group is finalized
     */
    function getLeaderboard() external view returns (
        address[] memory addresses,
        uint256[] memory pointsArray,
        bool finalized
    ) {
        // Use leaderboard participants if available, otherwise use unsorted list
        if (leaderboard.participants.length > 0) {
            addresses = leaderboard.participants;
        } else {
            addresses = new address[](participantCount);
            for (uint i = 0; i < participantCount; i++) {
                addresses[i] = participantAddresses[i];
            }
        }
        
        // Get points for each participant
        pointsArray = new uint256[](addresses.length);
        for (uint256 i = 0; i < addresses.length; i++) {
            address participantAddr = addresses[i];
            if (participantAddr != address(0)) {
                Participant storage participant = participants[participantAddr];
                pointsArray[i] = participant.totalPoints;
            } else {
                pointsArray[i] = 0;
            }
        }
        
        finalized = leaderboard.finalized;
        
        return (addresses, pointsArray, finalized);
    }
} 