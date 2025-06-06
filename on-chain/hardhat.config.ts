import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import '@nomicfoundation/hardhat-ethers'
import 'cofhe-hardhat-plugin'
import * as dotenv from 'dotenv'
import 'hardhat-contract-sizer';
import './tasks'

dotenv.config()

const config: HardhatUserConfig = {
	solidity: {
		version: '0.8.25',
		settings: {
			optimizer: {
				enabled: true,
				runs: 200
			},
			// Enable viaIR to avoid stack too deep errors
			viaIR: true,
			evmVersion: 'cancun'
		}
	},
	defaultNetwork: 'hardhat',
	// defaultNetwork: 'localcofhe',
	networks: {
		// The plugin already provides localcofhe configuration
		'localcofhe': {
			url: process.env.LOCALCOFHE_RPC_URL || 'http://localhost:42069',
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 420105,
			gasMultiplier: 1.2,
			timeout: 60000,
			httpHeaders: {}
		},

		hardhat: { hardfork: "cancun" },

		// Sepolia testnet configuration
		'eth-sepolia': {
			url: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 11155111,
			gasMultiplier: 1.2,
			timeout: 60000,
			httpHeaders: {},
		},

		// Arbitrum Sepolia testnet configuration
		'arb-sepolia': {
			url: process.env.ARBITRUM_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc',
			accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
			chainId: 421614,
			gasMultiplier: 1.2,
			timeout: 60000,
			httpHeaders: {},
		},
	},

	contractSizer: { runOnCompile: true, strict: true },

	// Optional: Add Etherscan verification config
	etherscan: {
		apiKey: {
			'eth-sepolia': process.env.ETHERSCAN_API_KEY || '',
			'arb-sepolia': process.env.ARBISCAN_API_KEY || '',
		},
	}
}

export default config
