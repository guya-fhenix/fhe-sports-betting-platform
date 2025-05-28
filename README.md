# FHE Sports Betting Platform

A fully homomorphic encryption (FHE) powered sports betting platform built with Fhenix CoFHE, featuring private betting, encrypted scoring, and secure prize distribution.

## 🏗️ Architecture

The platform consists of three main components:

- **on-chain**: Smart contracts built with Fhenix CoFHE for encrypted betting logic
- **cloud-service**: Python FastAPI backend for tournament management and blockchain interaction
- **web-app**: React frontend with Chakra UI for user interaction

## 🚀 Local Development Setup

This guide will help you run the entire platform locally using the mock FHE environment.

### Prerequisites

- **Node.js** (v20 or higher)
- **pnpm** (recommended package manager)
- **Python** (v3.12 or higher)
- **Docker** and **Docker Compose**
- **Git**

Install pnpm globally if you haven't already:
```bash
npm install -g pnpm
```

### 📋 Quick Start

Follow these steps in order to get the full platform running:

## 1. 🔗 On-Chain Setup (Smart Contracts)

Navigate to the on-chain directory and set up the blockchain environment:

```bash
cd on-chain
```

### Install Dependencies
```bash
pnpm install
```

### Compile Smart Contracts
```bash
pnpm compile
```
This compiles all smart contracts including:
- `BettingGroup.sol` - Main betting logic with FHE encryption
- `Tournament.sol` - Tournament management
- `Factory.sol` - Contract deployment factory

### Start Local Hardhat Node
```bash
npx hardhat node
```
This starts a local Ethereum node on `http://localhost:8545` with pre-funded accounts. Keep this terminal running.

### Deploy Contracts (New Terminal)
Open a new terminal and deploy the factory contract:
```bash
cd on-chain
npx hardhat deploy-factory --network localhost
```

### Export Contract Data
Export ABIs and addresses for the frontend and backend:
```bash
./scripts/export-all.sh localhost
```
This script:
- Exports contract ABIs to `../web-app/src/config/`
- Exports deployed addresses to `../cloud-service/abi/`
- Creates TypeScript type definitions

## 2. ☁️ Cloud Service Setup (Backend API)

Navigate to the cloud-service directory:

```bash
cd ../cloud-service
```

### Install Python Dependencies
```bash
pip install -r requirements.txt
```

Alternatively, use a virtual environment (recommended):
```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Start Redis Database
```bash
docker-compose up -d
```
This starts a Redis instance on port 6379 for caching and session management.

### Start the API Service
```bash
python start.py
```
The API server will start on `http://localhost:8000` with:
- REST API endpoints for tournament management
- WebSocket support for real-time updates
- Blockchain interaction services

## 3. 🌐 Web App Setup (Frontend)

Navigate to the web-app directory:

```bash
cd ../web-app
```

### Install Dependencies
```bash
pnpm install
```

### Start Development Server
```bash
pnpm run dev
```
The web application will be available at `http://localhost:5173` with:
- Tournament browsing and creation
- Betting group management
- Encrypted betting interface
- Real-time updates via WebSocket

## 🔧 Component Details

### On-Chain (Smart Contracts)

**Key Files:**
- `contracts/BettingGroup.sol` - Core betting logic with FHE encryption
- `contracts/Tournament.sol` - Tournament and betting opportunity management
- `contracts/Factory.sol` - Contract deployment and management
- `tasks/deploy-factory.ts` - Deployment task
- `scripts/export-all.sh` - Export script for ABIs and addresses

**Available Scripts:**
- `pnpm compile` - Compile contracts
- `pnpm test` - Run contract tests
- `npx hardhat node` - Start local blockchain
- `npx hardhat deploy-factory --network localhost` - Deploy factory

### Cloud Service (Backend)

**Key Files:**
- `start.py` - Application entry point
- `main.py` - FastAPI application and routes
- `blockchain.py` - Web3 integration and contract interaction
- `websocket.py` - Real-time WebSocket handlers
- `docker-compose.yml` - Redis database configuration

**Features:**
- Tournament CRUD operations
- Betting group management
- Real-time blockchain event monitoring
- WebSocket notifications
- Redis caching

### Web App (Frontend)

**Key Files:**
- `src/App.tsx` - Main application component
- `src/components/` - React components
- `src/services/api.ts` - Backend API integration
- `src/config/` - Contract ABIs and addresses (auto-generated)

**Features:**
- Responsive UI with Chakra UI
- MetaMask wallet integration
- FHE encryption for private betting
- Real-time updates
- Tournament and betting management

## 🧪 Testing the Platform

Once all components are running:

1. **Access the Web App**: Open `http://localhost:5173`
2. **Connect Wallet**: Use MetaMask with the local network (Chain ID: 31337)
3. **Import Test Account**: Use one of the private keys from the Hardhat node
4. **Create Tournament**: Use the admin interface to create a new tournament
5. **Create Betting Group**: Set up a betting group for the tournament
6. **Place Bets**: Register and place encrypted bets
7. **Process Results**: Admin can finalize results and distribute prizes

## 🔍 Verification Steps

### Check On-Chain Status
```bash
# In on-chain directory
npx hardhat console --network localhost
```

### Check API Status
```bash
curl http://localhost:8000/health
```

### Check Frontend Status
Open `http://localhost:5173` in your browser

## 🛠️ Troubleshooting

### Common Issues

**Port Conflicts:**
- Hardhat node: 8545
- API service: 8000
- Frontend: 5173
- Redis: 6379

**Contract Deployment Issues:**
- Ensure Hardhat node is running before deployment
- Check that the export script runs successfully
- Verify contract addresses are exported correctly

**Frontend Connection Issues:**
- Ensure MetaMask is connected to localhost:8545
- Import a test account from Hardhat node
- Check that contract ABIs are properly exported

**Backend API Issues:**
- Verify Redis is running: `docker ps`
- Check Python dependencies are installed
- Ensure contract addresses are available in `abi/` directory

## 📁 Project Structure

```
fhe-sports-betting-platform/
├── on-chain/                 # Smart contracts (Hardhat)
│   ├── contracts/           # Solidity contracts
│   ├── scripts/            # Deployment and export scripts
│   ├── tasks/              # Hardhat tasks
│   └── package.json        # Node.js dependencies
├── cloud-service/           # Backend API (Python)
│   ├── main.py             # FastAPI application
│   ├── blockchain.py       # Web3 integration
│   ├── requirements.txt    # Python dependencies
│   └── docker-compose.yml  # Redis configuration
├── web-app/                # Frontend (React + Vite)
│   ├── src/               # React source code
│   ├── public/            # Static assets
│   └── package.json       # Node.js dependencies
└── README.md              # This file
```

## 🔐 Security Features

- **Fully Homomorphic Encryption**: All bets are encrypted using Fhenix CoFHE
- **Private Scoring**: Points calculation happens on encrypted data
- **Secure Prize Distribution**: Winners determined without revealing individual bets
- **Decentralized Architecture**: Smart contracts ensure trustless operation

---

**Happy Betting! 🎯**
