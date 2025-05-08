import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

// Task to deploy the Championship contract
task('deploy-championship', 'Deploy the Championship contract to the selected network')
  .addParam('name', 'Championship name')
  .addParam('description', 'Championship description')
  .addParam('startdate', 'Championship start date (timestamp)')
  .addParam('enddate', 'Championship end date (timestamp)')
  .addParam('competitors', 'JSON string of competitors array [{id, name}, ...]')
  .addParam('bets', 'JSON string of betting opportunities array [{id, name, description, startTime, pointValues}, ...]')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    console.log(`Deploying Championship to ${network.name}...`)

    // Get the deployer account
    const [deployer] = await ethers.getSigners()
    console.log(`Deploying with account: ${deployer.address}`)

    // Parse competitors and betting opportunities
    const competitors = JSON.parse(taskArgs.competitors)
    const bettingOpportunities = JSON.parse(taskArgs.bets)

    // Make sure all betting opportunities have necessary fields
    for (const bet of bettingOpportunities) {
      bet.resultsFinalized = false;
      bet.endTime = 0; // endTime will be set when results are finalized

      // Ensure startTime is provided, defaulting to 0 if not known yet
      if (!bet.startTime) {
        bet.startTime = 0;
      }

      // Ensure pointValues are provided as arrays of 3 elements
      if (!bet.pointValues || !Array.isArray(bet.pointValues) || bet.pointValues.length !== 3) {
        console.log(`Setting default point values (10,5,2) for bet ${bet.id} - ${bet.name}`);
        bet.pointValues = [10, 5, 2]; // Default values if not provided or incorrect
      }
    }

    console.log(`Deploying with ${competitors.length} competitors and ${bettingOpportunities.length} betting opportunities`);

    // Deploy the contract
    const Championship = await ethers.getContractFactory('Championship')
    const championship = await Championship.deploy(
      taskArgs.name,
      taskArgs.description,
      taskArgs.startdate,
      taskArgs.enddate,
      competitors,
      bettingOpportunities
    )
    await championship.waitForDeployment()

    const championshipAddress = await championship.getAddress()
    console.log(`Championship deployed to: ${championshipAddress}`)

    // Save the deployment
    saveDeployment(network.name, 'Championship', championshipAddress)

    return championshipAddress
  }) 