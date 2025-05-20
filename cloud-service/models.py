from pydantic import BaseModel, Field
from typing import List, Optional

class TournamentBase(BaseModel):
    description: str
    start_time: int
    end_time: int

class TournamentCreate(TournamentBase):
    betting_opportunities: List[dict]

class TournamentResponse(TournamentBase):
    address: str
    betting_opportunities_count: int
    event_block: Optional[int] = None
    event_tx: Optional[str] = None

class GroupBase(BaseModel):
    description: str
    tournament_address: str
    registration_end_time: int
    prize_distribution: List[int]
    general_closing_window: int

class GroupCreate(GroupBase):
    entry_fee: int

class GroupResponse(GroupBase):
    address: str
    event_block: Optional[int] = None
    event_tx: Optional[str] = None

class SearchQuery(BaseModel):
    query: str = Field(..., min_length=1)

class AddressQuery(BaseModel):
    address: str = Field(..., min_length=42, max_length=42) 