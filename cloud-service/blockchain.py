from web3 import Web3
import json
import asyncio
import os
import logging
from config import FACTORY_CONTRACT_ADDRESS, RPC_URL, STARTING_BLOCK
from db import save_tournament, save_group, save_last_processed_block, get_last_processed_block
# Import the updated broadcast manager
from websocket import active_ws_manager

# Get logger
logger = logging.getLogger("blockchain")

# We'll import this dynamically in each function to avoid circular imports
# from websocket import broadcast_blockchain_event

# Load the Factory ABI from the exported file
ABI_PATH = os.path.join(os.path.dirname(__file__), 'abi/factory-abi.json')
with open(ABI_PATH, 'r') as f:
    FACTORY_ABI = json.load(f)

# Connect to Ethereum node
web3 = Web3(Web3.HTTPProvider(RPC_URL))

# Initialize contract
factory_contract = web3.eth.contract(address=FACTORY_CONTRACT_ADDRESS, abi=FACTORY_ABI)

async def watch_events():
    """Watch for Factory contract events"""
    logger.info(f"Starting to watch events from Factory contract at {FACTORY_CONTRACT_ADDRESS}")
    
    # Get current block
    current_block = web3.eth.block_number
    logger.info(f"Current block: {current_block}")
    
    # Check if we have a last processed block
    last_processed_block = get_last_processed_block()
    if last_processed_block is not None:
        # Start from the block after the last processed block
        start_block = last_processed_block + 1
        logger.info(f"Resuming from block {start_block} (last processed: {last_processed_block})")
    else:
        # First run, use the specified starting block from config
        start_block = STARTING_BLOCK
        # If STARTING_BLOCK is 0, we process from genesis to current
        # If STARTING_BLOCK is negative, we process the last N blocks
        # If STARTING_BLOCK is positive, we process from that specific block
        
        if STARTING_BLOCK < 0:
            # Process the last N blocks
            start_block = max(0, current_block + STARTING_BLOCK)
            logger.info(f"First run, processing the last {abs(STARTING_BLOCK)} blocks (from {start_block})")
        elif STARTING_BLOCK == 0:
            # Process from genesis (might be slow for production chains)
            logger.info(f"First run, processing from genesis (block 0)")
        else:
            # Process from specific block
            logger.info(f"First run, processing from specified block: {start_block}")
    
    # Process events starting from the determined block
    if start_block <= current_block:
        await process_past_events(current_block, start_block)
    
    # Store the current block as the last processed
    save_last_processed_block(current_block)
    
    # Watch for new events
    while True:
        try:
            new_block = web3.eth.block_number
            if new_block > current_block:
                logger.info(f"New blocks: {current_block+1} to {new_block}")
                await process_new_events(current_block + 1, new_block)
                current_block = new_block
                
                # Store the updated current block as the last processed
                save_last_processed_block(current_block)
        except Exception as e:
            logger.error(f"Error watching events: {e}", exc_info=True)
        
        # Wait before checking for new blocks
        await asyncio.sleep(10)

async def process_past_events(to_block, from_block=0):
    """Process past events"""
    logger.info(f"Processing past events from block {from_block} to {to_block}")
    
    # Get past tournament created events
    tournament_events = factory_contract.events.TournamentCreated.get_logs(
        fromBlock=from_block,
        toBlock=to_block
    )
    
    # Process events asynchronously in the background
    for event in tournament_events:
        await process_tournament_created(event)
    
    # Get past betting group created events
    group_events = factory_contract.events.BettingGroupCreated.get_logs(
        fromBlock=from_block,
        toBlock=to_block
    )
    
    for event in group_events:
        await process_betting_group_created(event)
    
    logger.info(f"Processed {len(tournament_events)} tournament events and {len(group_events)} group events")

async def process_new_events(from_block, to_block):
    """Process new events"""
    await process_past_events(to_block, from_block)
    
    # Broadcast block event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="block",
        message=f"New blocks processed: {from_block} to {to_block}",
        data={
            "from_block": from_block,
            "to_block": to_block
        }
    )

async def process_tournament_created(event):
    """Process TournamentCreated event"""
    args = event['args']
    
    # Extract event data
    tournament_address = args['tournamentAddress']
    description = args['description']
    start_time = args['startTime']
    end_time = args['endTime']
    betting_opportunities = args['bettingOpportunities']
    
    # Prepare data for storage
    tournament_data = {
        'description': description,
        'start_time': str(start_time),
        'end_time': str(end_time),
        'betting_opportunities_count': str(len(betting_opportunities)),
        'event_block': str(event['blockNumber']),
        'event_tx': event['transactionHash'].hex()
    }
    
    # Store in Redis
    save_tournament(tournament_address, tournament_data)
    logger.info(f"Saved tournament {tournament_address}: {description}")
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="tournament",
        message=f"New tournament created: {description[:30]}{'...' if len(description) > 30 else ''}",
        data={
            "address": tournament_address,
            "description": description,
            "tx_hash": event['transactionHash'].hex()
        }
    )

async def process_betting_group_created(event):
    """Process BettingGroupCreated event"""
    args = event['args']
    
    # Extract event data
    group_address = args['bettingGroupAddress']
    tournament_address = args['tournamentContract']
    description = args['description']
    registration_end_time = args['registrationEndTime']
    prize_distribution = args['prizeDistribution']
    general_closing_window = args['generalClosingWindowInSeconds']
    
    # Prepare data for storage
    group_data = {
        'description': description,
        'tournament_address': tournament_address,
        'registration_end_time': str(registration_end_time),
        'prize_distribution': ','.join(str(p) for p in prize_distribution),
        'general_closing_window': str(general_closing_window),
        'event_block': str(event['blockNumber']),
        'event_tx': event['transactionHash'].hex()
    }
    
    # Store in Redis
    save_group(group_address, group_data)
    logger.info(f"Saved betting group {group_address}: {description} for tournament {tournament_address}")
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="group",
        message=f"New betting group created: {description[:30]}{'...' if len(description) > 30 else ''}",
        data={
            "address": group_address,
            "tournament_address": tournament_address,
            "description": description,
            "tx_hash": event['transactionHash'].hex()
        }
    ) 