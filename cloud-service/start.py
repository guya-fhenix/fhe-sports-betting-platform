#!/usr/bin/env python3
"""
Startup script for the FHE Sports Betting Platform backend.
This ensures we use the Socket.IO-enabled ASGI app.
"""
import uvicorn

if __name__ == "__main__":
    print("Starting FHE Sports Betting Platform backend with Socket.IO...")
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8000, reload=True) 