import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import FACTORY_CONTRACT_ADDRESS
from models import (
    TournamentResponse, GroupResponse,
    SearchQuery, AddressQuery
)
from db import (
    get_tournament, get_group, 
    search_tournaments_by_description, search_groups_by_description,
    get_tournament_groups, get_all_tournaments, get_all_groups
)
from blockchain import watch_events

app = FastAPI(title="Sports Betting Platform API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Background task for event watching
@app.on_event("startup")
async def startup_event():
    # Start watching blockchain events in the background
    asyncio.create_task(watch_events())

# API endpoints
@app.get("/")
async def root():
    return {"message": "Sports Betting Platform API", "factory_address": FACTORY_CONTRACT_ADDRESS}

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
    
    return tournaments

@app.get("/tournaments/{address}", response_model=TournamentResponse)
async def get_tournament_by_address(address: str):
    """Get tournament by address"""
    tournament = get_tournament(address)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    
    # Add address to response
    tournament["address"] = address
    
    # Convert string values to appropriate types
    tournament["start_time"] = int(tournament["start_time"])
    tournament["end_time"] = int(tournament["end_time"])
    tournament["betting_opportunities_count"] = int(tournament["betting_opportunities_count"])
    if "event_block" in tournament:
        tournament["event_block"] = int(tournament["event_block"])
    
    return tournament

@app.post("/tournaments/search", response_model=list[TournamentResponse])
async def search_tournaments(query: SearchQuery):
    """Search tournaments by description"""
    tournaments = search_tournaments_by_description(query.query)
    
    # Convert string values to appropriate types
    for tournament in tournaments:
        tournament["start_time"] = int(tournament["start_time"])
        tournament["end_time"] = int(tournament["end_time"])
        tournament["betting_opportunities_count"] = int(tournament["betting_opportunities_count"])
        if "event_block" in tournament:
            tournament["event_block"] = int(tournament["event_block"])
    
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
    
    return groups

@app.get("/groups/{address}", response_model=GroupResponse)
async def get_group_by_address(address: str):
    """Get betting group by address"""
    group = get_group(address)
    if not group:
        raise HTTPException(status_code=404, detail="Betting group not found")
    
    # Add address to response
    group["address"] = address
    
    # Convert string values to appropriate types
    group["registration_end_time"] = int(group["registration_end_time"])
    group["general_closing_window"] = int(group["general_closing_window"])
    group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
    if "event_block" in group:
        group["event_block"] = int(group["event_block"])
    
    return group

@app.post("/groups/search", response_model=list[GroupResponse])
async def search_groups(query: SearchQuery):
    """Search betting groups by description"""
    groups = search_groups_by_description(query.query)
    
    # Convert string values to appropriate types
    for group in groups:
        group["registration_end_time"] = int(group["registration_end_time"])
        group["general_closing_window"] = int(group["general_closing_window"])
        group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
        if "event_block" in group:
            group["event_block"] = int(group["event_block"])
    
    return groups

@app.get("/tournaments/{address}/groups", response_model=list[GroupResponse])
async def get_groups_by_tournament(address: str):
    """Get all betting groups for a tournament"""
    groups = get_tournament_groups(address)
    
    # Convert string values to appropriate types
    for group in groups:
        group["registration_end_time"] = int(group["registration_end_time"])
        group["general_closing_window"] = int(group["general_closing_window"])
        group["prize_distribution"] = [int(p) for p in group["prize_distribution"].split(",")]
        if "event_block" in group:
            group["event_block"] = int(group["event_block"])
    
    return groups

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
