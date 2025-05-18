// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "./Tournament.sol";
import "./Championship.sol";

/**
 * @title Factory
 * @notice Factory contract for creating championships and tournaments
 * @dev Handles validation, deployment and tracking of championships and tournaments
 */
contract Factory {

    // Events
    event ChampionshipCreated(
        address indexed championshipAddress,
        string description,
        uint256 startDate,
        uint256 endDate
    );
    
    event TournamentCreated(
        address indexed tournamentAddress,
        address indexed championshipContract,
        string description,
        uint256 registrationEndTime
    );
    
    // State variables
    mapping(address => bool) public createdChampionships;
    address[] public allChampionships;
    
    mapping(address => bool) public createdTournaments;
    address[] public allTournaments;
    
    address public platformAdmin;
    
    // Constructor
    constructor() {
        platformAdmin = msg.sender;
    }
    
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
     * @notice Creates a new championship
     * @param _description Description of the championship
     * @param _startDate Start date of the championship (unix timestamp)
     * @param _endDate End date of the championship (unix timestamp)
     * @param _competitors Array of competitors participating in the championship
     * @param _bettingOpportunities Array of betting opportunities within the championship
     * @return address Address of the newly created championship
     */
    function createChampionship(
        string memory _description,
        uint256 _startDate,
        uint256 _endDate,
        Championship.Competitor[] memory _competitors,
        Championship.BettingOpportunityInput[] memory _bettingOpportunities
    ) external onlyPlatformAdmin returns (address) {
        // Parameter validation
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_startDate < _endDate, "End date must be after start date");
        require(_competitors.length > 0, "Must have at least one competitor");
        require(_bettingOpportunities.length > 0, "Must have at least one betting opportunity");
        
        // Validate competitors - check for duplicate IDs
        for (uint i = 0; i < _competitors.length; i++) {
            uint16 idToCheck = _competitors[i].id;
            
            // Check for duplicates by comparing with previous items
            for (uint j = 0; j < i; j++) {
                require(_competitors[j].id != idToCheck, "Duplicate competitor ID");
            }
        }
        
        // Validate betting opportunities - check for duplicate IDs
        for (uint i = 0; i < _bettingOpportunities.length; i++) {
            Championship.BettingOpportunityInput memory bet = _bettingOpportunities[i];
            uint16 idToCheck = bet.id;
            
            // Check for duplicates by comparing with previous items
            for (uint j = 0; j < i; j++) {
                require(_bettingOpportunities[j].id != idToCheck, "Duplicate betting opportunity ID");
            }
            
            // Validate point values
            require(bet.pointValues.length == 3, "Must provide exactly 3 point values");
        }
        
        // Deploy championship contract with validated data
        Championship newChampionship = new Championship(
            msg.sender,
            _description,
            _startDate,
            _endDate,
            _competitors,
            _bettingOpportunities
        );
        
        // Record the created championship
        address championshipAddress = address(newChampionship);
        createdChampionships[championshipAddress] = true;
        allChampionships.push(championshipAddress);
        
        // Emit event
        emit ChampionshipCreated(
            championshipAddress,
            _description,
            _startDate,
            _endDate
        );
        
        return championshipAddress;
    }

    /**
     * @notice Creates a new tournament with specified parameters
     * @param _description Description of the tournament
     * @param _championshipContract Address of the championship contract
     * @param _entryFee Entry fee in wei
     * @param _prizeDistribution Prize distribution percentages
     * @param _selectedBetIds Array of betting opportunity IDs
     * @param _bonusPointsPercentage Percentage of bonus points
     * @param _generalClosingWindowInSeconds Window in seconds before betting closes
     * @return address Address of the newly created tournament
     */
    function createTournament(
        string memory _description,
        address _championshipContract,
        uint256 _entryFee,
        uint256[] memory _prizeDistribution,
        uint16[] memory _selectedBetIds,
        uint8 _bonusPointsPercentage,
        uint32 _generalClosingWindowInSeconds
    ) external returns (address) {
        // Parameter validation
        require(bytes(_description).length > 0, "Description cannot be empty");
        require(_championshipContract != address(0), "Championship contract cannot be zero address");
        require(createdChampionships[_championshipContract], "Championship contract not created by this factory");
        require(_generalClosingWindowInSeconds >= 60 && _generalClosingWindowInSeconds <= 86400, "General closing window must be between 1 minute and 1 day");
        
        // Get championship and its start date (which will be used as registration end time)
        Championship championship = Championship(_championshipContract);
        uint256 championshipStartDate = championship.startDate();
        
        // Ensure championship hasn't started yet
        require(block.timestamp < championshipStartDate, "Championship has already started");
        
        require(_selectedBetIds.length > 0, "Must select at least one betting opportunity");
        require(_bonusPointsPercentage <= 100, "Bonus points percentage cannot exceed 100%");
        
        // Validate prize distribution
        require(_prizeDistribution.length > 0, "Prize distribution must have at least one entry");
        require(_prizeDistribution.length <= 10, "Prize distribution cannot exceed 10 entries");
        uint256 totalPercentage;
        for (uint256 i = 0; i < _prizeDistribution.length; i++) {
            totalPercentage += _prizeDistribution[i];
        }
        require(totalPercentage == 100, "Prize distribution must sum to 100");
        
        // Check for duplicate bet IDs
        for (uint256 i = 0; i < _selectedBetIds.length; i++) {
            uint16 idToCheck = _selectedBetIds[i];
            
            // Check for duplicates
            for (uint256 j = 0; j < i; j++) {
                require(_selectedBetIds[j] != idToCheck, "Duplicate betting ID in selection");
            }
        }
        
        // Verify that all selected bet IDs exist in the championship
        uint16[] memory allBetIds = championship.getBettingOpportunities();
        
        for (uint256 i = 0; i < _selectedBetIds.length; i++) {
            uint16 betId = _selectedBetIds[i];
            
            // Check if ID exists in championship
            bool found = false;
            for (uint256 j = 0; j < allBetIds.length; j++) {
                if (betId == allBetIds[j]) {
                    found = true;
                    break;
                }
            }
            require(found, "One or more selected betting opportunities do not exist");
        }
        
        // Create and deploy new tournament contract with msg.sender as admin
        // Use championship start date as registration end time
        Tournament newTournament = new Tournament(
            msg.sender, // Pass the original sender as admin
            _description,
            _championshipContract,
            championshipStartDate, // Use championship start date as registration end time
            _entryFee,
            _prizeDistribution,
            _selectedBetIds,
            _bonusPointsPercentage,
            _generalClosingWindowInSeconds
        );
        
        // Record the created tournament
        address tournamentAddress = address(newTournament);
        createdTournaments[tournamentAddress] = true;
        allTournaments.push(tournamentAddress);
        
        // Emit event
        emit TournamentCreated(
            tournamentAddress,
            _championshipContract,
            _description,
            championshipStartDate // Use championship start date as registration end time
        );
        
        return tournamentAddress;
    }
    
    /**
     * @notice Gets all championships created by this factory
     * @return Array of championship addresses
     */
    function getAllChampionships() external view returns (address[] memory) {
        return allChampionships;
    }
    
    /**
     * @notice Gets all tournaments created by this factory
     * @return Array of tournament addresses
     */
    function getAllTournaments() external view returns (address[] memory) {
        return allTournaments;
    }
    
    /**
     * @notice Checks if a championship was created by this factory
     * @param _championshipAddress Address of the championship to check
     * @return Boolean indicating if the championship was created by this factory
     */
    function isChampionshipFromFactory(address _championshipAddress) external view returns (bool) {
        return createdChampionships[_championshipAddress];
    }
    
    /**
     * @notice Checks if a tournament was created by this factory
     * @param _tournamentAddress Address of the tournament to check
     * @return Boolean indicating if the tournament was created by this factory
     */
    function isTournamentFromFactory(address _tournamentAddress) external view returns (bool) {
        return createdTournaments[_tournamentAddress];
    }
} 