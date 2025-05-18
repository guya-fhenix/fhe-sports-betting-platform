import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

// Task to deploy the Tournament contract
task('deploy-tournament', 'Deploy the Tournament contract to the selected network')
  .addParam('description', 'Tournament description')
  .addParam('championship', 'Championship contract address')
  .addParam('regend', 'Registration end time (timestamp)')
  .addParam('entryfee', 'Entry fee in wei')
  .addParam('prizes', 'JSON string of prize percentages array (e.g. [50,30,20])')
  .addParam('selectedbets', 'JSON string of selected betting opportunity IDs array (e.g. [1,2,3])')
  .addParam('bonuspoints', 'Bonus points percentage (0-100)')
  .addParam('closingwindow', 'General closing window in seconds before each event')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    console.log(`Deploying Tournament to ${network.name}...`)

    // Get the deployer account
    const [deployer] = await ethers.getSigners()
    console.log(`Deploying with account: ${deployer.address}`)

    // Parse prize distribution and selected bets
    const prizeDistribution = JSON.parse(taskArgs.prizes)
    const selectedBetIds = JSON.parse(taskArgs.selectedbets)
    
    // Check that prize distribution percentages sum to 100
    const totalPercentage = prizeDistribution.reduce((sum: number, percentage: number) => sum + percentage, 0)
    if (totalPercentage !== 100) {
      throw new Error(`Prize distribution must sum to 100, got ${totalPercentage}`)
    }

    // Check that bonus points are within valid range
    const bonusPoints = parseInt(taskArgs.bonuspoints)
    if (bonusPoints < 0 || bonusPoints > 100) {
      throw new Error(`Bonus points percentage must be between 0 and 100, got ${bonusPoints}`)
    }

    // Deploy the contract
    const Tournament = await ethers.getContractFactory('Tournament')
    const tournament = await Tournament.deploy(
      deployer.address, // Admin address
      taskArgs.description,
      taskArgs.championship,
      taskArgs.regend,
      taskArgs.entryfee,
      prizeDistribution,
      selectedBetIds,
      bonusPoints,
      taskArgs.closingwindow
    )
    await tournament.waitForDeployment()

    const tournamentAddress = await tournament.getAddress()
    console.log(`Tournament deployed to: ${tournamentAddress}`)

    // Save the deployment
    saveDeployment(network.name, 'Tournament', tournamentAddress)

    return tournamentAddress
  })

// Task to register for a tournament
task('register-tournament', 'Register for a tournament')
  .addParam('tournament', 'Tournament contract address')
  .addParam('name', 'Participant name')
  .addParam('value', 'Entry fee to send in wei')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    console.log(`Registering ${taskArgs.name} for tournament at ${taskArgs.tournament}...`)
    
    // Register for the tournament
    const tx = await tournament.register(taskArgs.name, {
      value: taskArgs.value
    })
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Successfully registered participant: ${taskArgs.name}`)
  })

// Task to place a bet in a tournament
task('place-bet', 'Place a bet in a tournament')
  .addParam('tournament', 'Tournament contract address')
  .addParam('betid', 'Betting opportunity ID')
  .addParam('positions', 'Comma-separated list of competitor IDs in predicted positions')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    // Parse positions
    const predictedPositions = taskArgs.positions.split(',').map((pos: string) => parseInt(pos.trim()))
    
    console.log(`Placing bet for betting opportunity ${taskArgs.betid} in tournament ${taskArgs.tournament}...`)
    console.log(`Predicted positions: ${predictedPositions.join(', ')}`)
    
    // Place the bet
    const tx = await tournament.placeBet(taskArgs.betid, predictedPositions)
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Successfully placed bet for betting opportunity ${taskArgs.betid}`)
  })

