// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";
import "./Tournament.sol";
import { InEuint16, InEuint32, InEuint256 } from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";
import "hardhat/console.sol";

/**
 * @title BettingGroup
 * @notice Contract for managing betting groups for sports tournaments
 * @dev This is a base implementation without FHE for betting logic
 */
contract BettingGroup {

    // Custom Errors
    error OnlyPlatformAdmin();
    error ZeroAddress();
    error OnlyRegisteredParticipants();
    error BettingGroupNotActive();
    error TournamentNotEnded();
    error TournamentEnded();
    error TournamentStarted();
    error AlreadyRegistered();
    error IncorrectEntryFee();
    error NameAlreadyTaken();
    error BettingWindowClosed();
    error TournamentNotStarted();
    error MinimumParticipantsMet();
    error ParticipantNotRegistered();
    error NotEnoughParticipants();
    error ResultsAlreadyProcessed();
    error DecryptionNotRequested();
    error DecryptionNotReady();

    // Structs
    struct Participant {
        address addr;
        string name;
        bool hasRegistered;
        euint256 totalPoints; // Encrypted total points
        mapping(uint16 => Bet) bets; // betId => Bet
    }

    struct Bet {
        bool placed;
        euint16 predictedOption; // Encrypted predicted option
        euint256 pointsAwarded; // Encrypted points
    }

    // Simplified struct for returning bet data
    struct BetInfo {
        bool placed;
        bool scored;
        uint16 result; // Only valid if scored is true
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

    // FHE Constants
    euint256 public ZERO;
    euint16 public INVALID_PREDICTION;
    
    // Finalization and decryption state
    bool public decryptionRequested;
    
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
    mapping(address => uint256) public decryptedPoints;
    
    // Events
    event ParticipantRegistered(address indexed participant, string name);
    event ParticipantWithdrawn(address indexed participant);
    event BetPlaced(address indexed participant, uint16 betId);
    event BettingGroupFinalized();
    event BettingGroupCancelled();
    event ResultsProcessed(uint16 betId, uint16 result);
    event LeaderboardSet();
    event RefundClaimed(address indexed participant, uint256 amount);

    // Modifiers
    modifier onlyPlatformAdmin() {
        if (msg.sender != platformAdmin) revert OnlyPlatformAdmin();
        _;
    }

    /**
     * @notice Sets a new platform admin
     * @param _newAdmin New admin address
     */
    function setPlatformAdmin(address _newAdmin) external onlyPlatformAdmin {
        if (_newAdmin == address(0)) revert ZeroAddress();
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
        if (!participants[msg.sender].hasRegistered) revert OnlyRegisteredParticipants();
        _;
    }

    modifier bettingGroupActive() {
        if (!active) revert BettingGroupNotActive();
        _;
    }

    modifier onlyAfterTournamentEnd() {
        // Registration is open until tournament ends
        Tournament tournament = Tournament(tournamentContract);
        if (block.timestamp <= tournament.endTime()) revert TournamentNotEnded();
        _;
    }

    modifier onlyBeforeTournamentEnd() {
        // Registration is open until tournament ends
        Tournament tournament = Tournament(tournamentContract);
        if (block.timestamp >= tournament.endTime()) revert TournamentEnded();
        _;
    }

    modifier onlyBeforeTournamentStart() {
        // Unregistration is only open until tournament starts
        Tournament tournament = Tournament(tournamentContract);
        if (block.timestamp >= tournament.startTime()) revert TournamentStarted();
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
        decryptionRequested = false;

        // Initialize FHE constants
        ZERO = FHE.asEuint256(0);
        INVALID_PREDICTION = FHE.asEuint16(type(uint16).max);
        FHE.allowThis(ZERO);
        FHE.allowThis(INVALID_PREDICTION);    
    }

    /**
     * @notice Checks if a participant is registered
     * @param _participant Address to check
     * @return true if the participant is registered, otherwise false
     */
    function isRegistered(address _participant) external view returns (bool) {
        return participants[_participant].hasRegistered;
    }

    /**
     * @notice Allows a participant to register for the betting group by paying the entry fee
     * @param _name Name of the participant
     */
    function register(string memory _name) 
        external 
        payable 
        bettingGroupActive 
        onlyBeforeTournamentEnd 
    {
        if (participants[msg.sender].hasRegistered) revert AlreadyRegistered();
        if (msg.value != entryFee) revert IncorrectEntryFee();
        
        // Ensure name is unique among registered participants
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address addr = participantAddresses[i];
            if (participants[addr].hasRegistered && keccak256(bytes(participants[addr].name)) == keccak256(bytes(_name))) {
                revert NameAlreadyTaken();
            }
        }
        
        Participant storage participant = participants[msg.sender];
        participant.addr = msg.sender;
        participant.name = _name;
        participant.hasRegistered = true;
        participant.totalPoints = ZERO;
        
        // Check if address is already in participantAddresses (for users who withdrew and registered again)
        bool addressFound = false;
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            if (participantAddresses[i] == msg.sender) {
                addressFound = true;
                break;
            }
        }
        
        // Only add to array if not already there
        if (!addressFound) {
            participantAddresses.push(msg.sender);
        }
        
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
        
        // First, clean all bet data
        Tournament tournament = Tournament(tournamentContract);
        uint16 opportunityCount = tournament.getBettingOpportunitiesCount();
        for (uint16 i = 0; i < opportunityCount; i++) {
            if (participant.bets[i].placed) {
                // Reset the bet data
                participant.bets[i].placed = false;
            }
        }
        
        // Reset participant data
        participant.hasRegistered = false;
        participant.totalPoints = ZERO;
        participantCount--;
        totalPrizePool -= refundAmount;
        
        // Transfer the entry fee back to the participant
        participantAddress.transfer(refundAmount);
        emit ParticipantWithdrawn(msg.sender);
    }

    /**
     * @notice Allows a registered participant to place a bet on a betting opportunity
     * @param _betId ID of the betting opportunity
     * @param _encryptedPredictedOption Encrypted predicted option for the bet (as InEuint16)
     */
    function placeBet(uint16 _betId, InEuint16 calldata _encryptedPredictedOption) 
        external 
        onlyRegisteredParticipant 
        bettingGroupActive
    {
        Tournament tournament = Tournament(tournamentContract);
        if (!tournament.isBettingWindowOpen(_betId, generalClosingWindowInSeconds)) revert BettingWindowClosed();

        // Get encrypted options length from Tournament
        euint16 optionsLength = tournament.getOptionsLength(_betId);

        Participant storage participant = participants[msg.sender];
        participant.bets[_betId].placed = true;

        // Convert user input to euint16
        euint16 encryptedPredictedOption = FHE.asEuint16(_encryptedPredictedOption);
        
        // FHE conditional: if valid, store the bet; else, store INVALID_PREDICTION
        ebool isValid = FHE.lt(encryptedPredictedOption, optionsLength);
        participant.bets[_betId].predictedOption = FHE.select(isValid, encryptedPredictedOption, INVALID_PREDICTION);

        FHE.allowThis(participant.bets[_betId].predictedOption);
        FHE.allowSender(participant.bets[_betId].predictedOption);

        emit BetPlaced(msg.sender, _betId);
    }

    /**
     * @notice Cancels the betting group and returns entry fees
     */
    function cancelBettingGroup() external bettingGroupActive onlyRegisteredParticipant {
        Tournament tournament = Tournament(tournamentContract);
        if (block.timestamp < tournament.startTime()) revert TournamentNotStarted();
        if (participantCount >= MINIMUM_PARTICIPANTS) revert MinimumParticipantsMet();
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
     * @notice Checks if the betting group is active
     * @return true if the betting group is active, otherwise false
     */
    function isActive() external view returns (bool) {
        return active;
    }

    /**
     * @notice Gets all betting information for a specific participant
     * @param _participant Address of the participant to get bets for
     * @return betIds Array of bet IDs that the participant has placed
     * @return betsInfo Array of bet information for placed bets
     */
    function getParticipantBets(address _participant)
        external
        view
        returns (
            uint16[] memory betIds,
            Bet[] memory betsInfo
        )
    {
        console.log("=== GET PARTICIPANT BETS ===");
        console.log("Caller address:", msg.sender);
        console.log("Participant address:", _participant);
        console.log("Is registered:", participants[_participant].hasRegistered);
        
        if (!participants[_participant].hasRegistered) revert ParticipantNotRegistered();
        
        // Get the number of betting opportunities from the tournament
        Tournament tournament = Tournament(tournamentContract);
        uint16 opportunityCount = tournament.getBettingOpportunitiesCount();
        
        console.log("Total betting opportunities:", opportunityCount);
        
        // First, count how many bets this participant has placed
        uint16 placedCount = 0;
        for (uint16 i = 0; i < opportunityCount; i++) {
            if (participants[_participant].bets[i].placed) {
                placedCount++;
                console.log("Found bet for opportunity:", i);
            }
        }
        
        console.log("Total bets placed by participant:", placedCount);
        
        // Initialize arrays with the size of placed bets only
        betIds = new uint16[](placedCount);
        betsInfo = new Bet[](placedCount);
        
        // Fill arrays only with placed bets
        uint16 index = 0;
        for (uint16 i = 0; i < opportunityCount; i++) {
            if (participants[_participant].bets[i].placed) {
                betIds[index] = i;
                betsInfo[index] = participants[_participant].bets[i];
                index++;
            }
        }
        
        return (betIds, betsInfo);
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
     * @return encryptedTotalPoints Encrypted total points earned by the participant
     */
    function getParticipantTotalPoints(address _participant) external view returns (euint256) {
        if (!participants[_participant].hasRegistered) revert ParticipantNotRegistered();
        return participants[_participant].totalPoints;
    }

    /**
     * @notice Processes results for a betting opportunity from the tournament
     * @dev Fetches results from the tournament contract and scores all bets
     * @param _betId ID of the betting opportunity to process
     */
    function processResults(uint16 _betId) external onlyPlatformAdmin bettingGroupActive
    {
        if (participantCount < MINIMUM_PARTICIPANTS) revert NotEnoughParticipants();
        if (bettingOpportunityScored[_betId]) revert ResultsAlreadyProcessed();
        Tournament tournament = Tournament(tournamentContract);
        uint16 result = tournament.getResults(_betId);
        actualResults[_betId] = result;
        bettingOpportunityScored[_betId] = true;
        scoredBettingOpportunities++;
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participantAddr = participantAddresses[i];
            Participant storage participant = participants[participantAddr];
            if (!participant.bets[_betId].placed) {
                continue;
            }
            euint256 points = calculatePoints(participant.bets[_betId].predictedOption, result);
            participant.bets[_betId].pointsAwarded = points;
            participant.totalPoints = FHE.add(participant.totalPoints, points);
            FHE.allowThis(participant.totalPoints);
            FHE.allowSender(participant.totalPoints);
        }
        emit ResultsProcessed(_betId, result);
    }
    
    /**
     * @notice Calculates points for a bet based on predicted vs actual result
     * @param _encryptedPredicted Encrypted predicted option
     * @param _actual Actual result
     * @return Encrypted points earned for the bet
     */
    function calculatePoints(
        euint16 _encryptedPredicted,
        uint16 _actual
    ) internal returns (euint256) {
        // Convert uint16 actual result to euint16 for comparison (same bit width)
        euint16 encryptedActual = FHE.asEuint16(_actual);
        ebool isCorrect = FHE.eq(_encryptedPredicted, encryptedActual);
        // Return euint256(1) or euint256(0) as encrypted points (same bit width)
        return FHE.select(isCorrect, FHE.asEuint256(1), FHE.asEuint256(0));
    }
    
    /**
     * @notice Updates the leaderboard based on participant points
     * @dev Sorts participants by total points (highest first)
     */
    function updateLeaderboard() internal {
        uint256 n = participantAddresses.length;
        address[] memory sortedParticipants = new address[](n);

        // Copy addresses
        for (uint256 i = 0; i < n; i++) {
            sortedParticipants[i] = participantAddresses[i];
        }

        // Standard bubble sort using decryptedPoints
        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = 0; j < n - 1; j++) {
                address addrA = sortedParticipants[j];
                address addrB = sortedParticipants[j + 1];
                uint256 pointsA = decryptedPoints[addrA];
                uint256 pointsB = decryptedPoints[addrB];
                if (pointsB > pointsA) {
                    // Swap
                    address temp = sortedParticipants[j];
                    sortedParticipants[j] = sortedParticipants[j + 1];
                    sortedParticipants[j + 1] = temp;
                }
            }
        }

        leaderboard.participants = sortedParticipants;
        leaderboard.finalized = true;
        leaderboard.finalizedTime = block.timestamp;
        emit LeaderboardSet();
    }

    // Check if decryption has been requested
    function isDecryptionRequested() public view returns (bool) {
        return decryptionRequested;
    }

    // Stage 1: Request decryption of all participant points
    function requestPointsDecryption() external onlyPlatformAdmin bettingGroupActive {
        require(participantCount >= MINIMUM_PARTICIPANTS, "Not enough participants");
        require(scoredBettingOpportunities == prizeDistribution.length, "Not all results processed");
        Tournament tournament = Tournament(tournamentContract);
        require(block.timestamp > tournament.endTime(), "Tournament has not ended");

        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participantAddr = participantAddresses[i];
            FHE.decrypt(participants[participantAddr].totalPoints);
        }
        decryptionRequested = true;
    }

    // Stage 2: Finalize and distribute after decryption is ready
    function finalizeAndDistribute() external onlyPlatformAdmin bettingGroupActive {
        require(participantCount >= MINIMUM_PARTICIPANTS, "Not enough participants");
        require(decryptionRequested, "Decryption not requested");
        require(active, "Already finalized");

        // Check all points are decrypted and collect them
        for (uint256 i = 0; i < participantAddresses.length; i++) {
            address participantAddr = participantAddresses[i];
            (uint256 points, bool ready) = FHE.getDecryptResultSafe(participants[participantAddr].totalPoints);
            require(ready, "Decryption not ready for all participants");
            decryptedPoints[participantAddr] = points;
        }

        // Sort participants by decryptedPoints (descending)
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

        active = false;
        emit BettingGroupFinalized();
    }

    function getLeaderboard() external view returns (
        address[] memory addresses,
        uint256[] memory pointsArray
    ) {
        require(leaderboard.finalized, "Leaderboard not finalized yet");

        addresses = leaderboard.participants;
        pointsArray = new uint256[](addresses.length);
        for (uint256 i = 0; i < addresses.length; i++) {
            pointsArray[i] = decryptedPoints[addresses[i]];
        }
        return (addresses, pointsArray);
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