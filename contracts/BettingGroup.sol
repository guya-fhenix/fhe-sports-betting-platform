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
    struct Participant {
        address addr;
        string name;
        bool hasRegistered;
        uint256 totalPoints;
        mapping(uint16 => Bet) bets; // betId => Bet
    }

    struct Bet {
        bool placed;
        uint16 predictedOption; // The predicted option for the bet
        bool isScored;
        uint256 pointsAwarded;
    }

    struct Leaderboard {
        address[] participants; // Sorted by points (highest first)
        bool finalized;
        uint256 finalizedTime;
    }

    // Constants
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 5; // 0.5% to platform
    uint256 public constant WINNER_DISTRIBUTION_PERCENTAGE = 995; // 99.5% to winners
    uint256 public constant MINIMUM_PARTICIPANTS = 10;
    
    // Admins
    address public platformAdmin;

    // Contracts Addresses
    address public tournamentContract;
    address public factoryContract;

    // Tournament Parameters
    string public description;
    uint256 public entryFee;
    uint256[] public prizeDistribution;
    uint32 public generalClosingWindowInSeconds;
    bool public active;
    
    // Participants
    mapping(address => Participant) public participants;
    address[] public participantAddresses;
    uint256 public participantCount;
    uint256 public totalPrizePool;
    
    // Results and ranking tracking
    Leaderboard public leaderboard;
    mapping(uint16 => bool) public bettingOpportunityScored;
    mapping(uint16 => uint16) public actualResults; // betId => actual result
    uint16 public scoredBettingOpportunities;
    mapping(address => uint256) public claimableBalance;
    
    // Events
    event ParticipantRegistered(address indexed participant, string name);
    event ParticipantWithdrawn(address indexed participant);
    event BetPlaced(address indexed participant, uint16 betId, uint16 predictedOption);
    event BettingGroupFinalized();
    event BettingGroupCancelled();
    event ResultsProcessed(uint16 betId, uint16 result);
    event LeaderboardSet();
    event RefundClaimed(address indexed participant, uint256 amount);

    // Modifiers
    modifier onlyPlatformAdmin() {
        require(msg.sender == platformAdmin, "Only platform admin can perform this action");
        _;
    }

    /**
     * @notice Sets a new platform admin
     * @param _newAdmin New admin address
     */
    function setPlatformAdmin(address _newAdmin) external onlyPlatformAdmin {
        require(_newAdmin != address(0), "New admin cannot be zero address");
        platformAdmin = _newAdmin;
    }
    
    /**
     * @notice Gets the platform admin address
     * @return Address of the platform admin
     */
    function getPlatformAdmin() external view returns (address) {
        return platformAdmin;
    }

    modifier onlyRegisteredParticipant() {
        require(participants[msg.sender].hasRegistered, "Only registered participants can perform this action");
        _;
    }

    modifier bettingGroupActive() {
        require(active, "Betting group is not active");
        _;
    }

    modifier onlyAfterTournamentEnd() {
        // Registration is open until tournament ends
        Tournament tournament = Tournament(tournamentContract);
        require(
            block.timestamp > tournament.endTime(),
            "Tournament has not ended"
        );   
        _;
    }

    modifier onlyBeforeTournamentEnd() {
        // Registration is open until tournament ends
        Tournament tournament = Tournament(tournamentContract);
        require(
            block.timestamp < tournament.endTime(),
            "Tournament has ended"
        );   
        _;
    }

    modifier onlyBeforeTournamentStart() {
        // Unregistration is only open until tournament starts
        Tournament tournament = Tournament(tournamentContract);
        require(
            block.timestamp < tournament.startTime(),
            "Tournament has started"
        );
        _;
    }

    /**
     * @notice Creates a new betting group for a tournament
     * @param _platformAdmin Address of the platform admin
     * @param _description Description of the betting group
     * @param _tournamentContract Address of the tournament contract
     * @param _entryFee Entry fee in wei
     * @param _prizeDistribution Array of percentages for prize distribution
     * @param _generalClosingWindowInSeconds Time in seconds before tournament start when betting closes
     */
    constructor(
        address _platformAdmin,
        string memory _description,
        address _tournamentContract,
        uint256 _entryFee,
        uint256[] memory _prizeDistribution,
        uint32 _generalClosingWindowInSeconds
    ) {
        // All validations are now handled by the factory
        platformAdmin = _platformAdmin;
        factoryContract = msg.sender; // The factory is the deployer
        tournamentContract = _tournamentContract;
        description = _description;
        entryFee = _entryFee;
        prizeDistribution = _prizeDistribution;
        generalClosingWindowInSeconds = _generalClosingWindowInSeconds;
        active = true;
        totalPrizePool = 0;
        participantCount = 0;
        scoredBettingOpportunities = 0;
        
        // Initialize leaderboard
        leaderboard.finalized = false;
        leaderboard.finalizedTime = 0;
    }

    /**
     * @notice Allows a participant to register for the betting group by paying the entry fee
     * @param _name Name of the participant
     */
    function register(string memory _name) external payable onlyBeforeTournamentEnd bettingGroupActive {
        require(!participants[msg.sender].hasRegistered, "Already registered");
        require(msg.value == entryFee, "Incorrect entry fee");
        // Ensure name is unique among registered participants
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address addr = participantAddresses[i];
            if (participants[addr].hasRegistered && keccak256(bytes(participants[addr].name)) == keccak256(bytes(_name))) {
                revert("Name already taken");
            }
        }
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
     * @notice Allows a participant to withdraw from the betting group before tournament starts
     * @dev Only available before tournament start time
     */
    function withdrawFromBettingGroup() 
        external 
        onlyRegisteredParticipant 
        onlyBeforeTournamentStart 
        bettingGroupActive
    {
        // Process withdrawal
        address payable participantAddress = payable(msg.sender);
        uint256 refundAmount = entryFee;
        // Update betting group state
        Participant storage participant = participants[msg.sender];
        participant.hasRegistered = false;
        participantCount--;
        totalPrizePool -= refundAmount;
        // Transfer the entry fee back to the participant
        participantAddress.transfer(refundAmount);
        emit ParticipantWithdrawn(msg.sender);
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
        require(tournament.isBettingWindowOpen(_betId, generalClosingWindowInSeconds), "Betting window is closed");
        // Get available options for this bet
        uint16[] memory options = tournament.getOptions(_betId);
        require(_predictedOption < options.length, "Invalid option selected");
        Participant storage participant = participants[msg.sender];
        // Allow unlimited bets: just update the bet for this betId
        participant.bets[_betId].placed = true;
        participant.bets[_betId].predictedOption = _predictedOption;
        emit BetPlaced(msg.sender, _betId, _predictedOption);
    }

    /**
     * @notice Cancels the betting group and returns entry fees
     */
    function cancelBettingGroup() external bettingGroupActive onlyRegisteredParticipant {
        Tournament tournament = Tournament(tournamentContract);
        require(block.timestamp >= tournament.startTime(), "Tournament has not started");
        require(participantCount < MINIMUM_PARTICIPANTS, "Minimum participants met");
        active = false;
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participant = participantAddresses[i];
            if (participants[participant].hasRegistered) {
                claimableBalance[participant] += entryFee;
            }
        }
        emit BettingGroupCancelled();
    }

    /**
     * @notice Gets a participant's bet for a specific betting opportunity
     * @param _participant Address of the participant
     * @param _betId ID of the betting opportunity
     * @return predictedOption The predicted option for the bet
     */
    function getParticipantBet(address _participant, uint16 _betId) 
        external 
        view 
        returns (uint16)
    {
        require(participants[_participant].bets[_betId].placed, "Bet not placed");
        return participants[_participant].bets[_betId].predictedOption;
    }

    /**
     * @notice Gets whether a participant has placed a bet for a specific betting opportunity
     * @param _participant Address of the participant
     * @param _betId ID of the betting opportunity
     * @return true if the participant has placed a bet for the given betId, otherwise false
     */
    function getParticipantHasBet(address _participant, uint16 _betId)
        external
        view
        returns (bool)
    {
        return participants[_participant].bets[_betId].placed;
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
    function processResults(uint16 _betId) external onlyPlatformAdmin bettingGroupActive
    {
        require(participantCount >= MINIMUM_PARTICIPANTS, "Not enough participants");
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
            if (!participant.bets[_betId].placed) {
                continue;
            }
            
            // Get predicted option for this bet
            uint16 predictedOption = participant.bets[_betId].predictedOption;
            
            // Calculate points for this bet
            uint256 points = calculatePoints(predictedOption, result);

            // Add points to participant
            if (points > 0) {
                participant.bets[_betId].isScored = true;
                participant.bets[_betId].pointsAwarded = points;
                participant.totalPoints += points;
            } else {
                participant.bets[_betId].isScored = false;
            }
        }
        
        emit ResultsProcessed(_betId, result);
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
    ) internal pure returns (uint256) {
        if (_predicted == _actual) {
            return 1;
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
        
        emit LeaderboardSet();
    }

    // External function for platform admin to finalize and distribute claimable balances
    function finalizeAndDistribute() external onlyPlatformAdmin bettingGroupActive {
        require(participantCount >= MINIMUM_PARTICIPANTS, "Not enough participants");
        // Check if all betting opportunities have been scored
        require(scoredBettingOpportunities == prizeDistribution.length, "Not all results processed");

        // Check if tournament has ended
        Tournament tournament = Tournament(tournamentContract);
        require(block.timestamp > tournament.endTime(), "Tournament has not ended");

        // Update leaderboard
        updateLeaderboard();

        // Calculate platform fee
        uint256 platformFee = totalPrizePool * PLATFORM_FEE_PERCENTAGE / 1000;
        claimableBalance[factoryContract] += platformFee;

        // Calculate prize amounts
        uint256 winnerPool = totalPrizePool * WINNER_DISTRIBUTION_PERCENTAGE / 1000;
        uint256[] memory prizeAmounts = new uint256[](prizeDistribution.length);
        for (uint256 i = 0; i < prizeDistribution.length; i++) {
            prizeAmounts[i] = winnerPool * prizeDistribution[i] / 995;
        }

        uint256 prizePositions = prizeDistribution.length;
        if (leaderboard.participants.length < prizePositions) {
            prizePositions = leaderboard.participants.length;
        }
        for (uint256 i = 0; i < prizePositions; i++) {
            address winner = leaderboard.participants[i];
            uint256 prize = prizeAmounts[i];
            claimableBalance[winner] += prize;
        }

        leaderboard.finalized = true;
        leaderboard.finalizedTime = block.timestamp;
        active = false;
        emit BettingGroupFinalized();
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
        
        return (addresses, pointsArray, leaderboard.finalized);
    }

    function claim() external {
        require(!active, "Betting group is still active");
        uint256 amount = claimableBalance[msg.sender];
        require(amount > 0, "No balance to claim");
        claimableBalance[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
        emit RefundClaimed(msg.sender, amount);
    }
} 