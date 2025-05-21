import logging
import time
from fastapi import WebSocket, WebSocketDisconnect

# Get logger
logger = logging.getLogger("api")

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: list = []
        self.connection_count = 0
        self.logger = logging.getLogger("api")
        self.MAX_CONNECTIONS = 100  # Maximum number of simultaneous connections allowed

    async def connect(self, websocket: WebSocket):
        # Check if we already have too many connections
        if len(self.active_connections) >= self.MAX_CONNECTIONS:
            self.logger.warning(f"Connection rejected: Maximum connections ({self.MAX_CONNECTIONS}) reached")
            await websocket.accept()
            await websocket.send_json({
                "id": f"error-{time.time()}",
                "type": "system",
                "message": f"Connection rejected: Too many active connections",
                "timestamp": int(time.time() * 1000)
            })
            await websocket.close(code=1013, reason="Maximum connections reached")
            return None
            
        # Accept the connection if below limits
        await websocket.accept()
        self.active_connections.append(websocket)
        self.connection_count += 1
        self.logger.info(f"New WebSocket connection established. Active connections: {len(self.active_connections)}")
        return websocket

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            self.logger.info(f"WebSocket connection removed. Remaining connections: {len(self.active_connections)}")
        else:
            self.logger.debug(f"Disconnect called for WebSocket not in active connections list")

    async def broadcast(self, message: dict):
        if not self.active_connections:
            self.logger.warning("No active WebSocket connections to broadcast to")
            return
            
        self.logger.debug(f"Broadcasting message to {len(self.active_connections)} connections")
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                self.logger.error(f"Error broadcasting message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected clients
        for connection in disconnected:
            self.disconnect(connection)
            
        if disconnected:
            self.logger.info(f"Removed {len(disconnected)} disconnected clients during broadcast")

    async def clean_stale_connections(self):
        """Periodically check for and remove stale connections"""
        stale_connections = []
        
        # Try to send a ping to each connection
        for connection in self.active_connections:
            try:
                # Try to send a ping (will fail for dead connections)
                await connection.send_json({
                    "id": f"ping-{time.time()}",
                    "type": "system",
                    "message": "Connection test",
                    "timestamp": int(time.time() * 1000)
                })
            except Exception as e:
                self.logger.error(f"Detected stale connection: {e}")
                stale_connections.append(connection)
        
        # Remove stale connections
        for connection in stale_connections:
            self.disconnect(connection)
            
        if stale_connections:
            self.logger.info(f"Removed {len(stale_connections)} stale connections")
            
        return len(stale_connections)

    def get_connection_info(self):
        return {
            "active_connections": len(self.active_connections),
            "total_connections_ever": self.connection_count,
            "connection_limit": self.MAX_CONNECTIONS
        }

# Singleton manager instance
manager = ConnectionManager()

# Helper function to broadcast blockchain events to all connected clients
async def broadcast_blockchain_event(event_type: str, message: str, data=None):
    event = {
        "id": f"event-{time.time()}",
        "type": event_type,
        "message": message,
        "timestamp": int(time.time() * 1000),
    }
    
    if data:
        event["data"] = data
    
    # Get active manager instance and broadcast
    if active_ws_manager.manager:
        try:
            await active_ws_manager.manager.broadcast(event)
            logger.info(f"Broadcasted {event_type} event: {message}")
        except Exception as e:
            logger.error(f"Error broadcasting event: {e}", exc_info=True)
    else:
        # No active WebSocket manager available
        logger.warning(f"No active WebSocket manager available to broadcast {event_type} event: {message}")
        # Use the manager singleton directly as fallback
        try:
            await manager.broadcast(event)
            logger.info(f"Broadcasted {event_type} event using fallback manager: {message}")
        except Exception as e:
            logger.error(f"Error broadcasting event with fallback manager: {e}", exc_info=True)

# Active Socket.IO manager singleton to avoid circular imports
class ActiveSocketIOManager:
    def __init__(self):
        self.broadcast_func = None
    
    def set_broadcast_func(self, func):
        """Set the broadcast function from Socket.IO"""
        self.broadcast_func = func
        logger.info("Socket.IO broadcast function registered")
    
    async def broadcast_blockchain_event(self, event_type: str, message: str, data=None):
        """Broadcast blockchain events to all connected Socket.IO clients"""
        if self.broadcast_func:
            try:
                await self.broadcast_func(event_type, message, data)
            except Exception as e:
                logger.error(f"Error broadcasting event: {e}", exc_info=True)
        else:
            logger.warning(f"No Socket.IO broadcast function available to broadcast {event_type} event: {message}")

# Create a singleton instance
active_ws_manager = ActiveSocketIOManager() 