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
KNOWN_TOURNAMENTS_KEY = "blockchain:known_tournaments"
KNOWN_BETTING_GROUPS_KEY = "blockchain:known_betting_groups"
USER_GROUPS_KEY_PREFIX = "user:groups:"

# Functions for tracking known contracts and user-group mappings
def add_known_tournament(address):
    """Add a tournament address to the list of known tournaments"""
    return redis_client.sadd(KNOWN_TOURNAMENTS_KEY, address)

def add_known_betting_group(address):
    """Add a betting group address to the list of known betting groups"""
    return redis_client.sadd(KNOWN_BETTING_GROUPS_KEY, address)

def get_known_tournaments():
    """Get all known tournament addresses"""
    return redis_client.smembers(KNOWN_TOURNAMENTS_KEY)

def get_known_betting_groups():
    """Get all known betting group addresses"""
    return redis_client.smembers(KNOWN_BETTING_GROUPS_KEY)

def add_user_to_group(user_address, group_address):
    """Add a user to a betting group"""
    try:
        # Normalize addresses to lowercase
        user_address = user_address.lower()
        group_address = group_address.lower()
        
        # Check if the mapping already exists before adding
        exists = redis_client.sismember(f"{USER_GROUPS_KEY_PREFIX}{user_address}", group_address)
        if exists:
            return False  # No change made, mapping already exists
            
        # Add to Redis set
        result = redis_client.sadd(f"{USER_GROUPS_KEY_PREFIX}{user_address}", group_address)
        
        # Also add reverse lookup for quick access
        redis_client.sadd(f"group:{group_address}:users", user_address)
        
        return result == 1  # Return True if a new member was added
    except Exception as e:
        import logging
        logging.getLogger("blockchain").error(f"Redis error in add_user_to_group: {e}")
        return False

def remove_user_from_group(user_address, group_address):
    """Remove a user from a betting group"""
    try:
        # Normalize addresses to lowercase
        user_address = user_address.lower()
        group_address = group_address.lower()
        
        # Check if the mapping exists before removing
        exists = redis_client.sismember(f"{USER_GROUPS_KEY_PREFIX}{user_address}", group_address)
        if not exists:
            return False  # No change made, mapping doesn't exist
            
        # Remove from Redis set
        result = redis_client.srem(f"{USER_GROUPS_KEY_PREFIX}{user_address}", group_address)
        
        # Also remove from reverse lookup
        redis_client.srem(f"group:{group_address}:users", user_address)
        
        return result == 1  # Return True if a member was removed
    except Exception as e:
        import logging
        logging.getLogger("blockchain").error(f"Redis error in remove_user_from_group: {e}")
        return False

def get_user_groups(user_address):
    """Get all betting groups a user is registered for"""
    try:
        # Normalize address to lowercase
        user_address = user_address.lower()
        
        # Get the groups from Redis
        groups = redis_client.smembers(f"{USER_GROUPS_KEY_PREFIX}{user_address}")
        
        return groups
    except Exception as e:
        import logging
        logging.getLogger("blockchain").error(f"Redis error in get_user_groups: {e}")
        return set()

def is_user_in_group(user_address, group_address):
    """Check if a user is registered in a betting group"""
    try:
        # Normalize addresses to lowercase
        user_address = user_address.lower()
        group_address = group_address.lower()
        
        # Check in Redis
        result = redis_client.sismember(f"{USER_GROUPS_KEY_PREFIX}{user_address}", group_address)
        
        return bool(result)
    except Exception as e:
        import logging
        logging.getLogger("blockchain").error(f"Redis error in is_user_in_group: {e}")
        return False

def get_group_users(group_address):
    """Get all users registered in a betting group"""
    try:
        # Normalize address to lowercase
        group_address = group_address.lower()
        
        # Get the users from Redis
        users = redis_client.smembers(f"group:{group_address}:users")
        
        return users
    except Exception as e:
        import logging
        logging.getLogger("blockchain").error(f"Redis error in get_group_users: {e}")
        return set()

# Original helper functions
def save_tournament(address, data):
    """Save tournament data to Redis"""
    # Save tournament details
    redis_client.hset(f"{TOURNAMENT_KEY_PREFIX}{address}", mapping=data)
    # Add to address index
    redis_client.sadd(TOURNAMENT_INDEX, address)
    # Add to known tournaments list
    add_known_tournament(address)
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
    # Add to known betting groups list
    add_known_betting_group(address)
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