import redis
from config import REDIS_HOST, REDIS_PORT

# Redis connection
redis_client = redis.Redis(
    host=REDIS_HOST,
    port=REDIS_PORT,
    decode_responses=True
)

# Redis keys
TOURNAMENT_KEY_PREFIX = "tournament:"
GROUP_KEY_PREFIX = "group:"
TOURNAMENT_INDEX = "tournament_index"
GROUP_INDEX = "group_index"
LAST_PROCESSED_BLOCK_KEY = "blockchain:last_processed_block"

# Helper functions
def save_tournament(address, data):
    """Save tournament data to Redis"""
    # Save tournament details
    redis_client.hset(f"{TOURNAMENT_KEY_PREFIX}{address}", mapping=data)
    # Add to address index
    redis_client.sadd(TOURNAMENT_INDEX, address)
    # Add to description search index
    if "description" in data:
        description_words = data["description"].lower().split()
        for word in description_words:
            redis_client.sadd(f"tournament:word:{word}", address)

def save_group(address, data):
    """Save betting group data to Redis"""
    # Save group details
    redis_client.hset(f"{GROUP_KEY_PREFIX}{address}", mapping=data)
    # Add to address index
    redis_client.sadd(GROUP_INDEX, address)
    # Add to tournament groups index
    if "tournament_address" in data:
        redis_client.sadd(f"tournament:{data['tournament_address']}:groups", address)
    # Add to description search index
    if "description" in data:
        description_words = data["description"].lower().split()
        for word in description_words:
            redis_client.sadd(f"group:word:{word}", address)

def get_tournament(address):
    """Get tournament data by address"""
    data = redis_client.hgetall(f"{TOURNAMENT_KEY_PREFIX}{address}")
    if not data:
        return None
    return data

def get_group(address):
    """Get betting group data by address"""
    data = redis_client.hgetall(f"{GROUP_KEY_PREFIX}{address}")
    if not data:
        return None
    return data

def search_tournaments_by_description(search_term):
    """Search tournaments by description"""
    search_words = search_term.lower().split()
    if not search_words:
        return []
    
    # Find tournaments that match any of the search words
    matching_addresses = None
    for word in search_words:
        addresses = redis_client.smembers(f"tournament:word:{word}")
        if matching_addresses is None:
            matching_addresses = addresses
        else:
            matching_addresses = matching_addresses.union(addresses)
    
    if not matching_addresses:
        return []
    
    # Get tournament details
    result = []
    for address in matching_addresses:
        tournament_data = get_tournament(address)
        if tournament_data:
            tournament_data["address"] = address
            result.append(tournament_data)
    
    return result

def search_groups_by_description(search_term):
    """Search betting groups by description"""
    search_words = search_term.lower().split()
    if not search_words:
        return []
    
    # Find groups that match any of the search words
    matching_addresses = None
    for word in search_words:
        addresses = redis_client.smembers(f"group:word:{word}")
        if matching_addresses is None:
            matching_addresses = addresses
        else:
            matching_addresses = matching_addresses.union(addresses)
    
    if not matching_addresses:
        return []
    
    # Get group details
    result = []
    for address in matching_addresses:
        group_data = get_group(address)
        if group_data:
            group_data["address"] = address
            result.append(group_data)
    
    return result

def get_tournament_groups(tournament_address):
    """Get all betting groups for a tournament"""
    group_addresses = redis_client.smembers(f"tournament:{tournament_address}:groups")
    if not group_addresses:
        return []
    
    # Get group details
    result = []
    for address in group_addresses:
        group_data = get_group(address)
        if group_data:
            group_data["address"] = address
            result.append(group_data)
    
    return result

def get_all_tournaments():
    """Get all tournaments"""
    addresses = redis_client.smembers(TOURNAMENT_INDEX)
    if not addresses:
        return []
    
    result = []
    for address in addresses:
        tournament_data = get_tournament(address)
        if tournament_data:
            tournament_data["address"] = address
            result.append(tournament_data)
    
    return result

def get_all_groups():
    """Get all betting groups"""
    addresses = redis_client.smembers(GROUP_INDEX)
    if not addresses:
        return []
    
    result = []
    for address in addresses:
        group_data = get_group(address)
        if group_data:
            group_data["address"] = address
            result.append(group_data)
    
    return result

def save_last_processed_block(block_number):
    """Save the last processed block number to Redis"""
    redis_client.set(LAST_PROCESSED_BLOCK_KEY, str(block_number))
    
def get_last_processed_block():
    """Get the last processed block number from Redis"""
    last_block = redis_client.get(LAST_PROCESSED_BLOCK_KEY)
    if last_block:
        return int(last_block)
    return None 