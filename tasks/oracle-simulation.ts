import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

/**
 * Oracle Simulation Tasks
 * 
 * These tasks simulate the behavior of an oracle system that would feed
 * real-world data into the Championship contract.
 */

// Task to update betting opportunity start time
task('update-bet-start-time', 'Update the start time for a betting opportunity')
  .addParam('championship', 'Championship contract address')
  .addParam('betid', 'Betting opportunity ID')
  .addParam('starttime', 'Start time (timestamp, must be > 0)')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the championship contract
    const championship = await ethers.getContractAt('Championship', taskArgs.championship, signer)
    
    console.log(`Oracle: Updating start time for betting opportunity ${taskArgs.betid}...`)
    
    // Update start time
    const tx = await championship.updateBettingOpportunityStartTime(
      taskArgs.betid,
      taskArgs.starttime
    )
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Oracle: Start time updated for betting opportunity ${taskArgs.betid} to ${new Date(parseInt(taskArgs.starttime) * 1000).toISOString()}`)
  })

// Task to set results for a betting opportunity
task('set-results', 'Set results for a betting opportunity')
  .addParam('championship', 'Championship contract address')
  .addParam('betid', 'Betting opportunity ID')
  .addParam('positions', 'Top positions (competitor IDs), comma-separated')
  .addParam('endtime', 'End time (timestamp) of the betting opportunity')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers } = hre

    // Get the signer account
    const [signer] = await ethers.getSigners()
    
    // Connect to the championship contract
    const championship = await ethers.getContractAt('Championship', taskArgs.championship, signer)
    
    console.log(`Oracle: Setting results for betting opportunity ${taskArgs.betid}...`)
    
    // Parse positions
    const topPositions = taskArgs.positions.split(',').map((position: string) => parseInt(position.trim()))
    
    // Set results
    const tx = await championship.setResults(
      taskArgs.betid, 
      topPositions, 
      taskArgs.endtime
    )
    const receipt = await tx.wait()
    
    if (receipt) {
      console.log(`Transaction hash: ${receipt.hash}`)
    }
    console.log(`Oracle: Results set for betting opportunity ${taskArgs.betid}`)
    console.log(`Positions: ${topPositions.join(', ')}`)
    console.log(`End time: ${new Date(parseInt(taskArgs.endtime) * 1000).toISOString()}`)
  }) 