import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import hre from 'hardhat'
import { expect } from 'chai'
import { time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { Championship, Factory } from '../typechain-types'

describe('Championship', function () {
  // Fixtures
  async function deployChampionshipFixture() {
    const currentTime = Math.floor(Date.now() / 1000)
    const oneDay = 86400 // seconds in a day
    const oneWeek = oneDay * 7
    
    const startDate = currentTime + oneDay
    const endDate = currentTime + oneWeek

    // Get signers
    const [admin, user1, user2] = await hre.ethers.getSigners()

    // Define competitors
    const competitors = [
      { id: 1, name: 'Lewis Hamilton' },
      { id: 2, name: 'Max Verstappen' },
      { id: 3, name: 'Charles Leclerc' }
    ];

    // Define betting opportunities using the BettingOpportunityInput struct
    const bettingOpportunities = [
      { 
        id: 1, 
        description: 'Monaco GP Qualifying - Bet on the top 3',
        startTime: currentTime + 3600, // 1 hour from now
        pointValues: [10, 5, 2]
      },
      { 
        id: 2, 
        description: 'Monaco GP Race - Bet on the top 3',
        startTime: 0, // Not yet known
        pointValues: [15, 8, 3]
      }
    ];

    // Deploy the Factory contract
    const Factory = await hre.ethers.getContractFactory('Factory')
    const factory = await Factory.deploy()

    // Deploy the Championship contract using the Factory
    const tx = await factory.createChampionship(
      'Formula 1 2023 Championship Season',
      startDate,
      endDate,
      competitors,
      bettingOpportunities
    )
    
    const receipt = await tx.wait()
    
    // Find ChampionshipCreated event
    const events = receipt?.logs.filter(log => {
      try {
        const parsedLog = factory.interface.parseLog(log)
        return parsedLog?.name === 'ChampionshipCreated'
      } catch {
        return false
      }
    })
    
    const parsedEvent = factory.interface.parseLog(events![0])
    const championshipAddress = parsedEvent?.args[0]
    
    // Get Championship contract instance
    const Championship = await hre.ethers.getContractFactory('Championship')
    const championship = Championship.attach(championshipAddress) as Championship

    return { championship, factory, admin, user1, user2, startDate, endDate, currentTime, competitors, bettingOpportunities }
  }

  // Tests for basic championship functionality
  describe('Championship Creation', function () {
    it('Should deploy with the correct initial values', async function () {
      const { championship, admin, startDate, endDate } = await loadFixture(deployChampionshipFixture)

      expect(await championship.description()).to.equal('Formula 1 2023 Championship Season')
      expect(await championship.startDate()).to.equal(startDate)
      expect(await championship.endDate()).to.equal(endDate)
      expect(await championship.admin()).to.equal(admin.address)
      expect(await championship.active()).to.equal(true)
    })
  })

  // Tests for competitor management
  describe('Competitors', function () {
    it('Should have all competitors defined at creation', async function () {
      const { championship, competitors } = await loadFixture(deployChampionshipFixture)
      
      const competitorIds = await championship.getCompetitors()
      expect(competitorIds.length).to.equal(competitors.length)
      
      for (let i = 0; i < competitors.length; i++) {
        const competitor = await championship.competitors(competitors[i].id)
        expect(competitor.id).to.equal(competitors[i].id)
        expect(competitor.name).to.equal(competitors[i].name)
      }
    })
  })

  // Tests for betting opportunity management
  describe('Betting Opportunities', function () {
    it('Should have all betting opportunities defined at creation', async function () {
      const { championship, bettingOpportunities } = await loadFixture(deployChampionshipFixture)
      
      const betIds = await championship.getBettingOpportunities()
      expect(betIds.length).to.equal(bettingOpportunities.length)
      
      for (let i = 0; i < bettingOpportunities.length; i++) {
        const bet = await championship.bettingOpportunities(bettingOpportunities[i].id)
        expect(bet.id).to.equal(bettingOpportunities[i].id)
        expect(bet.description).to.equal(bettingOpportunities[i].description)
        expect(bet.startTime).to.equal(bettingOpportunities[i].startTime)
        // endTime should be initialized to 0
        expect(bet.endTime).to.equal(0)
        // resultsFinalized should be initialized to false
        expect(bet.resultsFinalized).to.equal(false)
        // topPositions should be an empty array
        const results = await championship.getResults(bettingOpportunities[i].id)
        expect(results.length).to.equal(0)
        
        const pointValues = await championship.getPointValues(bettingOpportunities[i].id)
        expect(pointValues.length).to.equal(3)
        expect(pointValues[0]).to.equal(bettingOpportunities[i].pointValues[0])
        expect(pointValues[1]).to.equal(bettingOpportunities[i].pointValues[1])
        expect(pointValues[2]).to.equal(bettingOpportunities[i].pointValues[2])
      }
    })
  })

  // Tests for results management
  describe('Results Management', function () {
    it('Should allow admin to set results and end time', async function () {
      const { championship, admin, currentTime } = await loadFixture(deployChampionshipFixture)
      
      const betId = 1; // Use the first betting opportunity
      const topPositions = [2, 1, 3]; // Max, Lewis, Charles
      const endTime = currentTime + 5000;
      
      // First set the start time to something non-zero if it's not already set
      if ((await championship.bettingOpportunities(betId)).startTime === 0n) {
        await championship.connect(admin).updateBettingOpportunityStartTime(betId, currentTime + 1000);
      }
      
      // Set the results
      await championship.connect(admin).setResults(betId, topPositions, endTime);
      
      // Verify results were set
      const storedResults = await championship.getResults(betId);
      expect(storedResults.length).to.equal(3);
      expect(storedResults[0]).to.equal(topPositions[0]);
      expect(storedResults[1]).to.equal(topPositions[1]);
      expect(storedResults[2]).to.equal(topPositions[2]);
      
      // Verify other properties were updated
      const bet = await championship.bettingOpportunities(betId);
      expect(bet.endTime).to.equal(endTime);
      expect(bet.resultsFinalized).to.equal(true);
    })
  })

  // Tests for betting window functionality
  describe('Betting Window', function () {
    it('Should correctly identify when betting window is open', async function () {
      const { championship, currentTime } = await loadFixture(deployChampionshipFixture)
      
      // Fast forward time to when betting window is open
      await time.increaseTo(currentTime + 3700) // bet 1 starts at currentTime + 3600
      
      // Check that window is open
      expect(await championship.isBettingWindowOpen(1, 300)).to.equal(true)
    })
    
    it('Should identify when betting window is not yet open', async function () {
      const { championship } = await loadFixture(deployChampionshipFixture)
      
      // Check that window for bet 1 is not yet open (default fixture time is before start time)
      expect(await championship.isBettingWindowOpen(1, 300)).to.equal(false)
      
      // Check that window for bet 2 is not open (start time is 0)
      expect(await championship.isBettingWindowOpen(2, 300)).to.equal(false)
    })
  })
}) 