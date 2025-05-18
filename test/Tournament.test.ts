import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { expect } from 'chai'
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { Championship, Tournament } from '../typechain-types'

describe('Tournament', function () {
  // Fixtures
  async function deployFixture() {
    const currentTime = Math.floor(await time.latest())
    const oneDay = 86400 // seconds in a day
    const oneWeek = oneDay * 7
    
    const startDate = currentTime + oneDay
    const endDate = currentTime + oneWeek
    
    // Get signers
    const [admin, user1, user2, user3, user4, user5] = await hre.ethers.getSigners()

    // Define competitors for Championship
    const competitors = [
      { id: 1, name: 'Lewis Hamilton' },
      { id: 2, name: 'Max Verstappen' },
      { id: 3, name: 'Charles Leclerc' }
    ]
    
    // Define betting opportunities for Championship
    const bettingOpportunities = [
      { 
        id: 1, 
        description: 'Monaco GP - Top 3 Qualifying',
        startTime: currentTime + 3600, // 1 hour from now
        pointValues: [10, 5, 2]
      },
      { 
        id: 2, 
        description: 'Monaco GP - Race Results',
        startTime: currentTime + 2 * oneDay, // 2 days from now
        pointValues: [15, 8, 3]
      }
    ]
    
    // Tournament parameters
    const tournamentDescription = 'Bet on the F1 2023 season events'
    const entryFee = hre.ethers.parseEther('0.1') // 0.1 ETH entry fee
    const prizeDistribution = [50, 30, 20] // 50% for 1st, 30% for 2nd, 20% for 3rd
    const selectedBetIds = [1, 2] // Select both betting opportunities
    const bonusPointsPercentage = 20 // 20% bonus points
    const generalClosingWindow = 3600 // 1 hour before event
    
    // Deploy Factory contract
    const Factory = await hre.ethers.getContractFactory('Factory')
    const factory = await Factory.connect(admin).deploy()
    
    // Deploy the Championship contract using Factory
    const tx = await factory.connect(admin).createChampionship(
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
    
    // Get the Championship contract instance
    const Championship = await hre.ethers.getContractFactory('Championship')
    const championship = Championship.attach(championshipAddress) as Championship
    
    // Create Tournament through factory
    const tournamentTx = await factory.connect(admin).createTournament(
      tournamentDescription,
      championshipAddress,
      entryFee,
      prizeDistribution,
      selectedBetIds,
      bonusPointsPercentage,
      generalClosingWindow
    )
    
    const tournamentReceipt = await tournamentTx.wait()
    const tournamentEvents = tournamentReceipt?.logs.filter(log => {
      try {
        const parsedLog = factory.interface.parseLog(log)
        return parsedLog?.name === 'TournamentCreated'
      } catch (e) {
        return false
      }
    })
    
    const tournamentParsedEvent = factory.interface.parseLog(tournamentEvents![0])
    const tournamentAddress = tournamentParsedEvent?.args[0]
    
    // Get the Tournament contract instance
    const Tournament = await hre.ethers.getContractFactory('Tournament')
    const tournament = Tournament.attach(tournamentAddress) as Tournament
    
    return { 
      tournament, 
      championship,
      factory,
      admin, 
      user1, 
      user2, 
      user3,
      user4,
      user5,
      currentTime, 
      startDate,
      entryFee
    }
  }
  
  describe('Registration and Betting', function () {
    it('Should allow users to register and place bets', async function () {
      const { tournament, championship, admin, user1, entryFee, currentTime } = await loadFixture(deployFixture)
      
      // Register a user
      await tournament.connect(user1).register('Alice', { value: entryFee })
      expect(await tournament.participantCount()).to.equal(1)
      
      // First update betting opportunity start time to make window open
      await championship.connect(admin).updateBettingOpportunityStartTime(1, currentTime - 100)
      
      // Place a bet
      const betId = 1
      const prediction = [2, 1, 3] // Max, Lewis, Charles
      await tournament.connect(user1).placeBet(betId, prediction)
      
      // Verify bet was placed
      expect(await tournament.hasBetPlaced(user1.address, betId)).to.equal(true)
      
      // Verify prediction
      const storedPrediction = await tournament.getParticipantBet(user1.address, betId)
      expect(storedPrediction.length).to.equal(3)
      expect(storedPrediction[0]).to.equal(2) // Max
      expect(storedPrediction[1]).to.equal(1) // Lewis
      expect(storedPrediction[2]).to.equal(3) // Charles
    })
    
    it('Should reject registrations after championship starts', async function () {
      const { tournament, user1, entryFee, startDate } = await loadFixture(deployFixture)
      
      // Fast forward time past championship start
      await time.increaseTo(startDate + 1)
      
      await expect(tournament.connect(user1).register('Alice', { value: entryFee }))
        .to.be.revertedWith('Registration closed: Championship has started')
    })
    
    it('Should allow withdrawal during registration', async function () {
      const { tournament, user1, entryFee } = await loadFixture(deployFixture)
      
      // Register a user
      await tournament.connect(user1).register('Alice', { value: entryFee })
      
      // User withdraws from tournament
      const balanceBefore = await hre.ethers.provider.getBalance(user1.address)
      const tx = await tournament.connect(user1).withdrawFromTournament()
      const receipt = await tx.wait()
      
      // Calculate gas used
      const gasUsed = receipt?.gasUsed ?? 0n
      const gasPrice = receipt?.gasPrice ?? 0n
      const gasCost = gasUsed * gasPrice
      
      // Check balance after withdrawal
      const balanceAfter = await hre.ethers.provider.getBalance(user1.address)
      
      // User should have received their entry fee back minus gas costs
      const expectedBalance = balanceBefore + entryFee - gasCost
      expect(balanceAfter).to.be.closeTo(expectedBalance, 1000000n)
      
      // User should no longer be registered
      const participant = await tournament.participants(user1.address)
      expect(participant.hasRegistered).to.equal(false)
    })
    
    it('Should prevent withdrawal after championship starts', async function () {
      const { tournament, user1, entryFee, startDate } = await loadFixture(deployFixture)
      
      // Register user
      await tournament.connect(user1).register('Alice', { value: entryFee })
      
      // Fast forward time past championship start
      await time.increaseTo(startDate + 1)
      
      // User tries to withdraw
      await expect(tournament.connect(user1).withdrawFromTournament())
        .to.be.revertedWith('Registration closed: Championship has started')
    })
    
    it('Should prevent withdrawal after placing bets', async function () {
      const { tournament, championship, admin, user1, entryFee, currentTime } = await loadFixture(deployFixture)
      
      // Register user
      await tournament.connect(user1).register('Alice', { value: entryFee })
      
      // First update betting opportunity start time to make window open
      await championship.connect(admin).updateBettingOpportunityStartTime(1, currentTime - 100)
      
      // Place a bet
      const betId = 1
      const prediction = [2, 1, 3] // Max, Lewis, Charles
      await tournament.connect(user1).placeBet(betId, prediction)
      
      // Try to withdraw
      await expect(tournament.connect(user1).withdrawFromTournament())
        .to.be.revertedWith('Cannot withdraw after placing bets')
    })
  })
  
  describe('Tournament Finalization', function () {
    it('Should allow admin to finalize tournament after championship starts', async function () {
      const { tournament, admin, user1, user2, user3, user4, user5, entryFee, startDate } = await loadFixture(deployFixture)
      
      // Register enough participants
      await tournament.connect(user1).register('Alice', { value: entryFee })
      await tournament.connect(user2).register('Bob', { value: entryFee })
      await tournament.connect(user3).register('Charlie', { value: entryFee })
      await tournament.connect(user4).register('Dave', { value: entryFee })
      await tournament.connect(user5).register('Eve', { value: entryFee })
      
      // Fast forward time to championship start
      await time.increaseTo(startDate)
      
      // Finalize the tournament
      await expect(tournament.connect(admin).finalizeTournament())
        .to.emit(tournament, 'TournamentStarted')
    })
    
    it('Should cancel tournament if not enough participants', async function () {
      const { tournament, admin, user1, entryFee, startDate } = await loadFixture(deployFixture)
      
      // Register just one participant (not enough)
      await tournament.connect(user1).register('Alice', { value: entryFee })
      
      // Fast forward time to championship start
      await time.increaseTo(startDate)
      
      // Finalize the tournament - should cancel because not enough participants
      await expect(tournament.connect(admin).finalizeTournament())
        .to.emit(tournament, 'TournamentCancelled')
        .withArgs('Not enough participants')
    })
  })
  
  describe('Results Processing', function () {
    it('Should allow admin to process results and update leaderboard', async function () {
      const { tournament, championship, admin, user1, user2, user3, user4, user5, entryFee, startDate, currentTime } = await loadFixture(deployFixture)
      
      // Register 5 users
      await tournament.connect(user1).register('Alice', { value: entryFee })
      await tournament.connect(user2).register('Bob', { value: entryFee })
      await tournament.connect(user3).register('Charlie', { value: entryFee })
      await tournament.connect(user4).register('Admin', { value: entryFee })
      await tournament.connect(user5).register('Fifth', { value: entryFee })
      
      // Update betting opportunity start time to make window open
      // Use a time in the past
      const pastTime = currentTime - 100
      await championship.connect(admin).updateBettingOpportunityStartTime(1, pastTime)
      
      // Place different bets
      // Alice: correct prediction for bet 1
      await tournament.connect(user1).placeBet(1, [1, 2, 3]) // Lewis, Max, Charles
      
      // Bob: partially correct
      await tournament.connect(user2).placeBet(1, [2, 1, 3]) // Max, Lewis, Charles
      
      // Charlie: completely wrong
      await tournament.connect(user3).placeBet(1, [3, 2, 1]) // Charles, Max, Lewis
      
      // Fast forward time to championship start
      await time.increaseTo(BigInt(startDate))
      
      // Finalize tournament
      await tournament.connect(admin).finalizeTournament()
      
      // Set results for bet 1
      const resultTime = await time.latest()
      await championship.connect(admin).setResults(1, [1, 2, 3], BigInt(resultTime) + 10000n)
      
      // Process results
      await expect(tournament.connect(admin).processResults(1))
        .to.emit(tournament, 'ResultsProcessed')
        .to.emit(tournament, 'PointsAwarded')
      
      // Check leaderboard
      const [addresses, points] = await tournament.getLeaderboard()
      
      // Alice should have the highest points
      expect(addresses[0]).to.equal(user1.address)
      expect(points[0]).to.be.greaterThan(points[1])
    })
    
    it('Should automatically distribute winnings when all results are processed', async function () {
      const { tournament, championship, admin, user1, user2, user3, user4, user5, entryFee, startDate, currentTime } = await loadFixture(deployFixture)
      
      // Register 5 users
      await tournament.connect(user1).register('Alice', { value: entryFee })
      await tournament.connect(user2).register('Bob', { value: entryFee })
      await tournament.connect(user3).register('Charlie', { value: entryFee })
      await tournament.connect(user4).register('Dave', { value: entryFee })
      await tournament.connect(user5).register('Eve', { value: entryFee })
      
      // First set/update start times for betting opportunities to be in the past
      const betStartTime1 = currentTime - 100
      const betStartTime2 = currentTime - 50
      
      await championship.connect(admin).updateBettingOpportunityStartTime(1, betStartTime1)
      await championship.connect(admin).updateBettingOpportunityStartTime(2, betStartTime2)
      
      // Place bets for all users
      // Alice: best predictions
      await tournament.connect(user1).placeBet(1, [1, 2, 3])
      await tournament.connect(user1).placeBet(2, [1, 2, 3])
      
      // Bob: good predictions
      await tournament.connect(user2).placeBet(1, [1, 3, 2])
      await tournament.connect(user2).placeBet(2, [1, 3, 2])
      
      // Charlie: ok predictions
      await tournament.connect(user3).placeBet(1, [2, 1, 3])
      await tournament.connect(user3).placeBet(2, [2, 1, 3])
      
      // Dave: bad predictions
      await tournament.connect(user4).placeBet(1, [3, 2, 1])
      await tournament.connect(user4).placeBet(2, [3, 2, 1])
      
      // Eve: mixed predictions
      await tournament.connect(user5).placeBet(1, [1, 3, 2])
      await tournament.connect(user5).placeBet(2, [3, 1, 2])
      
      // Fast forward time past championship start time
      await time.increaseTo(BigInt(startDate))
      
      // Finalize tournament
      await tournament.connect(admin).finalizeTournament()

      // Ensure we know the correct start time for the betting opportunities
      const bet1 = await championship.bettingOpportunities(1)
      const bet2 = await championship.bettingOpportunities(2)
      
      // Set results for betting opportunity 1 with a valid end time
      const endTime1 = BigInt(bet1.startTime) + 10000n
      await championship.connect(admin).setResults(1, [1, 2, 3], endTime1)
      
      // Set results for betting opportunity 2 with a valid end time
      const endTime2 = BigInt(bet2.startTime) + 10000n
      await championship.connect(admin).setResults(2, [1, 2, 3], endTime2)
      
      // Record initial balances
      const initialBalance1 = await hre.ethers.provider.getBalance(user1.address)
      
      // Process results for first betting opportunity
      await tournament.connect(admin).processResults(1)
      
      // Process results for second betting opportunity - this will automatically distribute winnings
      await expect(tournament.connect(admin).processResults(2))
        .to.emit(tournament, 'ResultsProcessed')
        .to.emit(tournament, 'LeaderboardUpdated')
        .to.emit(tournament, 'PrizePaid')
        .to.emit(tournament, 'TournamentEnded')
      
      // Check final balances - winners should have received prize money
      const finalBalance1 = await hre.ethers.provider.getBalance(user1.address)
      
      // User1 should be the top winner with 50% of prize pool
      expect(finalBalance1).to.be.greaterThan(initialBalance1)
      
      // Check that tournament is marked as inactive and finalized
      expect(await tournament.active()).to.equal(false)
      const [, , finalized] = await tournament.getLeaderboard()
      expect(finalized).to.equal(true)
    })
    
    it('Should allow admin to manually distribute winnings', async function () {
      const { tournament, championship, admin, user1, user2, user3, user4, user5, entryFee, startDate, currentTime } = await loadFixture(deployFixture)
      
      // Register 5 users
      await tournament.connect(user1).register('Alice', { value: entryFee })
      await tournament.connect(user2).register('Bob', { value: entryFee })
      await tournament.connect(user3).register('Charlie', { value: entryFee })
      await tournament.connect(user4).register('Dave', { value: entryFee })
      await tournament.connect(user5).register('Eve', { value: entryFee })
      
      // First set/update start times for betting opportunities to be in the past
      const betStartTime1 = currentTime - 100
      const betStartTime2 = currentTime - 50
      
      await championship.connect(admin).updateBettingOpportunityStartTime(1, betStartTime1)
      await championship.connect(admin).updateBettingOpportunityStartTime(2, betStartTime2)
      
      // Place bets for all users with various predictions
      await tournament.connect(user1).placeBet(1, [1, 2, 3])
      await tournament.connect(user1).placeBet(2, [1, 2, 3])
      
      await tournament.connect(user2).placeBet(1, [2, 1, 3])
      await tournament.connect(user2).placeBet(2, [2, 1, 3])
      
      await tournament.connect(user3).placeBet(1, [3, 2, 1])
      await tournament.connect(user3).placeBet(2, [3, 2, 1])
      
      await tournament.connect(user4).placeBet(1, [1, 3, 2])
      await tournament.connect(user4).placeBet(2, [1, 3, 2])
      
      await tournament.connect(user5).placeBet(1, [2, 3, 1])
      await tournament.connect(user5).placeBet(2, [2, 3, 1])
      
      // Fast-forward time past championship start time
      await time.increaseTo(BigInt(startDate))
      
      // Finalize tournament
      await tournament.connect(admin).finalizeTournament()
      
      // Ensure we know the correct start time for the betting opportunities
      const bet1 = await championship.bettingOpportunities(1)
      const bet2 = await championship.bettingOpportunities(2)
      
      // Set results for betting opportunity 1 with a valid end time
      const endTime1 = BigInt(bet1.startTime) + 10000n
      await championship.connect(admin).setResults(1, [1, 2, 3], endTime1)
      
      // Set results for betting opportunity 2 with a valid end time
      const endTime2 = BigInt(bet2.startTime) + 10000n
      await championship.connect(admin).setResults(2, [1, 2, 3], endTime2)
      
      // Process results for both betting opportunities
      await tournament.connect(admin).processResults(1)

      // Record balances before final distribution
      const initialBalance1 = await hre.ethers.provider.getBalance(user1.address)
      
      // Process the second result - this will automatically distribute winnings
      await expect(tournament.connect(admin).processResults(2))
        .to.emit(tournament, 'ResultsProcessed')
        .to.emit(tournament, 'LeaderboardUpdated')
        .to.emit(tournament, 'PrizePaid')
        .to.emit(tournament, 'TournamentEnded')
      
      // Check final balances
      const finalBalance1 = await hre.ethers.provider.getBalance(user1.address)
      
      // User1 should have received prize
      expect(finalBalance1).to.be.greaterThan(initialBalance1)
    })
  })
}) 