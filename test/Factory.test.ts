import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { expect } from 'chai'
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { Championship, Factory, Tournament } from '../typechain-types'

describe('Factory', function () {
  // Fixtures
  async function deployFixture() {
    // Get current blockchain time
    const currentTime = Math.floor(await time.latest())
    const oneDay = 86400 // seconds in a day
    const oneWeek = oneDay * 7
    
    const startDate = currentTime + oneDay
    const endDate = currentTime + oneWeek
    
    // Get signers
    const [deployer, user1, user2, user3] = await hre.ethers.getSigners()

    // Define competitors for Championship
    const competitors = [
      { id: 1, name: 'Lewis Hamilton', team: 'Mercedes' },
      { id: 2, name: 'Max Verstappen', team: 'Red Bull' },
      { id: 3, name: 'Charles Leclerc', team: 'Ferrari' }
    ]
    
    // Define betting opportunities for Championship
    const bettingOpportunities = [
      { 
        id: 1, 
        description: 'Monaco GP - Top 3 Qualifying',
        startTime: currentTime + oneDay / 2, // Half day from now
        pointValues: [10, 5, 2]
      },
      { 
        id: 2, 
        description: 'Monaco GP - Race Results',
        startTime: currentTime + oneDay, // 1 day from now
        pointValues: [25, 18, 15]
      }
    ]
    
    // Tournament parameters for creation
    const tournamentDescription = 'Bet on the F1 2023 season events'
    const entryFee = hre.ethers.parseEther('0.1') // 0.1 ETH entry fee
    const prizeDistribution = [50, 30, 20] // 50% for 1st, 30% for 2nd, 20% for 3rd
    const selectedBetIds = [1, 2] // Select both betting opportunities
    const bonusPointsPercentage = 20 // 20% bonus points
    const generalClosingWindow = 3600 // 1 hour before event
    
    // Deploy Factory contract
    const Factory = await hre.ethers.getContractFactory('Factory')
    const factory = await Factory.deploy()

    return { 
      factory, 
      currentTime,
      startDate,
      endDate,
      competitors,
      bettingOpportunities,
      deployer, 
      user1, 
      user2, 
      user3,
      tournamentDescription,
      entryFee,
      prizeDistribution,
      selectedBetIds,
      bonusPointsPercentage,
      generalClosingWindow
    }
  }
  
  describe('Championship Creation', function () {
    it('Should allow factory admin to create a championship', async function () {
      const { 
        factory, 
        startDate, 
        endDate, 
        competitors, 
        bettingOpportunities, 
        deployer 
      } = await loadFixture(deployFixture)
      
      // Call createChampionship
      const tx = await factory.createChampionship(
        'Formula 1 2023 Season',
        startDate,
        endDate,
        competitors,
        bettingOpportunities.map(bet => ({
          id: bet.id,
          description: bet.description,
          startTime: bet.startTime,
          pointValues: bet.pointValues
        }))
      )
      
      const receipt = await tx.wait()
      
      // Check if ChampionshipCreated event was emitted
      const events = receipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'ChampionshipCreated'
        } catch (e) {
          return false
        }
      })
      
      expect(events?.length).to.equal(1)
      
      // Extract championship address from the event
      const parsedEvent = factory.interface.parseLog(events![0])
      const championshipAddress = parsedEvent?.args[0]
      
      // Verify the championship was created successfully
      expect(championshipAddress).to.not.equal(hre.ethers.ZeroAddress)
      
      // Verify that the championship is recorded in the factory
      expect(await factory.createdChampionships(championshipAddress)).to.equal(true)
      expect(await factory.isChampionshipFromFactory(championshipAddress)).to.equal(true)
      
      // Get championship contract and verify it has the correct properties
      const Championship = await hre.ethers.getContractFactory('Championship')
      const championship = Championship.attach(championshipAddress) as Championship
      
      // Verify championship properties
      expect(await championship.description()).to.equal('Formula 1 2023 Season')
      expect(await championship.startDate()).to.equal(startDate)
      expect(await championship.endDate()).to.equal(endDate)
      expect(await championship.admin()).to.equal(deployer.address)
    })
    
    it('Should prevent creating championship with invalid parameters', async function () {
      const { factory, startDate, endDate, competitors, bettingOpportunities } = await loadFixture(deployFixture)
      
      // Empty description
      await expect(
        factory.createChampionship(
          '',
          startDate,
          endDate,
          competitors,
          bettingOpportunities.map(bet => ({
            id: bet.id,
            description: bet.description,
            startTime: bet.startTime,
            pointValues: bet.pointValues
          }))
        )
      ).to.be.revertedWith('Description cannot be empty')
      
      // End date before start date
      await expect(
        factory.createChampionship(
          'Invalid Championship',
          endDate, // swapped
          startDate, // swapped
          competitors,
          bettingOpportunities.map(bet => ({
            id: bet.id,
            description: bet.description,
            startTime: bet.startTime,
            pointValues: bet.pointValues
          }))
        )
      ).to.be.revertedWith('End date must be after start date')
      
      // Empty competitors
      await expect(
        factory.createChampionship(
          'Invalid Championship',
          startDate,
          endDate,
          [], // empty
          bettingOpportunities.map(bet => ({
            id: bet.id,
            description: bet.description,
            startTime: bet.startTime,
            pointValues: bet.pointValues
          }))
        )
      ).to.be.revertedWith('Must have at least one competitor')
      
      // Empty betting opportunities
      await expect(
        factory.createChampionship(
          'Invalid Championship',
          startDate,
          endDate,
          competitors,
          [] // empty
        )
      ).to.be.revertedWith('Must have at least one betting opportunity')
      
      // Duplicate competitor IDs
      await expect(
        factory.createChampionship(
          'Invalid Championship',
          startDate,
          endDate,
          [
            { id: 1, name: 'Lewis Hamilton' },
            { id: 1, name: 'Duplicate ID' } // Removed team property
          ],
          bettingOpportunities.map(bet => ({
            id: bet.id,
            description: bet.description,
            startTime: bet.startTime,
            pointValues: bet.pointValues
          }))
        )
      ).to.be.revertedWith('Duplicate competitor ID')
      
      // Duplicate betting opportunity IDs
      await expect(
        factory.createChampionship(
          'Invalid Championship',
          startDate,
          endDate,
          competitors,
          [
            {
              id: 1,
              description: 'Bet 1',
              startTime: startDate - 1000,
              pointValues: [10, 5, 2]
            },
            {
              id: 1, // Same ID
              description: 'Duplicate Bet',
              startTime: startDate - 500,
              pointValues: [20, 10, 5]
            }
          ]
        )
      ).to.be.revertedWith('Duplicate betting opportunity ID')
    })
  })
  
  describe('Tournament Creation', function () {
    it('Should allow users to create a tournament for a championship', async function () {
      const { 
        factory, 
        startDate, 
        endDate, 
        competitors, 
        bettingOpportunities, 
        user1,
        tournamentDescription,
        entryFee,
        prizeDistribution,
        selectedBetIds,
        bonusPointsPercentage,
        generalClosingWindow
      } = await loadFixture(deployFixture)
      
      // First create a championship
      const tx = await factory.createChampionship(
        'Formula 1 2023 Season',
        startDate,
        endDate,
        competitors,
        bettingOpportunities.map(bet => ({
          id: bet.id,
          description: bet.description,
          startTime: bet.startTime,
          pointValues: bet.pointValues
        }))
      )
      
      const receipt = await tx.wait()
      const championshipEvents = receipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'ChampionshipCreated'
        } catch (e) {
          return false
        }
      })
      
      // Extract championship address
      const parsedEvent = factory.interface.parseLog(championshipEvents![0])
      const championshipAddress = parsedEvent?.args[0]
      
      // User creates a tournament
      const tournamentTx = await factory.connect(user1).createTournament(
        tournamentDescription,
        championshipAddress,
        entryFee,
        prizeDistribution,
        selectedBetIds,
        bonusPointsPercentage,
        generalClosingWindow
      )
      
      const tournamentReceipt = await tournamentTx.wait()
      
      // Verify TournamentCreated event was emitted
      const tournamentEvents = tournamentReceipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'TournamentCreated'
        } catch (e) {
          return false
        }
      })
      
      expect(tournamentEvents?.length).to.equal(1)
      
      // Extract tournament address
      const tournamentParsedEvent = factory.interface.parseLog(tournamentEvents![0])
      const tournamentAddress = tournamentParsedEvent?.args[0]
      
      // Verify tournament was created successfully
      expect(tournamentAddress).to.not.equal(hre.ethers.ZeroAddress)
      
      // Verify tournament is recorded in factory
      expect(await factory.createdTournaments(tournamentAddress)).to.equal(true)
      expect(await factory.isTournamentFromFactory(tournamentAddress)).to.equal(true)
      
      // Get tournament contract and verify properties
      const Tournament = await hre.ethers.getContractFactory('Tournament')
      const tournament = Tournament.attach(tournamentAddress) as Tournament
      
      // Verify tournament properties
      expect(await tournament.admin()).to.equal(user1.address)
      expect(await tournament.championshipContract()).to.equal(championshipAddress)
    })
    
    it('Should prevent creating tournament with invalid parameters', async function () {
      const { 
        factory, 
        startDate, 
        endDate, 
        competitors, 
        bettingOpportunities,
        tournamentDescription,
        entryFee,
        prizeDistribution,
        selectedBetIds,
        bonusPointsPercentage,
        generalClosingWindow
      } = await loadFixture(deployFixture)
      
      // Create a championship first
      const tx = await factory.createChampionship(
        'Formula 1 2023 Season',
        startDate,
        endDate,
        competitors,
        bettingOpportunities.map(bet => ({
          id: bet.id,
          description: bet.description,
          startTime: bet.startTime,
          pointValues: bet.pointValues
        }))
      )
      
      const receipt = await tx.wait()
      const events = receipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'ChampionshipCreated'
        } catch (e) {
          return false
        }
      })
      
      const parsedEvent = factory.interface.parseLog(events![0])
      const championshipAddress = parsedEvent?.args[0]
      
      // Test empty description
      await expect(
        factory.createTournament(
          '', // empty
          championshipAddress,
          entryFee,
          prizeDistribution,
          selectedBetIds,
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Description cannot be empty')
      
      // Test zero address for championship
      await expect(
        factory.createTournament(
          tournamentDescription,
          hre.ethers.ZeroAddress, // zero address
          entryFee,
          prizeDistribution,
          selectedBetIds,
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Championship contract cannot be zero address')
      
      // Test non-existent championship
      const nonExistentChampionship = '0x1234567890123456789012345678901234567890'
      await expect(
        factory.createTournament(
          tournamentDescription,
          nonExistentChampionship,
          entryFee,
          prizeDistribution,
          selectedBetIds,
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Championship contract not created by this factory')
      
      // Test empty selected bet IDs
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          prizeDistribution,
          [], // empty
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Must select at least one betting opportunity')
      
      // Test bonus points percentage > 100
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          prizeDistribution,
          selectedBetIds,
          101, // > 100
          generalClosingWindow
        )
      ).to.be.revertedWith('Bonus points percentage cannot exceed 100%')
      
      // Test empty prize distribution
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          [], // empty
          selectedBetIds,
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Prize distribution must have at least one entry')
      
      // Test prize distribution not summing to 100
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          [40, 30, 20], // sum = 90 != 100
          selectedBetIds,
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Prize distribution must sum to 100')
      
      // Test duplicate betting IDs
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          prizeDistribution,
          [1, 1], // duplicate
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Duplicate betting ID in selection')
      
      // Test non-existent betting opportunity
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          prizeDistribution,
          [1, 999], // 999 doesn't exist
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('One or more selected betting opportunities do not exist')
    })

    // Add a separate test for the 'Championship has already started' scenario
    it('Should prevent creating tournament when championship has already started', async function () {
      const { 
        factory, 
        startDate, 
        endDate, 
        competitors, 
        bettingOpportunities,
        tournamentDescription,
        entryFee,
        prizeDistribution,
        selectedBetIds,
        bonusPointsPercentage,
        generalClosingWindow
      } = await loadFixture(deployFixture)
      
      // Create a championship first
      const tx = await factory.createChampionship(
        'Formula 1 2023 Season',
        startDate,
        endDate,
        competitors,
        bettingOpportunities.map(bet => ({
          id: bet.id,
          description: bet.description,
          startTime: bet.startTime,
          pointValues: bet.pointValues
        }))
      )
      
      const receipt = await tx.wait()
      const events = receipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'ChampionshipCreated'
        } catch (e) {
          return false
        }
      })
      
      const parsedEvent = factory.interface.parseLog(events![0])
      const championshipAddress = parsedEvent?.args[0]

      // Fast forward time past championship start
      await time.increaseTo(BigInt(startDate) + 1n)
      
      // Championship already started
      await expect(
        factory.createTournament(
          tournamentDescription,
          championshipAddress,
          entryFee,
          prizeDistribution,
          selectedBetIds,
          bonusPointsPercentage,
          generalClosingWindow
        )
      ).to.be.revertedWith('Championship has already started')
    })
  })
  
  describe('Factory Management', function () {
    it('Should track all created championships and tournaments', async function () {
      const { 
        factory, 
        startDate, 
        endDate, 
        competitors, 
        bettingOpportunities,
        tournamentDescription,
        entryFee,
        prizeDistribution,
        selectedBetIds,
        bonusPointsPercentage,
        generalClosingWindow
      } = await loadFixture(deployFixture)
      
      // Create championship
      const championshipTx = await factory.createChampionship(
        'Formula 1 2023 Season',
        startDate,
        endDate,
        competitors,
        bettingOpportunities.map(bet => ({
          id: bet.id,
          description: bet.description,
          startTime: bet.startTime,
          pointValues: bet.pointValues
        }))
      )
      
      const championshipReceipt = await championshipTx.wait()
      const championshipEvents = championshipReceipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'ChampionshipCreated'
        } catch (e) {
          return false
        }
      })
      
      const parsedChampionshipEvent = factory.interface.parseLog(championshipEvents![0])
      const championshipAddress = parsedChampionshipEvent?.args[0]
      
      // Create tournament
      const createTournamentTx = await factory.createTournament(
        tournamentDescription,
        championshipAddress,
        entryFee,
        prizeDistribution, 
        selectedBetIds,
        bonusPointsPercentage,
        generalClosingWindow
      )
      
      const tournamentReceipt = await createTournamentTx.wait()
      const tournamentEvents = tournamentReceipt?.logs.filter(log => {
        try {
          const parsedLog = factory.interface.parseLog(log)
          return parsedLog?.name === 'TournamentCreated'
        } catch (e) {
          return false
        }
      })
      
      const parsedTournamentEvent = factory.interface.parseLog(tournamentEvents![0])
      const tournamentAddress = parsedTournamentEvent?.args[0]
      
      // Check getAllChampionships
      const allChampionships = await factory.getAllChampionships()
      expect(allChampionships.length).to.equal(1)
      expect(allChampionships[0]).to.equal(championshipAddress)
      
      // Check getAllTournaments
      const allTournaments = await factory.getAllTournaments()
      expect(allTournaments.length).to.equal(1)
      expect(allTournaments[0]).to.equal(tournamentAddress)
    })
    
    it('Should allow only platform admin to set a new admin', async function () {
      const { factory, deployer, user1 } = await loadFixture(deployFixture)
      
      // Initial admin should be deployer
      expect(await factory.platformAdmin()).to.equal(deployer.address)
      
      // Set new admin
      await factory.setPlatformAdmin(user1.address)
      expect(await factory.platformAdmin()).to.equal(user1.address)
      
      // Original admin can no longer set admin
      await expect(
        factory.setPlatformAdmin(deployer.address)
      ).to.be.revertedWith('Only platform admin can perform this action')
      
      // New admin can set admin
      await factory.connect(user1).setPlatformAdmin(deployer.address)
      expect(await factory.platformAdmin()).to.equal(deployer.address)
    })
  })
}) 