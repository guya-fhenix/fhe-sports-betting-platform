from web3 import Web3
import json
import asyncio
import os
import logging
import requests
from config import FACTORY_CONTRACT_ADDRESS, RPC_URL, STARTING_BLOCK
from db import (
    save_tournament, save_group, save_last_processed_block, get_last_processed_block,
    add_known_tournament, add_known_betting_group, get_known_tournaments, get_known_betting_groups,
    add_user_to_group, remove_user_from_group, get_user_groups, is_user_in_group, get_group_users
)
# Import the updated broadcast manager
from websocket import active_ws_manager

# Get logger
logger = logging.getLogger("blockchain")

# We'll import this dynamically in each function to avoid circular imports
# from websocket import broadcast_blockchain_event

# Load the ABIs from the exported files
ABI_PATH = os.path.join(os.path.dirname(__file__), 'abi')

# Load Factory ABI
with open(os.path.join(ABI_PATH, 'factory-abi.json'), 'r') as f:
    FACTORY_ABI = json.load(f)

# Load Tournament ABI
with open(os.path.join(ABI_PATH, 'tournament-abi.json'), 'r') as f:
    TOURNAMENT_ABI = json.load(f)

# Load BettingGroup ABI
with open(os.path.join(ABI_PATH, 'bettinggroup-abi.json'), 'r') as f:
    BETTING_GROUP_ABI = json.load(f)

# Connect to Ethereum node
web3 = Web3(Web3.HTTPProvider(RPC_URL))

# Initialize factory contract
factory_contract = web3.eth.contract(address=FACTORY_CONTRACT_ADDRESS, abi=FACTORY_ABI)

# Cache for ETH price to avoid too many API calls
eth_price_cache = {"price": None, "timestamp": 0}
ETH_PRICE_CACHE_DURATION = 600  # 10 minutes (increased from 5 to reduce API calls)

