import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { Tournament, Championship } from '../typechain-types'

// Task to simulate tournament completion and prize distribution
task('tournament-completion', 'Simulates tournament completion and prize distribution')
  .addParam('tournament', 'Address of the tournament contract')
  .addParam('championship', 'Address of the championship contract')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    console.log(`Simulating tournament completion on ${network.name}...`)

    // Get the deployer account
    const [deployer] = await ethers.getSigners()
    console.log(`Using account: ${deployer.address}`)

    // Get contract instances
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament) as Tournament
    const championship = await ethers.getContractAt('Championship', taskArgs.championship) as Championship

    // Check if tournament is active
    const isActive = await tournament.active()
    if (!isActive) {
      console.log('Tournament is not active. Aborting.')
      return
    }

    // Get selected betting opportunities
    const selectedBetIds = await tournament.getSelectedBets()
    console.log(`Tournament has ${selectedBetIds.length} betting opportunities: ${selectedBetIds}`)

    // Check which betting opportunities have results available
    const betProcessingResults = await Promise.all(
      selectedBetIds.map(async (betId) => {
        try {
          // Check if results exist on championship
          const results = await championship.getResults(betId)
          console.log(`Bet ID ${betId} has results available: ${results}`)
          
          // Check if already processed in tournament
          const betResults = await tournament.getBettingResults(betId)
          const processed = betResults[1] // Access the processed boolean value
          return { betId, hasResults: true, processed }
        } catch (error) {
          console.log(`Bet ID ${betId} does not have results yet`)
          return { betId, hasResults: false, processed: false }
        }
      })
    )

    // Process results for each betting opportunity that has results but hasn't been processed
    for (const { betId, hasResults, processed } of betProcessingResults) {
      if (hasResults && !processed) {
        console.log(`Processing results for betting opportunity ${betId}...`)
        try {
          const tx = await tournament.processResults(betId)
          await tx.wait()
          console.log(`Successfully processed results for bet ID ${betId}`)
        } catch (error) {
          console.error(`Failed to process results for bet ID ${betId}:`, error)
        }
      }
    }

    // Check if all betting opportunities have been processed
    let leaderboardInfo = await tournament.getLeaderboard()
    let finalized = leaderboardInfo[2] // Get the finalized status
    
    if (!finalized) {
      // If tournament is not finalized, try to manually distribute winnings
      console.log('Tournament is not automatically finalized. Attempting manual prize distribution...')
      
      try {
        const tx = await tournament.distributeWinningsPublic()
        await tx.wait()
        console.log('Successfully distributed prizes')
        
        // Update finalized status
        leaderboardInfo = await tournament.getLeaderboard()
        finalized = leaderboardInfo[2]
      } catch (error) {
        console.error('Failed to distribute prizes:', error)
      }
    }

    // Display leaderboard and prize information
    if (finalized) {
      console.log('Tournament has been finalized')
      
      const [addresses, points] = await tournament.getLeaderboard()
      const totalPrizePool = await tournament.getPrizePool()
      
      // Get prize distribution percentages by checking each rank
      const prizeDistribution: number[] = []
      
      console.log('\nFinal Leaderboard:')
      console.log('------------------')
      
      // Fetch prizes in a more direct way that avoids type issues
      // Get the prize distribution directly from contract calls
      let rank = 0
      let sumPrizes = 0
      
      while (sumPrizes < 100 && rank < 5) {
        try {
          // Call contract function using a different approach to avoid type issues
          const percentBN = await tournament.getPrizePercentForRank(rank)
          const percent = Number(percentBN)
          prizeDistribution.push(percent)
          sumPrizes += percent
          rank++
        } catch (error) {
          // Stop when we can't get more prize positions
          break
        }
      }
      
      // Display leaderboard with prizes
      for (let i = 0; i < addresses.length; i++) {
        console.log(`#${i + 1}: ${addresses[i]} - ${points[i]} points`)
        
        // Show prize amount for winners if we have prize distribution data
        if (i < prizeDistribution.length) {
          const prizePercent = prizeDistribution[i]
          const prizeAmount = totalPrizePool * BigInt(prizePercent) / 100n
          console.log(`   Prize: ${ethers.formatEther(prizeAmount)} ETH (${prizePercent}% of pool)`)
        }
      }
      
      console.log(`\nTotal Prize Pool: ${ethers.formatEther(totalPrizePool)} ETH`)
    } else {
      console.log('Tournament is not finalized. Some betting opportunities might not have results yet.')
    }
  })

export default {} 