// Task to get tournament information
task('get-tournament-info', 'Get information about a tournament')
  .addParam('tournament', 'Tournament contract address')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    // Get tournament parameters
    const params = await tournament.params()
    const active = await tournament.active()
    const prizePool = await tournament.getPrizePool()
    const participantCount = await tournament.participantCount()
    const participants = await tournament.getParticipants()
    const selectedBets = await tournament.getSelectedBets()
    
    console.log('\nTournament Information:')
    console.log('-----------------------')
    console.log(`Description: ${params.description}`)
    console.log(`Entry Fee: ${ethers.formatEther(params.entryFee)} ETH`)
    console.log(`Min Participants: ${params.minParticipants}`)
    console.log(`Active: ${active}`)
    console.log(`Total Prize Pool: ${ethers.formatEther(prizePool)} ETH`)
    console.log(`Current Participants: ${participantCount}`)
    console.log(`Bonus Points Percentage: ${params.bonusPointsPercentage}%`)
    console.log(`General Closing Window: ${params.generalClosingWindowInSeconds} seconds`)
    console.log(`Selected Bet IDs: ${selectedBets.join(', ')}`)
    
    console.log('\nParticipant Addresses:')
    for (let i = 0; i < participants.length; i++) {
      console.log(`${i+1}: ${participants[i]}`)
    }
  })

// Task to finalize a tournament
task('finalize-tournament', 'Finalize a tournament after registration ends')
  .addParam('tournament', 'Tournament contract address')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    console.log(`Finalizing tournament at ${taskArgs.tournament}...`)
    
    // Finalize the tournament
    const tx = await tournament.finalizeTournament()
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Successfully finalized tournament`)
  })

// Task to process results for a betting opportunity
task('process-results', 'Process results for a betting opportunity')
  .addParam('tournament', 'Tournament contract address')
  .addParam('betid', 'Betting opportunity ID')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    console.log(`Processing results for betting opportunity ${taskArgs.betid} in tournament ${taskArgs.tournament}...`)
    
    // Process results
    const tx = await tournament.processResults(taskArgs.betid)
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Successfully processed results for betting opportunity ${taskArgs.betid}`)
    
    // Check if all betting opportunities have been scored
    const [results, finalized] = await tournament.getLeaderboard()
    if (finalized) {
      console.log(`Tournament has been automatically finalized and winnings distributed!`)
    }
  })

// Task to manually distribute winnings
task('distribute-winnings', 'Manually distribute winnings for a tournament')
  .addParam('tournament', 'Tournament contract address')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    console.log(`Distributing winnings for tournament ${taskArgs.tournament}...`)
    
    // Distribute winnings
    const tx = await tournament.distributeWinningsPublic()
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Successfully distributed winnings for tournament`)
  })

// Task to view leaderboard
task('get-leaderboard', 'Get the leaderboard for a tournament')
  .addParam('tournament', 'Tournament contract address')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    // Get leaderboard
    const [addresses, points, finalized] = await tournament.getLeaderboard()
    
    console.log('\nTournament Leaderboard:')
    console.log('----------------------')
    console.log(`Finalized: ${finalized ? 'Yes' : 'No'}`)
    
    if (addresses.length === 0) {
      console.log('No participants yet')
      return
    }
    
    console.log('\nRank | Address                                    | Points')
    console.log('-----|-------------------------------------------|--------')
    
    for (let i = 0; i < addresses.length; i++) {
      const rank = (i + 1).toString().padStart(4, ' ')
      console.log(`${rank} | ${addresses[i]} | ${points[i]}`)
    }
  })

// Task to view betting results
task('get-betting-results', 'Get the results of a betting opportunity')
  .addParam('tournament', 'Tournament contract address')
  .addParam('betid', 'Betting opportunity ID')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the tournament contract
    const tournament = await ethers.getContractAt('Tournament', taskArgs.tournament, signer)
    
    // Get betting results
    const [results, processed] = await tournament.getBettingResults(taskArgs.betid)
    
    console.log(`\nResults for Betting Opportunity ${taskArgs.betid}:`)
    console.log(`Processed: ${processed ? 'Yes' : 'No'}`)
    
    if (!processed) {
      console.log('Results not yet processed')
      return
    }
    
    console.log('\nPosition | Competitor ID')
    console.log('---------|-------------')
    
    for (let i = 0; i < results.length; i++) {
      console.log(`${i+1}        | ${results[i]}`)
    }
  }) 