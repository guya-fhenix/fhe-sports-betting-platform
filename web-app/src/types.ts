// Tournament types
export interface Tournament {
  address: string;
  description: string;
  startTime: number;
  endTime: number;
  bettingOpportunitiesCount: number;
  eventBlock?: number;
  eventTx?: string;
}

export interface BettingOpportunity {
  id: number;
  description: string;
  startTime: number;
  options: string[];
}

export interface TournamentCreateInput {
  description: string;
  startTime: number;
  endTime: number;
  bettingOpportunities: BettingOpportunity[];
}

// Group types
export interface Group {
  address: string;
  description: string;
  tournamentAddress: string;
  registrationEndTime: number;
  prizeDistribution: number[];
  generalClosingWindow: number;
  eventBlock?: number;
  eventTx?: string;
}

export interface GroupCreateInput {
  description: string;
  tournamentAddress: string;
  entryFee: number;
  prizeDistribution: number[];
  generalClosingWindow: number;
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