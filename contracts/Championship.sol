// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

/// @title Championship
/// @notice Contract for managing motorsports championships with betting opportunities
contract Championship {
    // Structs
    struct Competitor {
        uint16 id;
        string name;
    }

    // Input struct for betting opportunities
    struct BettingOpportunityInput {
        uint16 id;
        string description;
        uint256 startTime; // Can be 0 if not yet known
        uint256[] pointValues; // Points for 1st, 2nd, 3rd positions
    }

    struct BettingOpportunity {
        uint16 id;
        string description;
        uint256 startTime; // Can be 0 if not yet known
        uint256 endTime;   // Will be set when results are finalized
        bool resultsFinalized;
        uint256[] pointValues; // Points for 1st, 2nd, 3rd positions
        uint16[] topPositions; // IDs of competitors in 1st, 2nd, 3rd positions
    }

    // State variables
    address public admin;
    string public description;
    uint256 public startDate;
    uint256 public endDate;
    bool public active;

    // Storage
    mapping(uint16 => Competitor) public competitors;
    uint16[] public competitorIds;
    
    mapping(uint16 => BettingOpportunity) public bettingOpportunities;
    uint16[] public bettingOpportunityIds;

    // Events
    event BettingOpportunityStartTimeUpdated(uint16 id, uint256 startTime);
    event ResultsUpdated(uint16 bettingOpportunityId, uint16[] topPositions, uint256 endTime);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier bettingOpportunityExists(uint16 _betId) {
        require(bettingOpportunities[_betId].id == _betId, "Betting opportunity does not exist");
        _;
    }

    modifier canUpdateStartTime(uint16 _betId) {
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        require(
            bet.startTime == 0 || 
            (bet.startTime > 0 && block.timestamp < bet.startTime), 
            "Cannot update timing after betting has started"
        );
        _;
    }

    /**
     * @notice Creates a new championship with predefined competitors and betting opportunities
     * @param _admin The address of the championship administrator
     * @param _description Description of the championship
     * @param _startDate Start date of the championship (unix timestamp)
     * @param _endDate End date of the championship (unix timestamp)
     * @param _competitors Array of competitors to add
     * @param _bettingOpportunityInputs Array of betting opportunity inputs to add
     */
    constructor(
        address _admin,
        string memory _description,
        uint256 _startDate,
        uint256 _endDate,
        Competitor[] memory _competitors,
        BettingOpportunityInput[] memory _bettingOpportunityInputs
    ) {
        // All validations are handled by the Factory
        
        admin = _admin;
        description = _description;
        startDate = _startDate;
        endDate = _endDate;
        active = true;
        
        // Create competitor IDs array and store competitor data
        competitorIds = new uint16[](_competitors.length);
        for (uint i = 0; i < _competitors.length; i++) {
            Competitor memory competitor = _competitors[i];
            competitors[competitor.id] = competitor;
            competitorIds[i] = competitor.id;
        }
        
        // Create betting opportunity IDs array and store betting opportunity data
        bettingOpportunityIds = new uint16[](_bettingOpportunityInputs.length);
        for (uint i = 0; i < _bettingOpportunityInputs.length; i++) {
            BettingOpportunityInput memory input = _bettingOpportunityInputs[i];
            
            // Create full betting opportunity with default values for restricted fields
            BettingOpportunity memory bet = BettingOpportunity({
                id: input.id,
                description: input.description,
                startTime: input.startTime,
                endTime: 0,  // Initialize to 0
                resultsFinalized: false,  // Initialize to false
                pointValues: input.pointValues,
                topPositions: new uint16[](0)  // Initialize as empty array
            });
            
            bettingOpportunities[bet.id] = bet;
            bettingOpportunityIds[i] = bet.id;
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
    ) external onlyAdmin bettingOpportunityExists(_betId) canUpdateStartTime(_betId) {
        require(_startTime > 0, "Start time must be greater than 0");
        
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        bet.startTime = _startTime;
        
        emit BettingOpportunityStartTimeUpdated(_betId, _startTime);
    }

    /**
     * @notice Sets the results for a betting opportunity and finalizes it
     * @dev Can only be called by admin and only once per betting opportunity
     * @param _betId The ID of the betting opportunity to set results for
     * @param _topPositions Array of competitor IDs in positions 1st, 2nd, and 3rd
     * @param _endTime The time when the results were finalized (unix timestamp)
     */
    function setResults(
        uint16 _betId,
        uint16[] memory _topPositions,
        uint256 _endTime
    ) external onlyAdmin bettingOpportunityExists(_betId) {
        require(_topPositions.length == 3, "Must provide exactly top 3 positions");
        require(!bettingOpportunities[_betId].resultsFinalized, "Results already finalized");
        require(_endTime > 0, "End time must be greater than 0");
        
        BettingOpportunity storage bet = bettingOpportunities[_betId];
        require(bet.startTime > 0, "Start time must be set before setting results");
        require(_endTime >= bet.startTime, "End time must be after start time");
        
        // Verify all competitors exist
        for (uint256 i = 0; i < _topPositions.length; i++) {
            require(competitors[_topPositions[i]].id == _topPositions[i], "Competitor does not exist");
        }
        
        // Store results directly
        bet.topPositions = _topPositions;
        bet.endTime = _endTime;
        bet.resultsFinalized = true;
        
        emit ResultsUpdated(_betId, _topPositions, _endTime);
    }

    /**
     * @notice Retrieves the results for a betting opportunity
     * @param _betId The ID of the betting opportunity to get results for
     * @return Array of competitor IDs in finishing positions 1st, 2nd, and 3rd
     */
    function getResults(uint16 _betId) external view bettingOpportunityExists(_betId) returns (uint16[] memory) {
        return bettingOpportunities[_betId].topPositions;
    }

    /**
     * @notice Retrieves the point values assigned to positions in a betting opportunity
     * @param _betId The ID of the betting opportunity
     * @return Array of point values for 1st, 2nd, and 3rd positions
     */
    function getPointValues(uint16 _betId) external view bettingOpportunityExists(_betId) returns (uint256[] memory) {
        return bettingOpportunities[_betId].pointValues;
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
        
        // If start time is not set (0), window is not open
        if (bet.startTime == 0) {
            return false;
        }
        
        // If results are finalized, window is not open
        if (bet.resultsFinalized) {
            return false;
        }
        
        // If current time is before start time, window is not open
        if (block.timestamp < bet.startTime - _closingWindowInSeconds) {
            return false;
        }
        
        return true;
    }

    /**
     * @notice Returns the list of all competitor IDs in the championship
     * @return Array of competitor IDs
     */
    function getCompetitors() external view returns (uint16[] memory) {
        return competitorIds;
    }

    /**
     * @notice Returns the list of all betting opportunity IDs in the championship
     * @return Array of betting opportunity IDs
     */
    function getBettingOpportunities() external view returns (uint16[] memory) {
        return bettingOpportunityIds;
    }
} 