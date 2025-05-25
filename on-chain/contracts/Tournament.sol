// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title Tournament
/// @notice Contract for managing sports tournaments with betting opportunities
contract Tournament {

    // Custom Errors
    error OnlyPlatformAdmin();
    error ZeroAddress();
    error BettingOpportunityDoesNotExist();
    error TournamentNotStarted();
    error CannotUpdateTimingAfterBettingStarted();
    error StartTimeMustBeGreaterThanZero();
    error StartTimeMustBeInFuture();
    error ResultsAlreadyFinalized();
    error EndTimeMustBeGreaterThanZero();
    error StartTimeMustBeSetBeforeResults();
    error EndTimeMustBeAfterStartTime();

    // Input struct for betting opportunities
    struct BettingOpportunityInput {
        uint16 id;
        string description;
        uint256 startTime; // Can be 0 if not yet known
        string[] options; // Options for the betting opportunity
    }

    struct BettingOpportunity {
        uint16 id;
        string description;
        uint256 startTime; // Can be 0 if not yet known
        string[] options; // Options for the betting opportunity
        euint16 optionsLength; // Encrypted length of options
        // Will be set when results are finalized
        uint256 endTime;
        bool resultsFinalized;
        uint16 result;
    }

    // State variables
    address public platformAdmin;
    string public description;
    uint256 public startTime;
    uint256 public endTime;
    
    mapping(uint16 => BettingOpportunity) public bettingOpportunities;
    uint16[] private bettingOpportunityIds;

    // Events
    event BettingOpportunityStartTimeUpdated(uint16 id, uint256 startTime);

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

    modifier bettingOpportunityExists(uint16 _betId) {
        if (bettingOpportunities[_betId].id != _betId) revert BettingOpportunityDoesNotExist();
        _;
    }

    modifier onlyAfterTournamentStart() {
        if (block.timestamp <= startTime) revert TournamentNotStarted();
        _;
    }

    modifier canUpdateStartTime(uint16 _betId) {
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        if (bet.startTime != 0 && block.timestamp >= bet.startTime - 60) revert CannotUpdateTimingAfterBettingStarted();
        _;
    }

    /**
     * @notice Creates a new tournament with predefined competitors and betting opportunities
     * @param _platformAdmin The address of the platform admin
     * @param _description Description of the tournament
     * @param _startTime Start time of the tournament (unix timestamp)
     * @param _endTime End time of the tournament (unix timestamp)
     * @param _bettingOpportunityInputs Array of betting opportunity inputs to add
     */
    constructor(
        address _platformAdmin,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        BettingOpportunityInput[] memory _bettingOpportunityInputs
    ) {
        // All validations are handled by the Factory
        platformAdmin = _platformAdmin;
        description = _description;
        startTime = _startTime;
        endTime = _endTime;
        
        // Create betting opportunity IDs array and store betting opportunity data
        for (uint i = 0; i < _bettingOpportunityInputs.length; i++) {
            BettingOpportunityInput memory input = _bettingOpportunityInputs[i];
            
            euint16 _optionsLength = FHE.asEuint16(uint16(input.options.length));
            FHE.allowGlobal(_optionsLength);
            // Create full betting opportunity with default values for restricted fields
            BettingOpportunity memory bet = BettingOpportunity({
                id: input.id,
                description: input.description,
                startTime: input.startTime,
                options: input.options,
                optionsLength: _optionsLength,
                endTime: 0,  // Initialize to 0
                resultsFinalized: false,  // Initialize to false
                result: 0
            });
            
            bettingOpportunities[bet.id] = bet;
            bettingOpportunityIds.push(bet.id);
        }
    }

    /**
     * @notice Updates the start time for a betting opportunity
     * @dev Can only be called by admin and only if betting hasn't started yet
     * @param _betId The ID of the betting opportunity to update
     * @param _startTime The new start time (unix timestamp)
     */
    function updateBettingOpportunityStartTime(
        uint16 _betId,
        uint256 _startTime
    ) external onlyPlatformAdmin bettingOpportunityExists(_betId) canUpdateStartTime(_betId) {
        if (_startTime == 0) revert StartTimeMustBeGreaterThanZero();
        if (_startTime <= block.timestamp) revert StartTimeMustBeInFuture();
        
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        bet.startTime = _startTime;
        
        emit BettingOpportunityStartTimeUpdated(_betId, _startTime);
    }

    /**
     * @notice Sets the results for a betting opportunity and finalizes it
     * @dev Can only be called by admin and only once per betting opportunity
     * @param _betId The ID of the betting opportunity to set results for
     * @param _result The result of the betting opportunity
     * @param _endTime The time when the results were finalized (unix timestamp)
     */
    function setResults(
        uint16 _betId,
        uint16 _result,
        uint256 _endTime
    ) external onlyPlatformAdmin onlyAfterTournamentStart bettingOpportunityExists(_betId) {
        if (bettingOpportunities[_betId].resultsFinalized) revert ResultsAlreadyFinalized();
        if (_endTime == 0) revert EndTimeMustBeGreaterThanZero();
        
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        if (bet.startTime == 0) revert StartTimeMustBeSetBeforeResults();
        if (_endTime < bet.startTime) revert EndTimeMustBeAfterStartTime();
        
        // Store results directly
        bet.result = _result;
        bet.endTime = _endTime;
        bet.resultsFinalized = true;
    }

    /**
     * @notice Retrieves the results for a betting opportunity
     * @param _betId The ID of the betting opportunity to get results for
     * @return The result of the betting opportunity
     */
    function getResults(uint16 _betId) external view bettingOpportunityExists(_betId) returns (uint16) {
        return bettingOpportunities[_betId].result;
    }

    /**
     * @notice Retrieves the options for a betting opportunity
     * @param _betId The ID of the betting opportunity
     * @return Array of options for the betting opportunity
     */
    function getOptions(uint16 _betId) external view bettingOpportunityExists(_betId) returns (string[] memory) {
        return bettingOpportunities[_betId].options;
    }

    function getOptionsLength(uint16 _betId) external view bettingOpportunityExists(_betId) returns (euint16) {
        return bettingOpportunities[_betId].optionsLength;
    }

    function getBettingOpportunitiesCount() external view returns (uint16) {
        return uint16(bettingOpportunityIds.length);
    }

    function getBettingOpportunities() external view returns (BettingOpportunity[] memory) {
        BettingOpportunity[] memory bettingOpportunitiesArray = new BettingOpportunity[](bettingOpportunityIds.length);
        for (uint i = 0; i < bettingOpportunityIds.length; i++) {
            bettingOpportunitiesArray[i] = bettingOpportunities[bettingOpportunityIds[i]];
        }
        return bettingOpportunitiesArray;
    }

    /**
     * @notice Checks if betting is currently allowed for a specific betting opportunity
     * @param _betId The ID of the betting opportunity to check
     * @return Boolean indicating if the betting window is open
     */
    function isBettingWindowOpen(uint16 _betId, uint32 _closingWindowInSeconds) 
        external 
        view 
        bettingOpportunityExists(_betId) 
        returns (bool) 
    {
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        if (bet.startTime == 0) {
            return false;
        }
        if (bet.resultsFinalized) {
            return false;
        }
        // Betting is open if current time is before (startTime - closingWindow)
        if (block.timestamp < bet.startTime - _closingWindowInSeconds) {
            return true;
        }
        return false;
    }
} 