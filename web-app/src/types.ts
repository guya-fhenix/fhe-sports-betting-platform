// Tournament types
export interface Tournament {
  address: string;
  description: string;
  start_time: number;
  end_time: number;
  betting_opportunities_count: number;
  event_block?: number;
  event_tx?: string;
}

export interface BettingOpportunity {
  id: number;
  description: string;
  options: string[];
}

export interface TournamentCreateInput {
  description: string;
  start_time: number;
  end_time: number;
  betting_opportunities: BettingOpportunity[];
}

// Group types
export interface Group {
  address: string;
  description: string;
  tournament_address: string;
  registration_end_time: number;
  prize_distribution: number[];
  general_closing_window: number;
  event_block?: number;
  event_tx?: string;
}

export interface GroupCreateInput {
  description: string;
  tournament_address: string;
  entry_fee: number;
  prize_distribution: number[];
  general_closing_window: number;
}

// Search types
export interface SearchQuery {
  query: string;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  status: number;
  error?: string;
} 