async def get_eth_price_usd():
    """Get current ETH price in USD with caching"""
    import time
    
    current_time = time.time()
    
    # Check if we have a cached price that's still valid
    if (eth_price_cache["price"] is not None and 
        current_time - eth_price_cache["timestamp"] < ETH_PRICE_CACHE_DURATION):
        logger.debug(f"Using cached ETH price: ${eth_price_cache['price']}")
        return eth_price_cache["price"]
    
    # Try to fetch fresh price with retry logic
    max_retries = 3
    retry_delay = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            if attempt > 0:
                logger.info(f"Retrying ETH price fetch (attempt {attempt + 1}/{max_retries})...")
                await asyncio.sleep(retry_delay * attempt)  # Exponential backoff
            
            logger.debug("Fetching fresh ETH price from CoinGecko API...")
            
            # Use CoinGecko API to get ETH price
            response = requests.get(
                "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
                timeout=15,  # Increased timeout
                headers={
                    'User-Agent': 'FHE-Sports-Betting-Platform/1.0',
                    'Accept': 'application/json'
                }
            )
            
            # Handle rate limiting specifically
            if response.status_code == 429:
                logger.warning(f"Rate limited by CoinGecko API (attempt {attempt + 1})")
                if attempt < max_retries - 1:
                    continue  # Try again with backoff
                else:
                    raise requests.exceptions.RequestException("Rate limited after all retries")
            
            response.raise_for_status()
            data = response.json()
            
            if 'ethereum' not in data or 'usd' not in data['ethereum']:
                raise ValueError("Invalid response format from CoinGecko API")
            
            price = data["ethereum"]["usd"]
            
            if not isinstance(price, (int, float)) or price <= 0:
                raise ValueError(f"Invalid price value: {price}")
            
            # Update cache
            eth_price_cache["price"] = price
            eth_price_cache["timestamp"] = current_time
            
            logger.info(f"Updated ETH price: ${price}")
            return price
            
        except requests.exceptions.RequestException as e:
            logger.warning(f"Network error fetching ETH price (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                break
        except (ValueError, KeyError) as e:
            logger.warning(f"Data error fetching ETH price (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                break
        except Exception as e:
            logger.error(f"Unexpected error fetching ETH price (attempt {attempt + 1}): {e}")
            if attempt == max_retries - 1:
                break
    
    # Return cached price if available, otherwise return None
    if eth_price_cache["price"] is not None:
        logger.info(f"Using stale cached ETH price due to fetch error: ${eth_price_cache['price']}")
        return eth_price_cache["price"]
    else:
        logger.warning("No ETH price available (no cache and fetch failed)")
        return None

async def get_transaction_gas_info(tx_hash):
    """Get gas information for a transaction"""
    try:
        logger.debug(f"Getting gas info for transaction: {tx_hash.hex() if hasattr(tx_hash, 'hex') else tx_hash}")
        
        # Convert tx_hash to proper format if needed
        if hasattr(tx_hash, 'hex'):
            tx_hash_str = tx_hash.hex()
        else:
            tx_hash_str = tx_hash
        
        # Get transaction receipt
        tx_receipt = web3.eth.get_transaction_receipt(tx_hash_str)
        
        # Get transaction details
        tx = web3.eth.get_transaction(tx_hash_str)
        
        # Calculate gas costs
        gas_used = tx_receipt.gasUsed
        gas_price = tx.gasPrice  # in wei
        gas_cost_wei = gas_used * gas_price
        gas_cost_eth = web3.from_wei(gas_cost_wei, 'ether')
        
        # Get ETH price for USD calculation
        eth_price_usd = await get_eth_price_usd()
        gas_cost_usd = float(gas_cost_eth) * eth_price_usd if eth_price_usd else None
        
        gas_info = {
            "gas_used": gas_used,
            "gas_price_gwei": float(web3.from_wei(gas_price, 'gwei')),
            "gas_cost_eth": float(gas_cost_eth),
            "gas_cost_usd": gas_cost_usd,
            "eth_price_usd": eth_price_usd
        }
        
        logger.debug(f"Gas info calculated: {gas_info}")
        return gas_info
        
    except Exception as e:
        logger.error(f"Error getting gas info for transaction {tx_hash}: {e}")
        return None

# Function to get tournament contract
def get_tournament_contract(address):
    """Get a Tournament contract instance"""
    return web3.eth.contract(address=address, abi=TOURNAMENT_ABI)

# Function to get betting group contract
def get_betting_group_contract(address):
    """Get a BettingGroup contract instance"""
    return web3.eth.contract(address=address, abi=BETTING_GROUP_ABI)

# Function to get user's betting groups
def get_user_betting_groups(user_address):
    """Get the betting groups a user is registered for"""
    return get_user_groups(user_address)

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
    
    # Verify and sync user-group mappings to ensure Redis is accurate
    logger.info("Verifying and syncing user-group mappings...")
    await verify_all_user_group_mappings()
    logger.info("User-group mapping verification complete")
    
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
    
    # Process events from known tournaments
    known_tournaments = get_known_tournaments()
    logger.info(f"Processing events for {len(known_tournaments)} known tournaments")
    for tournament_address in known_tournaments:
        await process_tournament_contract_events(tournament_address, from_block, to_block)
    
    # Process events from known betting groups
    known_betting_groups = get_known_betting_groups()
    logger.info(f"Processing events for {len(known_betting_groups)} known betting groups")
    for group_address in known_betting_groups:
        await process_betting_group_contract_events(group_address, from_block, to_block)
    
    logger.info(f"Processed {len(tournament_events)} tournament events and {len(group_events)} group events")

async def process_tournament_contract_events(tournament_address, from_block, to_block):
    """Process events from a Tournament contract"""
    try:
        # Get tournament contract
        tournament_contract = get_tournament_contract(tournament_address)
        
        # Get BettingOpportunityStartTimeUpdated events
        start_time_events = tournament_contract.events.BettingOpportunityStartTimeUpdated.get_logs(
            fromBlock=from_block,
            toBlock=to_block
        )
        
        for event in start_time_events:
            await process_betting_opportunity_start_time_updated(tournament_address, event)
        
        # Process any other tournament events here
        
    except Exception as e:
        logger.error(f"Error processing tournament events: {e}", exc_info=True)

async def process_betting_group_contract_events(group_address, from_block, to_block):
    """Process events from a BettingGroup contract"""
    try:
        logger.info(f"Processing events for betting group {group_address} from block {from_block} to {to_block}")
        
        # Get betting group contract
        group_contract = get_betting_group_contract(group_address)
        
        # Get ParticipantRegistered events
        try:
            registration_events = group_contract.events.ParticipantRegistered.get_logs(
                fromBlock=from_block,
                toBlock=to_block
            )
            logger.info(f"Found {len(registration_events)} ParticipantRegistered events for group {group_address}")
            
            for event in registration_events:
                await process_participant_registered(group_address, event)
        except Exception as e:
            logger.error(f"Error processing registration events for group {group_address}: {e}", exc_info=True)
        
        # Get ParticipantWithdrawn events
        try:
            withdrawal_events = group_contract.events.ParticipantWithdrawn.get_logs(
                fromBlock=from_block,
                toBlock=to_block
            )
            logger.info(f"Found {len(withdrawal_events)} ParticipantWithdrawn events for group {group_address}")
            
            for event in withdrawal_events:
                await process_participant_withdrawn(group_address, event)
        except Exception as e:
            logger.error(f"Error processing withdrawal events for group {group_address}: {e}", exc_info=True)
        
        # Get ResultsProcessed events
        try:
            results_events = group_contract.events.ResultsProcessed.get_logs(
                fromBlock=from_block,
                toBlock=to_block
            )
            logger.info(f"Found {len(results_events)} ResultsProcessed events for group {group_address}")
            
            for event in results_events:
                await process_results_processed(group_address, event)
        except Exception as e:
            logger.error(f"Error processing results events for group {group_address}: {e}", exc_info=True)
        
        # Process BettingGroupFinalized events
        try:
            finalized_events = group_contract.events.BettingGroupFinalized.get_logs(
                fromBlock=from_block,
                toBlock=to_block
            )
            logger.info(f"Found {len(finalized_events)} BettingGroupFinalized events for group {group_address}")
            
            for event in finalized_events:
                await process_betting_group_finalized(group_address, event)
        except Exception as e:
            logger.error(f"Error processing finalized events for group {group_address}: {e}", exc_info=True)
        
        # Process BettingGroupCancelled events
        try:
            cancelled_events = group_contract.events.BettingGroupCancelled.get_logs(
                fromBlock=from_block,
                toBlock=to_block
            )
            logger.info(f"Found {len(cancelled_events)} BettingGroupCancelled events for group {group_address}")
            
            for event in cancelled_events:
                await process_betting_group_cancelled(group_address, event)
        except Exception as e:
            logger.error(f"Error processing cancelled events for group {group_address}: {e}", exc_info=True)
        
        # Force a sync of user-group mappings to ensure Redis is up-to-date
        await sync_user_group_mappings(group_address)
        
    except Exception as e:
        logger.error(f"Error processing betting group events: {e}", exc_info=True)
        # Try to recover by syncing user-group mappings directly
        try:
            await sync_user_group_mappings(group_address)
        except Exception as sync_error:
            logger.error(f"Error during recovery sync for group {group_address}: {sync_error}", exc_info=True)

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
    start_time = args['startTime']  # Blockchain timestamps are in UTC
    end_time = args['endTime']  # Blockchain timestamps are in UTC
    betting_opportunities = args['bettingOpportunities']
    
    # Add tournament to known tournaments for event watching
    add_known_tournament(tournament_address)
    
    # Get gas information
    tx_hash = event['transactionHash']
    gas_info = await get_transaction_gas_info(tx_hash)
    
    # Prepare data for storage - store timestamps as UTC seconds
    tournament_data = {
        'description': description,
        'start_time': str(start_time),  # Store as UTC timestamp (seconds)
        'end_time': str(end_time),  # Store as UTC timestamp (seconds)
        'betting_opportunities_count': str(len(betting_opportunities)),
        'event_block': str(event['blockNumber']),
        'event_tx': event['transactionHash'].hex()
    }
    
    # Store in Redis
    save_tournament(tournament_address, tournament_data)
    logger.info(f"Saved tournament {tournament_address}: {description} with UTC timestamps")
    
    # Prepare broadcast data
    broadcast_data = {
        "address": tournament_address,
        "description": description,
        "tx_hash": event['transactionHash'].hex()
    }
    
    # Add gas information if available
    if gas_info:
        broadcast_data["gas_info"] = gas_info
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="tournament",
        message=f"New tournament created: {description[:30]}{'...' if len(description) > 30 else ''}",
        data=broadcast_data
    )

async def process_betting_group_created(event):
    """Process BettingGroupCreated event"""
    args = event['args']
    
    # Extract event data
    group_address = args['bettingGroupAddress']
    tournament_address = args['tournamentContract']
    description = args['description']
    registration_end_time = args['registrationEndTime']  # Blockchain timestamps are in UTC
    prize_distribution = args['prizeDistribution']
    general_closing_window = args['generalClosingWindowInSeconds']
    
    # Add group to known betting groups for event watching
    add_known_betting_group(group_address)
    
    # Get gas information
    tx_hash = event['transactionHash']
    gas_info = await get_transaction_gas_info(tx_hash)
    
    # Prepare data for storage - store timestamps as UTC seconds
    group_data = {
        'description': description,
        'tournament_address': tournament_address,
        'registration_end_time': str(registration_end_time),  # Store as UTC timestamp (seconds)
        'prize_distribution': ','.join(str(p) for p in prize_distribution),
        'general_closing_window': str(general_closing_window),
        'event_block': str(event['blockNumber']),
        'event_tx': event['transactionHash'].hex()
    }
    
    # Store in Redis
    save_group(group_address, group_data)
    logger.info(f"Saved betting group {group_address}: {description} for tournament {tournament_address} with UTC timestamps")
    
    # Prepare broadcast data
    broadcast_data = {
        "address": group_address,
        "tournament_address": tournament_address,
        "description": description,
        "tx_hash": event['transactionHash'].hex()
    }
    
    # Add gas information if available
    if gas_info:
        broadcast_data["gas_info"] = gas_info
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="group",
        message=f"New betting group created: {description[:30]}{'...' if len(description) > 30 else ''}",
        data=broadcast_data
    )

