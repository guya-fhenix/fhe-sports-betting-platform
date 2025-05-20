import { task } from 'hardhat/config'
import { HardhatRuntimeEnvironment } from 'hardhat/types'
import { saveDeployment } from './utils'

// Task to deploy the Factory contract
task('deploy-factory', 'Deploy the Factory contract to the selected network')
  .setAction(async (taskArgs, hre: HardhatRuntimeEnvironment) => {
    const { ethers, network } = hre

    console.log(`Deploying Factory to ${network.name}...`)

    // Get the deployer account
    const [deployer] = await ethers.getSigners()
    console.log(`Deploying with account: ${deployer.address}`)

    // Deploy the contract
    const Factory = await ethers.getContractFactory('Factory')
    const factory = await Factory.deploy()
    await factory.waitForDeployment()

    const factoryAddress = await factory.getAddress()
    console.log(`Factory deployed to: ${factoryAddress}`)

    // Save the deployment
    saveDeployment(network.name, 'Factory', factoryAddress)

    return factoryAddress
  }) 