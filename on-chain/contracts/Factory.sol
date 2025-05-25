// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.25;

import "./Tournament.sol";
import "./BettingGroup.sol";

/**
 * @title Factory
 * @notice Factory contract for creating tournaments and betting groups
 * @dev Handles validation, deployment and tracking of tournaments and betting groups
 */
contract Factory {

    // Custom Errors
    error OnlyPlatformAdmin();
    error ZeroAddress();
    error EmptyDescription();
    error InvalidTimeRange();
    error NoBettingOpportunities();
    error DuplicateBettingOpportunityId();
    error NoOptionsProvided();
    error AmountMustBeGreaterThanZero();
    error InsufficientBalance();
    error TournamentNotFromFactory();
    error InvalidClosingWindow();
    error TournamentAlreadyStarted();
    error InvalidPrizeDistributionLength();
    error InvalidPrizeDistributionTotal();

    // Events
    event TournamentCreated(
        address indexed tournamentAddress,
        string description,
        uint256 startTime,
        uint256 endTime,
        Tournament.BettingOpportunityInput[] bettingOpportunities
    );
    
    event BettingGroupCreated(
        address indexed bettingGroupAddress,
        address indexed tournamentContract,
        string description,
        uint256 registrationEndTime,
        uint256[] prizeDistribution,
        uint256 generalClosingWindowInSeconds
    );
        
    // State variables
    mapping(address => bool) public createdTournaments;
    address[] public allTournaments;
    
    mapping(address => bool) public createdBettingGroups;
    address[] public allBettingGroups;
    
    address public platformAdmin;
    
    // Constructor
    constructor() {
        platformAdmin = msg.sender;
    }
    
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
     * @notice Allows platform admin to withdraw a specific amount of platform fees
     * @param _amount Amount to withdraw
     */
    function withdrawFees(uint256 _amount) external onlyPlatformAdmin {
        if (_amount == 0) revert AmountMustBeGreaterThanZero();
        if (address(this).balance < _amount) revert InsufficientBalance();
        
        // Transfer specified amount to platform admin
        payable(platformAdmin).transfer(_amount);
    }
    
    /**
     * @notice Receives platform fees from betting groups
     */
    receive() external payable {
        // Simply receive ETH payments
    }
    
    /**
     * @notice Fallback function to accept payments
     */
    fallback() external payable {
        // Simply receive ETH payments
    }

    /**
     * @notice Creates a new tournament
     * @param _description Description of the tournament
     * @param _startTime Start time of the tournament (unix timestamp)
     * @param _endTime End time of the tournament (unix timestamp)
     * @param _bettingOpportunities Array of betting opportunities within the tournament
     * @return address Address of the newly created tournament
     */
    function createTournament(
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        Tournament.BettingOpportunityInput[] memory _bettingOpportunities
    ) external onlyPlatformAdmin returns (address) {
        // Parameter validation
        if (bytes(_description).length == 0) revert EmptyDescription();
        if (_startTime >= _endTime) revert InvalidTimeRange();
        if (_bettingOpportunities.length == 0) revert NoBettingOpportunities();
        
        // Validate betting opportunities - check for duplicate IDs
        for (uint i = 0; i < _bettingOpportunities.length; i++) {
            Tournament.BettingOpportunityInput memory bet = _bettingOpportunities[i];
            uint16 idToCheck = bet.id;
            
            // Check for duplicates by comparing with previous items
            for (uint j = 0; j < i; j++) {
                if (_bettingOpportunities[j].id == idToCheck) revert DuplicateBettingOpportunityId();
            }
            
            // Validate options
            if (bet.options.length == 0) revert NoOptionsProvided();
        }
        
        // Deploy tournament contract with validated data
        Tournament newTournament = new Tournament(
            msg.sender,
            _description,
            _startTime,
            _endTime,
            _bettingOpportunities
        );
        
        // Record the created tournament
        address tournamentAddress = address(newTournament);
        createdTournaments[tournamentAddress] = true;
        allTournaments.push(tournamentAddress);
        
        // Emit event
        emit TournamentCreated(
            tournamentAddress,
            _description,
            _startTime,
            _endTime,
            _bettingOpportunities
        );
        
        return tournamentAddress;
    }

    /**
     * @notice Creates a new betting group with specified parameters
     * @param _description Description of the betting group
     * @param _tournamentContract Address of the tournament contract
     * @param _entryFee Entry fee in wei
     * @param _prizeDistribution Prize distribution percentages
     * @param _generalClosingWindowInSeconds Window in seconds before betting closes
     * @return address Address of the newly created betting group
     */
    function createBettingGroup(
        string memory _description,
        address _tournamentContract,
        uint256 _entryFee,
        uint256[] memory _prizeDistribution,
        uint32 _generalClosingWindowInSeconds
    ) external returns (address) {
        // Parameter validation
        if (bytes(_description).length == 0) revert EmptyDescription();
        if (_tournamentContract == address(0)) revert ZeroAddress();
        if (!createdTournaments[_tournamentContract]) revert TournamentNotFromFactory();
        if (_generalClosingWindowInSeconds < 60 || _generalClosingWindowInSeconds > 86400) revert InvalidClosingWindow();
        
        // Get tournament and its start time (which will be used as registration end time)
        Tournament tournament = Tournament(_tournamentContract);
        uint256 tournamentStartTime = tournament.startTime();
        
        // Ensure tournament hasn't started yet
        if (block.timestamp >= tournamentStartTime) revert TournamentAlreadyStarted();
                
        // Validate prize distribution
        if (_prizeDistribution.length == 0) revert InvalidPrizeDistributionLength();
        if (_prizeDistribution.length > 10) revert InvalidPrizeDistributionLength();
        uint256 totalPercentage;
        for (uint256 i = 0; i < _prizeDistribution.length; i++) {
            totalPercentage += _prizeDistribution[i];
        }

        // 0.5% goes to platform
        if (totalPercentage != 995) revert InvalidPrizeDistributionTotal();
        
        // Create and deploy new betting group contract with msg.sender as admin
        // Use tournament start time as registration end time
        BettingGroup newBettingGroup = new BettingGroup(
            platformAdmin,
            _description,
            _tournamentContract,
            _entryFee,
            _prizeDistribution,
            _generalClosingWindowInSeconds
        );
        
        // Record the created betting group
        address bettingGroupAddress = address(newBettingGroup);
        createdBettingGroups[bettingGroupAddress] = true;
        allBettingGroups.push(bettingGroupAddress);
        
        // Emit event
        emit BettingGroupCreated(
            bettingGroupAddress,
            _tournamentContract,
            _description,
            tournamentStartTime,
            _prizeDistribution,
            _generalClosingWindowInSeconds
        );
        
        return bettingGroupAddress;
    }
    
    /**
     * @notice Checks if a tournament was created by this factory
     * @param _tournamentAddress Address of the tournament to check
     * @return Boolean indicating if the tournament was created by this factory
     */
    function isTournamentFromFactory(address _tournamentAddress) external view returns (bool) {
        return createdTournaments[_tournamentAddress];
    }
    
    /**
     * @notice Checks if a betting group was created by this factory
     * @param _bettingGroupAddress Address of the betting group to check
     * @return Boolean indicating if the betting group was created by this factory
     */
    function isBettingGroupFromFactory(address _bettingGroupAddress) external view returns (bool) {
        return createdBettingGroups[_bettingGroupAddress];
    }
} 