async def process_betting_opportunity_start_time_updated(tournament_address, event):
    """Process BettingOpportunityStartTimeUpdated event"""
    args = event['args']
    
    # Extract event data
    bet_id = args['id']
    start_time = args['startTime']
    
    # Get gas information
    gas_info = await get_transaction_gas_info(event['transactionHash'])
    
    # Get tournament data to include in the broadcast
    tournament_data = None
    try:
        tournament_contract = get_tournament_contract(tournament_address)
        description = await tournament_contract.functions.description().call()
        tournament_data = {
            'address': tournament_address,
            'description': description,
        }
    except Exception as e:
        logger.error(f"Error getting tournament data: {e}")
        tournament_data = {'address': tournament_address}
    
    # Prepare broadcast data
    broadcast_data = {
        "tournament": tournament_data,
        "bet_id": bet_id,
        "start_time": start_time,
        "tx_hash": event['transactionHash'].hex()
    }
    
    # Add gas information if available
    if gas_info:
        broadcast_data["gas_info"] = gas_info
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="betting_opportunity_updated",
        message=f"Betting opportunity #{bet_id} start time updated",
        data=broadcast_data
    )

async def process_participant_registered(group_address, event):
    """Process ParticipantRegistered event"""
    try:
        args = event['args']
        
        # Extract event data
        participant_address = args['participant']
        name = args['name']
        
        # Update user_groups mapping in Redis
        success = add_user_to_group(participant_address, group_address)
        logger.info(f"User {participant_address} registered in group {group_address} as '{name}'. Redis update status: {success}")
        
        # Double-check on blockchain to ensure data consistency
        is_registered = await is_user_registered_in_group_blockchain(participant_address, group_address)
        if is_registered:
            logger.info(f"Verified on blockchain: user {participant_address} is registered in group {group_address}")
        else:
            logger.warning(f"Blockchain verification failed: user {participant_address} appears not registered in group {group_address} despite event")
            # Force update Redis again
            add_user_to_group(participant_address, group_address)
        
        # Get group data to include in the broadcast
        group_data = None
        try:
            group_contract = get_betting_group_contract(group_address)
            description = await group_contract.functions.description().call()
            tournament_address = await group_contract.functions.tournamentContract().call()
            group_data = {
                'address': group_address,
                'description': description,
                'tournament_address': tournament_address
            }
        except Exception as e:
            logger.error(f"Error getting group data: {e}")
            group_data = {'address': group_address}
        
        # Get transaction details
        tx_hash = event['transactionHash'].hex()
        block_number = event['blockNumber']
        
        # Get gas information
        gas_info = await get_transaction_gas_info(event['transactionHash'])
        
        # Prepare broadcast data
        broadcast_data = {
            "group": group_data,
            "participant": participant_address,
            "name": name,
            "tx_hash": tx_hash,
            "block_number": block_number
        }
        
        # Add gas information if available
        if gas_info:
            broadcast_data["gas_info"] = gas_info
        
        # Broadcast event via Socket.IO
        await active_ws_manager.broadcast_blockchain_event(
            event_type="participant_registered",
            message=f"Participant {name} registered for betting group",
            data=broadcast_data
        )
    except Exception as e:
        logger.error(f"Error in process_participant_registered: {e}", exc_info=True)

