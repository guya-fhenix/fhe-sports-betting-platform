// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./Championship.sol";

/**
 * @title Tournament
 * @notice Contract for managing betting tournaments for motorsports championships
 * @dev This is a base implementation without FHE for betting logic
 */
contract Tournament {
    // Structs
    struct TournamentParams {
        string description;
        uint256 entryFee;
        uint256 minParticipants;
        uint256[] prizeDistribution; // Array of percentages (e.g. [50, 30, 20] for 1st, 2nd, 3rd), max 10 positions
        uint16[] selectedBetIds; // Array of betting opportunity IDs selected for this tournament
        uint8 bonusPointsPercentage; // Additional points awarded for correct predictions (e.g. 20 = 20%)
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
        bool placed;
        uint16[] predictedPositions; // Competitor IDs in predicted positions
    }

    // For tracking winners and tournament state
    struct Leaderboard {
        address[] participants; // Sorted by points (highest first)
        bool finalized;
        uint256 finalizedTime;
    }

    // Constants
    uint256 public constant MINIMUM_REQUIRED_PARTICIPANTS = 5;
    uint256 public constant MAXIMUM_PRIZE_POSITIONS = 10; // Maximum number of prize positions
    uint256 public constant EXACT_MATCH_MULTIPLIER = 100; // Base percentage for exact match (100%)
    uint256 public constant POSITION_MATCH_MULTIPLIER = 50; // Points for right competitor, wrong position (50%)

    // State variables
    address public admin;
    address public championshipContract;
    TournamentParams public params;
    bool public active;
    uint256 public totalPrizePool;
    uint256 public participantCount;
    mapping(address => Participant) public participants;
    address[] public participantAddresses;
    
    // Results and ranking tracking
    Leaderboard public leaderboard;
    mapping(uint16 => bool) public bettingOpportunityScored;
    mapping(uint16 => uint16[]) public actualResults; // betId => actual positions
    uint16 public scoredBettingOpportunities;
    
    // Events
    event TournamentCreated(string description, address championshipContract, uint256 entryFee);
    event ParticipantRegistered(address indexed participant, string name);
    event BetPlaced(address indexed participant, uint16 betId, uint16[] predictedPositions);
    event TournamentStarted();
    event TournamentEnded();
    event TournamentCancelled(string reason);
    event PrizePaid(address indexed participant, uint256 amount, uint256 rank);
    event ResultsProcessed(uint16 betId, uint16[] positions);
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
        // Registration is only open until championship starts
        Championship championship = Championship(championshipContract);
        require(
            block.timestamp < championship.startDate(),
            "Registration closed: Championship has started"
        );
        
        _;
    }

    modifier tournamentActive() {
        require(active, "Tournament is not active");
        _;
    }

    modifier tournamentStarted() {
        Championship championship = Championship(championshipContract);
        require(block.timestamp > championship.startDate(), "Tournament has not started yet");
        require(active, "Tournament is not active");
        _;
    }

    modifier notFinalized() {
        require(!leaderboard.finalized, "Tournament already finalized");
        _;
    }

    /**
     * @notice Creates a new tournament for a championship
     * @param _admin Address of the tournament administrator
     * @param _description Description of the tournament
     * @param _championshipContract Address of the championship contract
     * @param _entryFee Entry fee in wei
     * @param _prizeDistribution Array of percentages for prize distribution
     * @param _selectedBetIds Array of betting opportunity IDs selected for this tournament
     * @param _bonusPointsPercentage Additional points awarded for correct predictions
     * @param _generalClosingWindowInSeconds Time in seconds before championship start when betting closes
     */
    constructor(
        address _admin,
        string memory _description,
        address _championshipContract,
        uint256 _entryFee,
        uint256[] memory _prizeDistribution,
        uint16[] memory _selectedBetIds,
        uint8 _bonusPointsPercentage,
        uint32 _generalClosingWindowInSeconds
    ) {
        // All validations are now handled by the factory
        
        admin = _admin;
        championshipContract = _championshipContract;
        params = TournamentParams({
            description: _description,
            entryFee: _entryFee,
            minParticipants: MINIMUM_REQUIRED_PARTICIPANTS,
            prizeDistribution: _prizeDistribution,
            selectedBetIds: _selectedBetIds,
            bonusPointsPercentage: _bonusPointsPercentage,
            generalClosingWindowInSeconds: _generalClosingWindowInSeconds
        });
        
        active = true;
        totalPrizePool = 0;
        participantCount = 0;
        scoredBettingOpportunities = 0;
        
        // Initialize leaderboard
        leaderboard.finalized = false;
        leaderboard.finalizedTime = 0;
        
        emit TournamentCreated(_description, _championshipContract, _entryFee);
    }

    /**
     * @notice Allows a participant to register for the tournament by paying the entry fee
     * @param _name Name of the participant
     */
    function register(string memory _name) external payable onlyDuringRegistration tournamentActive {
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
     * @notice Allows a participant to withdraw from the tournament before it starts
     * @dev Only available during registration period and before placing any bets
     */
    function withdrawFromTournament() external onlyRegisteredParticipant onlyDuringRegistration tournamentActive {
        // Check if participant has placed any bets
        bool hasPlacedBets = false;
        
        for (uint256 i = 0; i < params.selectedBetIds.length; i++) {
            uint16 betId = params.selectedBetIds[i];
            if (participants[msg.sender].bets[betId].placed) {
                hasPlacedBets = true;
                break;
            }
        }
        
        require(!hasPlacedBets, "Cannot withdraw after placing bets");
        
        // Process withdrawal
        address payable participantAddress = payable(msg.sender);
        uint256 refundAmount = params.entryFee;
        
        // Update tournament state
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
     * @param _predictedPositions Array of competitor IDs in predicted positions
     */
    function placeBet(uint16 _betId, uint16[] memory _predictedPositions) 
        external 
        onlyRegisteredParticipant 
        tournamentActive 
    {
        // Verify bet ID is part of selected bets
        bool isBetSelected = false;
        for (uint256 i = 0; i < params.selectedBetIds.length; i++) {
            if (params.selectedBetIds[i] == _betId) {
                isBetSelected = true;
                break;
            }
        }
        require(isBetSelected, "Betting opportunity not part of this tournament");
        
        // Check if betting window is open in championship
        Championship championship = Championship(championshipContract);
        require(championship.isBettingWindowOpen(_betId, params.generalClosingWindowInSeconds), "Betting window is closed");
        
        // Verify predicted positions length matches expected
        require(_predictedPositions.length == 3, "Must provide exactly top 3 positions");
        
        // Store the bet
        Participant storage participant = participants[msg.sender];
        participant.bets[_betId].placed = true;
        participant.bets[_betId].predictedPositions = _predictedPositions;
        
        emit BetPlaced(msg.sender, _betId, _predictedPositions);
    }

    /**
     * @notice Finalizes the tournament after championship has started
     * @dev Cancels the tournament if minimum participants not met or if fewer participants than prizes
     */
    function finalizeTournament() external onlyAdmin tournamentActive {
        // Tournament can be finalized once championship has started
        Championship championship = Championship(championshipContract);
        bool championshipStarted = block.timestamp >= championship.startDate();
        
        require(championshipStarted, "Championship has not started yet");
        
        // Check if we have the minimum required participants
        if (participantCount < MINIMUM_REQUIRED_PARTICIPANTS) {
            cancelTournament("Not enough participants");
            return;
        }
        
        // Check if we have enough participants for the prize distribution
        if (participantCount < params.prizeDistribution.length) {
            cancelTournament("Fewer participants than prize positions");
            return;
        }
        
        // Tournament can proceed
        emit TournamentStarted();
    }

    /**
     * @notice Cancels the tournament and returns entry fees
     * @param _reason Reason for cancellation
     */
    function cancelTournament(string memory _reason) internal {
        active = false;
        
        // Refund all participants
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address payable participant = payable(participantAddresses[i]);
            participant.transfer(params.entryFee);
        }
        
        totalPrizePool = 0;
        
        emit TournamentCancelled(_reason);
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
     * @return predictedPositions Array of competitor IDs in predicted positions
     */
    function getParticipantBet(address _participant, uint16 _betId) 
        external 
        view 
        returns (uint16[] memory) 
    {
        require(participants[_participant].bets[_betId].placed, "Bet not placed");
        return participants[_participant].bets[_betId].predictedPositions;
    }

    /**
     * @notice Gets all participants in the tournament
     * @return Array of participant addresses
     */
    function getParticipants() external view returns (address[] memory) {
        return participantAddresses;
    }

    /**
     * @notice Gets the total prize pool of the tournament
     * @return Total prize pool in wei
     */
    function getPrizePool() external view returns (uint256) {
        return totalPrizePool;
    }

    /**
     * @notice Gets the selected betting opportunities for this tournament
     * @return Array of betting opportunity IDs
     */
    function getSelectedBets() external view returns (uint16[] memory) {
        return params.selectedBetIds;
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
     * @notice Processes results for a betting opportunity from the championship
     * @dev Fetches results from the championship contract and scores all bets
     * @param _betId ID of the betting opportunity to process
     */
    function processResults(uint16 _betId) 
        external 
        onlyAdmin 
        tournamentStarted 
        notFinalized 
    {
        // Verify bet ID is part of the tournament
        bool isBetSelected = false;
        for (uint256 i = 0; i < params.selectedBetIds.length; i++) {
            if (params.selectedBetIds[i] == _betId) {
                isBetSelected = true;
                break;
            }
        }
        require(isBetSelected, "Betting opportunity not part of this tournament");
        
        // Verify results haven't been processed already
        require(!bettingOpportunityScored[_betId], "Results already processed");
        
        // Get championship
        Championship championship = Championship(championshipContract);
        
        // Check if results are available
        uint16[] memory results = championship.getResults(_betId);
        require(results.length == 3, "Results not available or incomplete");
        
        // Get point values
        uint16[] memory pointValues = championship.getPointValues(_betId);
        require(pointValues.length == 3, "Point values not available or incomplete");
        
        // Store results
        actualResults[_betId] = results;
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
            
            // Calculate and award points
            uint256 points = calculatePoints(
                participant.bets[_betId].predictedPositions,
                results,
                pointValues
            );
            
            // Add points to participant's total
            participant.totalPoints += points;
            participant.betScored[_betId] = true;
            
            emit PointsAwarded(participantAddr, _betId, points);
        }
        
        emit ResultsProcessed(_betId, results);
        
        // If all selected betting opportunities have been scored, update leaderboard and distribute winnings
        if (scoredBettingOpportunities == params.selectedBetIds.length) {
            updateLeaderboard();
            distributeWinnings();
        }
    }
    
    /**
     * @notice Calculates points for a bet based on predicted vs actual positions
     * @param _predicted Predicted positions (competitor IDs)
     * @param _actual Actual positions (competitor IDs)
     * @param _pointValues Point values for each position
     * @return Points earned for the bet
     */
    function calculatePoints(
        uint16[] memory _predicted,
        uint16[] memory _actual,
        uint16[] memory _pointValues
    ) internal view returns (uint256) {
        uint256 totalPoints = 0;
        
        // Exact match points - highest value if competitor is in the exact position
        for (uint256 i = 0; i < _predicted.length; i++) {
            if (_predicted[i] == _actual[i]) {
                // Full points for exact position match
                uint256 exactMatchPoints = _pointValues[i] * EXACT_MATCH_MULTIPLIER / 100;
                totalPoints += exactMatchPoints;
            } else {
                // Check if competitor is in top 3 but wrong position
                for (uint256 j = 0; j < _actual.length; j++) {
                    if (_predicted[i] == _actual[j] && i != j) {
                        // Partial points for competitor in different position
                        uint256 positionMatchPoints = _pointValues[i] * POSITION_MATCH_MULTIPLIER / 100;
                        totalPoints += positionMatchPoints;
                        break;
                    }
                }
            }
        }
        
        // Apply bonus points percentage if configured
        if (params.bonusPointsPercentage > 0) {
            totalPoints = totalPoints + (totalPoints * params.bonusPointsPercentage / 100);
        }
        
        return totalPoints;
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
     * @notice Finalizes the tournament and distributes prizes
     * @dev Can only be called after all results have been processed
     */
    function distributeWinnings() internal {
        require(scoredBettingOpportunities == params.selectedBetIds.length, "Not all results processed");
        
        // Ensure leaderboard is updated
        if (leaderboard.participants.length == 0) {
            updateLeaderboard();
        }
        
        // Calculate prize amounts based on distribution
        uint256[] memory prizeAmounts = new uint256[](params.prizeDistribution.length);
        for (uint256 i = 0; i < params.prizeDistribution.length; i++) {
            prizeAmounts[i] = totalPrizePool * params.prizeDistribution[i] / 100;
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
        
        // Mark tournament as finalized
        leaderboard.finalized = true;
        leaderboard.finalizedTime = block.timestamp;
        active = false;
        
        emit TournamentEnded();
    }
    
    /**
     * @notice Publicly accessible function to finalize the tournament and distribute prizes
     * @dev Can only be called after all results have been processed
     */
    function distributeWinningsPublic() external onlyAdmin tournamentStarted notFinalized {
        distributeWinnings();
    }
    
    /**
     * @notice Gets the current leaderboard
     * @return addresses Array of participant addresses sorted by points
     * @return pointsArray Array of participant points
     * @return finalized Whether the tournament is finalized
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
    
    /**
     * @notice Gets the percentage of the prize pool for a specific rank
     * @param _rank Rank in the leaderboard (0-based index)
     * @return Percentage of the prize pool allocated to this rank
     */
    function getPrizePercentForRank(uint256 _rank) external view returns (uint256) {
        require(_rank < params.prizeDistribution.length, "Rank exceeds prize distribution length");
        return params.prizeDistribution[_rank];
    }

    /**
     * @notice Gets the results of a specific betting opportunity
     * @param _betId ID of the betting opportunity
     * @return results Array of competitor IDs in finishing positions
     * @return processed Whether the results have been processed
     */
    function getBettingResults(uint16 _betId) external view returns (
        uint16[] memory results,
        bool processed
    ) {
        processed = bettingOpportunityScored[_betId];
        if (processed) {
            results = actualResults[_betId];
        }
        
        return (results, processed);
    }
} 