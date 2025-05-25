import asyncio
import logging
import time
import json
import socketio
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Response, WebSocket, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.exceptions import RequestValidationError
import uvicorn
from starlette.background import BackgroundTask

from config import FACTORY_CONTRACT_ADDRESS
from models import (
    TournamentResponse, GroupResponse,
    SearchQuery, AddressQuery
)
from db import (
    save_tournament, save_group, get_tournament, get_group,
    search_tournaments_by_description, search_groups_by_description,
    get_tournament_groups, get_all_tournaments, get_all_groups,
    get_user_groups
)
from blockchain import (
    watch_events, sync_user_group_mappings, 
    verify_all_user_group_mappings, is_user_registered_in_group_blockchain
)
from logging_config import setup_logging, MAX_BODY_SIZE, MAX_LIST_ITEMS
from websocket import manager, active_ws_manager

# Configure logging
logger = setup_logging()

# Set up Socket.IO
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],  # Explicitly allow the frontend origin
    logger=True,
    ping_timeout=35,
    ping_interval=25
)

# Create FastAPI app
app = FastAPI(title="Sports Betting Platform API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Create a Socket.IO app combined with FastAPI (after CORS middleware)
socket_app = socketio.ASGIApp(sio, app)

# Socket.IO event handlers
@sio.event
async def connect(sid, environ):
    """Handle Socket.IO connection"""
    logger.info(f"Socket.IO client connected: {sid}")
    
    # Send initial welcome message
    await sio.emit('blockchain_event', {
        "id": f"connect-{time.time()}",
        "type": "system",
        "message": "Connected to blockchain events stream",
        "timestamp": int(time.time() * 1000)
    }, to=sid)
    
    # Store client info
    await sio.save_session(sid, {
        'connected_at': time.time(),
        'client_id': sid
    })

@sio.event
async def disconnect(sid):
    """Handle Socket.IO disconnection"""
    logger.info(f"Socket.IO client disconnected: {sid}")

# Helper function to broadcast blockchain events to all Socket.IO clients
async def broadcast_blockchain_event(event_type: str, message: str, data=None):
    """Broadcast blockchain events to all connected Socket.IO clients"""
    event = {
        "id": f"event-{time.time()}",
        "type": event_type,
        "message": message,
        "timestamp": int(time.time() * 1000),
    }
    
    if data:
        event["data"] = data
    
    try:
        await sio.emit('blockchain_event', event)
        logger.info(f"Broadcasted {event_type} event: {message}")
    except Exception as e:
        logger.error(f"Error broadcasting event: {e}", exc_info=True)

# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(f"HTTP Exception: {exc.status_code} - {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled Exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )

# Middleware for logging request and response
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = f"{time.time()}"
    
    # Log the request (without body - can't read it without consuming)
    path = request.url.path
    method = request.method
    
    logger.info(f"Request {request_id}: {method} {path}")
    
    try:
        # Process the request and get the response
        start_time = time.time()
        
        # Create a custom response to capture the body
        original_response = await call_next(request)
        process_time = time.time() - start_time
        
        # Create a new response to return
        response_body = [chunk async for chunk in original_response.body_iterator]
        
        # Get the response body as string
        body_str = b"".join(response_body).decode("utf-8")
        
        # Try to parse the body as JSON for better logging
        try:
            body = json.loads(body_str)
            # For large responses, limit the logged content
            if isinstance(body, list):
                if len(body) > MAX_LIST_ITEMS:
                    log_body = {
                        "count": len(body), 
                        "first_items": body[:MAX_LIST_ITEMS], 
                        "note": f"response truncated, showing {MAX_LIST_ITEMS} of {len(body)} items"
                    }
                else:
                    log_body = body
            elif isinstance(body, dict) and len(str(body)) > MAX_BODY_SIZE:
                # For large dictionaries, take only essential info
                keys = list(body.keys())
                log_body = {
                    "keys": keys,
                    "note": f"large response with {len(keys)} keys, content truncated"
                }
            else:
                log_body = body
        except:
            # If not JSON or parsing fails, use the raw string (could be HTML, etc.)
            if len(body_str) > MAX_BODY_SIZE:
                log_body = f"{body_str[:500]}... (truncated, total length: {len(body_str)})"
            else:
                log_body = body_str
        
        # Log the response with body
        logger.info(
            f"Response {request_id}: status_code={original_response.status_code}, "
            f"processed_in={process_time:.4f}s, body={log_body}"
        )
        
        # Create a new response with the already read body
        return Response(
            content=b"".join(response_body),
            status_code=original_response.status_code,
            headers=dict(original_response.headers),
            media_type=original_response.media_type
        )
    except Exception as e:
        logger.error(f"Error processing request {request_id}: {str(e)}", exc_info=True)
        raise

# Background task for event watching
@app.on_event("startup")
async def startup_event():
    # Start watching blockchain events in the background
    logger.info("Starting blockchain event watcher")
    asyncio.create_task(watch_events())
    
    # Start connection cleanup task
    logger.info("Starting Socket.IO periodic tasks")
    asyncio.create_task(periodic_connection_cleanup())

# Periodically clean up stale connections
async def periodic_connection_cleanup():
    # We need to keep track of active Socket.IO sessions
    active_sids = set()
    
    while True:
        try:
            # Run cleanup every 2 minutes
            await asyncio.sleep(120)
            
            # Log the current Socket.IO server stats
            connections_count = len(sio.manager.get_rooms('/'))
            logger.info(f"Current Socket.IO connections: {connections_count}")
            
            # We can't get all sessions, so just log and continue
            # For a proper cleanup, Socket.IO already has built-in ping/pong
            # mechanism with the ping_timeout parameter we set in the constructor
            logger.info("Socket.IO automatic ping/pong timeout handling is active")
                
        except Exception as e:
            logger.error(f"Error in Socket.IO cleanup task: {e}", exc_info=True)
            await asyncio.sleep(60)  # Wait a minute before trying again if there's an error

# API endpoints
@app.get("/")
async def root():
    response = {"message": "Sports Betting Platform API", "factory_address": FACTORY_CONTRACT_ADDRESS}
    logger.info(f"Root endpoint response: {response}")
    return response

# Tournament endpoints
@app.get("/tournaments", response_model=list[TournamentResponse])
async def get_tournaments():
    """Get all tournaments"""
    tournaments = get_all_tournaments()
    
    # Convert string values to appropriate types
    for tournament in tournaments:
        tournament["start_time"] = int(tournament["start_time"])
        tournament["end_time"] = int(tournament["end_time"])
        tournament["betting_opportunities_count"] = int(tournament["betting_opportunities_count"])
        if "event_block" in tournament:
            tournament["event_block"] = int(tournament["event_block"])
    
    logger.info(f"Returned {len(tournaments)} tournaments")
    return tournaments

@app.get("/tournaments/{address}", response_model=TournamentResponse)
async def get_tournament_by_address(address: str):
    """Get tournament by address"""
    logger.info(f"Getting tournament with address: {address}")
    tournament = get_tournament(address)
    if not tournament:
        logger.warning(f"Tournament not found: {address}")
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Add address to response
    tournament["address"] = address
    
    # Convert string values to appropriate types
    tournament["start_time"] = int(tournament["start_time"])
    tournament["end_time"] = int(tournament["end_time"])
    tournament["betting_opportunities_count"] = int(tournament["betting_opportunities_count"])
    if "event_block" in tournament:
        tournament["event_block"] = int(tournament["event_block"])
    
    logger.info(f"Tournament found: {address}, description: {tournament.get('description', 'N/A')}")
    return tournament

@app.post("/tournaments/search", response_model=list[TournamentResponse])
async def search_tournaments(query: SearchQuery):
    """Search tournaments by description"""
    logger.info(f"Searching tournaments with query: {query.query}")
    logger.info(f"Request body: {query.model_dump()}")
    tournaments = search_tournaments_by_description(query.query)
    
    # Convert string values to appropriate types
    for tournament in tournaments:
        tournament["start_time"] = int(tournament["start_time"])
        tournament["end_time"] = int(tournament["end_time"])
        tournament["betting_opportunities_count"] = int(tournament["betting_opportunities_count"])
        if "event_block" in tournament:
            tournament["event_block"] = int(tournament["event_block"])
    
    logger.info(f"Found {len(tournaments)} tournaments matching '{query.query}'")
    return tournaments

# Group endpoints
@app.get("/groups", response_model=list[GroupResponse])
async def get_groups():
    """Get all betting groups"""
    groups = get_all_groups()
    
    # Convert string values to appropriate types
    for group in groups:
        group["registration_end_time"] = int(group["registration_end_time"])
        group["general_closing_window"] = int(group["general_closing_window"])
        group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
        if "event_block" in group:
            group["event_block"] = int(group["event_block"])
    
    logger.info(f"Returned {len(groups)} betting groups")
    return groups

@app.get("/groups/{address}", response_model=GroupResponse)
async def get_group_by_address(address: str):
    """Get betting group by address"""
    logger.info(f"Getting betting group with address: {address}")
    group = get_group(address)
    if not group:
        logger.warning(f"Betting group not found: {address}")
        raise HTTPException(status_code=404, detail="Betting group not found")
    
    # Add address to response
    group["address"] = address
    
    # Convert string values to appropriate types
    group["registration_end_time"] = int(group["registration_end_time"])
    group["general_closing_window"] = int(group["general_closing_window"])
    group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
    if "event_block" in group:
        group["event_block"] = int(group["event_block"])
    
    logger.info(f"Betting group found: {address}, description: {group.get('description', 'N/A')}")
    return group

@app.post("/groups/search", response_model=list[GroupResponse])
async def search_groups(query: SearchQuery):
    """Search betting groups by description"""
    logger.info(f"Searching betting groups with query: {query.query}")
    logger.info(f"Request body: {query.model_dump()}")
    groups = search_groups_by_description(query.query)
    
    # Convert string values to appropriate types
    for group in groups:
        group["registration_end_time"] = int(group["registration_end_time"])
        group["general_closing_window"] = int(group["general_closing_window"])
        group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
        if "event_block" in group:
            group["event_block"] = int(group["event_block"])
    
    logger.info(f"Found {len(groups)} betting groups matching '{query.query}'")
    return groups

@app.get("/tournaments/{address}/groups", response_model=list[GroupResponse])
async def get_groups_by_tournament(address: str):
    """Get all betting groups for a tournament"""
    logger.info(f"Getting groups for tournament: {address}")
    groups = get_tournament_groups(address)
    
    # Convert string values to appropriate types
    for group in groups:
        group["registration_end_time"] = int(group["registration_end_time"])
        group["general_closing_window"] = int(group["general_closing_window"])
        group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
        if "event_block" in group:
            group["event_block"] = int(group["event_block"])
    
    logger.info(f"Found {len(groups)} betting groups for tournament {address}")
    return groups

@app.get("/user/{address}/groups")
async def get_user_groups_api(address: str):
    """Get betting groups a user is registered for"""
    # Get the user's groups directly from Redis
    user_group_addresses = get_user_groups(address)
    
    # Get details for each group
    groups = []
    for group_address in user_group_addresses:
        group_data = get_group(group_address)
        if group_data:  # Only include if we have data
            # Add address to the group data
            group_data["address"] = group_address
            
            # Convert string values to appropriate types
            group_data["registration_end_time"] = int(group_data["registration_end_time"])
            group_data["general_closing_window"] = int(group_data["general_closing_window"])
            group_data["prize_distribution"] = [int(p) for p in group_data["prize_distribution"].split(",")]
            if "event_block" in group_data:
                group_data["event_block"] = int(group_data["event_block"])
                
            groups.append(group_data)
    
    return {
        "user_address": address,
        "groups": groups
    }

# Export the broadcast function to the blockchain module
active_ws_manager.set_broadcast_func(broadcast_blockchain_event)

# Configure uvicorn to use Socket.IO app
if __name__ == "__main__":
    uvicorn.run(socket_app, host="0.0.0.0", port=8000, reload=False)

# Admin helper endpoints to force resync
@app.post("/admin/resync/group/{address}")
async def resync_betting_group(address: str):
    """Manually resync user-group mappings for a specific betting group"""
    try:
        logger.info(f"Manual resync requested for group {address}")
        result = await sync_user_group_mappings(address)
        return {
            "status": "success" if result else "error",
            "message": f"Group {address} user mappings {'successfully resynced' if result else 'resync failed'}"
        }
    except Exception as e:
        logger.error(f"Error in manual resync for group {address}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error resyncing: {str(e)}")

@app.post("/admin/resync/all-groups")
async def resync_all_groups():
    """Manually resync user-group mappings for all betting groups"""
    try:
        logger.info("Manual resync requested for all groups")
        count = await verify_all_user_group_mappings()
        return {
            "status": "success",
            "message": f"Successfully resynced {count} groups"
        }
    except Exception as e:
        logger.error(f"Error in manual resync for all groups: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error resyncing: {str(e)}")

@app.get("/admin/verify/user-in-group/{user_address}/{group_address}")
async def verify_user_in_group(user_address: str, group_address: str):
    """Verify if a user is registered in a specific betting group"""
    try:
        # Check on-chain status
        blockchain_status = await is_user_registered_in_group_blockchain(user_address, group_address)
        
        # Check Redis status
        redis_status = get_user_groups(user_address)
        in_redis = group_address in redis_status
        
        # If statuses don't match, fix Redis
        if blockchain_status and not in_redis:
            from db import add_user_to_group
            add_user_to_group(user_address, group_address)
            fixed = True
        elif not blockchain_status and in_redis:
            from db import remove_user_from_group
            remove_user_from_group(user_address, group_address)
            fixed = True
        else:
            fixed = False
        
        return {
            "user_address": user_address,
            "group_address": group_address,
            "blockchain_status": blockchain_status,
            "redis_status": in_redis,
            "status_match": blockchain_status == in_redis,
            "redis_updated": fixed
        }
    except Exception as e:
        logger.error(f"Error verifying user registration: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error verifying: {str(e)}")