async def process_participant_withdrawn(group_address, event):
    """Process ParticipantWithdrawn event"""
    try:
        args = event['args']
        
        # Extract event data
        participant_address = args['participant']
        
        # Update user_groups mapping in Redis
        removed = remove_user_from_group(participant_address, group_address)
        logger.info(f"User {participant_address} withdrawn from group {group_address}. Redis removal status: {removed}")
        
        # Double-check on blockchain to ensure data consistency
        is_registered = await is_user_registered_in_group_blockchain(participant_address, group_address)
        if not is_registered:
            logger.info(f"Verified on blockchain: user {participant_address} is no longer registered in group {group_address}")
        else:
            logger.warning(f"Blockchain verification failed: user {participant_address} still appears registered in group {group_address} despite withdrawal event")
            # Try to force remove from Redis again
            remove_user_from_group(participant_address, group_address)
        
        # Get group data to include in the broadcast
        group_data = None
        try:
            group_contract = get_betting_group_contract(group_address)
            description = await group_contract.functions.description().call()
            tournament_address = await group_contract.functions.tournamentContract().call()
            group_data = {
                'address': group_address,
                'description': description,
                'tournament_address': tournament_address
            }
        except Exception as e:
            logger.error(f"Error getting group data: {e}")
            group_data = {'address': group_address}
        
        # Get transaction details
        tx_hash = event['transactionHash'].hex()
        block_number = event['blockNumber']
        
        # Get gas information
        gas_info = await get_transaction_gas_info(event['transactionHash'])
        
        # Prepare broadcast data
        broadcast_data = {
            "group": group_data,
            "participant": participant_address,
            "tx_hash": tx_hash,
            "block_number": block_number
        }
        
        # Add gas information if available
        if gas_info:
            broadcast_data["gas_info"] = gas_info
        
        # Broadcast event via Socket.IO
        await active_ws_manager.broadcast_blockchain_event(
            event_type="participant_withdrawn",
            message=f"Participant withdrawn from betting group",
            data=broadcast_data
        )
    except Exception as e:
        logger.error(f"Error in process_participant_withdrawn: {e}", exc_info=True)

async def process_results_processed(group_address, event):
    """Process ResultsProcessed event"""
    args = event['args']
    
    # Extract event data
    bet_id = args['betId']
    result = args['result']
    
    # Get gas information
    gas_info = await get_transaction_gas_info(event['transactionHash'])
    
    # Get group data to include in the broadcast
    group_data = None
    try:
        group_contract = get_betting_group_contract(group_address)
        description = await group_contract.functions.description().call()
        tournament_address = await group_contract.functions.tournamentContract().call()
        group_data = {
            'address': group_address,
            'description': description,
            'tournament_address': tournament_address
        }
    except Exception as e:
        logger.error(f"Error getting group data: {e}")
        group_data = {'address': group_address}
    
    # Prepare broadcast data
    broadcast_data = {
        "group": group_data,
        "bet_id": bet_id,
        "result": result,
        "tx_hash": event['transactionHash'].hex()
    }
    
    # Add gas information if available
    if gas_info:
        broadcast_data["gas_info"] = gas_info
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="results_processed",
        message=f"Results processed for betting opportunity #{bet_id}",
        data=broadcast_data
    )

async def process_betting_group_finalized(group_address, event):
    """Process BettingGroupFinalized event"""
    logger.info(f"Betting group {group_address} finalized")
    
    # Get gas information
    gas_info = await get_transaction_gas_info(event['transactionHash'])
    
    # Get group data to include in the broadcast
    group_data = None
    try:
        group_contract = get_betting_group_contract(group_address)
        description = await group_contract.functions.description().call()
        tournament_address = await group_contract.functions.tournamentContract().call()
        group_data = {
            'address': group_address,
            'description': description,
            'tournament_address': tournament_address
        }
    except Exception as e:
        logger.error(f"Error getting group data: {e}")
        group_data = {'address': group_address}
    
    # Prepare broadcast data
    broadcast_data = {
        "group": group_data,
        "tx_hash": event['transactionHash'].hex()
    }
    
    # Add gas information if available
    if gas_info:
        broadcast_data["gas_info"] = gas_info
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="betting_group_finalized",
        message=f"Betting group has been finalized",
        data=broadcast_data
    )

async def process_betting_group_cancelled(group_address, event):
    """Process BettingGroupCancelled event"""
    logger.info(f"Betting group {group_address} cancelled")
    
    # Get gas information
    gas_info = await get_transaction_gas_info(event['transactionHash'])
    
    # Get group data to include in the broadcast
    group_data = None
    try:
        group_contract = get_betting_group_contract(group_address)
        description = await group_contract.functions.description().call()
        tournament_address = await group_contract.functions.tournamentContract().call()
        group_data = {
            'address': group_address,
            'description': description,
            'tournament_address': tournament_address
        }
    except Exception as e:
        logger.error(f"Error getting group data: {e}")
        group_data = {'address': group_address}
    
    # Prepare broadcast data
    broadcast_data = {
        "group": group_data,
        "tx_hash": event['transactionHash'].hex()
    }
    
    # Add gas information if available
    if gas_info:
        broadcast_data["gas_info"] = gas_info
    
    # Broadcast event via Socket.IO
    await active_ws_manager.broadcast_blockchain_event(
        event_type="betting_group_cancelled",
        message=f"Betting group has been cancelled",
        data=broadcast_data
    )

# Function to check if a user is registered in a group via blockchain (for verification)
async def is_user_registered_in_group_blockchain(user_address, group_address):
    """Check if user is registered in a betting group by calling the smart contract directly"""
    try:
        group_contract = get_betting_group_contract(group_address)
        return await group_contract.functions.isRegistered(user_address).call()
    except Exception as e:
        logger.error(f"Error checking user registration on blockchain: {e}", exc_info=True)
        return False

# Function to sync Redis user-group mappings with blockchain data
async def sync_user_group_mappings(group_address):
    """Sync Redis user-group mappings with blockchain data for a specific group"""
    try:
        # Get the group contract
        group_contract = get_betting_group_contract(group_address)
        
        # Get participant count
        participant_count = await group_contract.functions.participantCount().call()
        logger.info(f"Syncing {group_address}: found {participant_count} participants to check")
        
        # Fetch all participant addresses
        participants = []
        for i in range(participant_count):
            try:
                participant_address = await group_contract.functions.participantAddresses(i).call()
                is_registered = await group_contract.functions.isRegistered(participant_address).call()
                logger.debug(f"Checking participant {participant_address}: registered={is_registered}")
                if is_registered:
                    participants.append(participant_address)
            except Exception as e:
                logger.error(f"Error fetching participant {i} for group {group_address}: {e}")
                continue
        
        # For each participant, ensure they are in Redis
        for participant in participants:
            added = add_user_to_group(participant, group_address)
            if added:
                logger.info(f"Added missing mapping: user {participant} to group {group_address}")
            
        # Check for stale entries in Redis
        try:
            # Get all users registered to this group in Redis
            all_users_in_group = await get_all_users_in_group(group_address)
            
            # Remove users who are no longer registered according to blockchain
            for user in all_users_in_group:
                if user not in participants:
                    removed = remove_user_from_group(user, group_address)
                    logger.info(f"Removed stale mapping: user {user} from group {group_address}, success={removed}")
        except Exception as e:
            logger.error(f"Error cleaning stale Redis entries: {e}")
            
        logger.info(f"Synced {len(participants)} participants for group {group_address}")
        return True
        
    except Exception as e:
        logger.error(f"Error syncing user-group mappings: {e}", exc_info=True)
        return False

# Helper function to get all users in a specific group from Redis
async def get_all_users_in_group(group_address):
    """Get all users registered in a specific betting group"""
    try:
        # Use the existing get_group_users function from db.py
        # which uses the reverse lookup that's already maintained
        users = get_group_users(group_address)
        return list(users)  # Convert set to list
    except Exception as e:
        logger.error(f"Error getting users in group {group_address}: {e}")
        return []

# Function to verify all users for all groups
async def verify_all_user_group_mappings():
    """Verify and fix all user-group mappings against blockchain data"""
    try:
        # Get all known betting groups
        known_groups = get_known_betting_groups()
        logger.info(f"Verifying user-group mappings for {len(known_groups)} groups")
        
        success_count = 0
        for group_address in known_groups:
            try:
                result = await sync_user_group_mappings(group_address)
                if result:
                    success_count += 1
            except Exception as e:
                logger.error(f"Error syncing group {group_address}: {e}")
                continue
                
        logger.info(f"Successfully synced {success_count} out of {len(known_groups)} groups")
        return success_count
        
    except Exception as e:
        logger.error(f"Error in verify_all_user_group_mappings: {e}", exc_info=True)
        return 0 