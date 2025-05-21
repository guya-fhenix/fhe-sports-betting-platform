import axios from 'axios';
import { API_BASE_URL } from '../config';
import type { Tournament, Group, SearchQuery } from '../types';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response mappers
const mapTournamentResponse = (data: any): Tournament => {
  // Ensure numerical fields are properly converted from strings if needed
  const startTime = typeof data.start_time === 'string' ? parseInt(data.start_time, 10) : data.start_time;
  const endTime = typeof data.end_time === 'string' ? parseInt(data.end_time, 10) : data.end_time;
  const bettingOpportunitiesCount = typeof data.betting_opportunities_count === 'string' ? 
    parseInt(data.betting_opportunities_count, 10) : data.betting_opportunities_count;
  const eventBlock = data.event_block ? 
    (typeof data.event_block === 'string' ? parseInt(data.event_block, 10) : data.event_block) : undefined;
  
  return {
    address: data.address,
    description: data.description,
    startTime,
    endTime,
    bettingOpportunitiesCount,
    eventBlock,
    eventTx: data.event_tx
  };
};

const mapGroupResponse = (data: any): Group => {
  // Ensure numerical fields are properly converted from strings if needed
  const registrationEndTime = typeof data.registration_end_time === 'string' ? 
    parseInt(data.registration_end_time, 10) : data.registration_end_time;
  const generalClosingWindow = typeof data.general_closing_window === 'string' ? 
    parseInt(data.general_closing_window, 10) : data.general_closing_window;
  const prizeDistribution = Array.isArray(data.prize_distribution) ? data.prize_distribution : 
    (typeof data.prize_distribution === 'string' ? data.prize_distribution.split(',').map((p: string) => parseInt(p, 10)) : []);
  const eventBlock = data.event_block ? 
    (typeof data.event_block === 'string' ? parseInt(data.event_block, 10) : data.event_block) : undefined;
  
  return {
    address: data.address,
    description: data.description,
    tournamentAddress: data.tournament_address,
    registrationEndTime,
    prizeDistribution,
    generalClosingWindow,
    eventBlock,
    eventTx: data.event_tx
  };
};

// Tournament API calls
export const getTournaments = async (): Promise<Tournament[]> => {
  const response = await apiClient.get<any[]>('/tournaments');
  return response.data.map(mapTournamentResponse);
};

export const getTournamentByAddress = async (address: string): Promise<Tournament> => {
  const response = await apiClient.get<any>(`/tournaments/${address}`);
  return mapTournamentResponse(response.data);
};

export const searchTournaments = async (query: string): Promise<Tournament[]> => {
  const response = await apiClient.post<any[]>('/tournaments/search', { query });
  return response.data.map(mapTournamentResponse);
};

// Group API calls
export const getGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get<any[]>('/groups');
  return response.data.map(mapGroupResponse);
};

export const getGroupByAddress = async (address: string): Promise<Group> => {
  const response = await apiClient.get<any>(`/groups/${address}`);
  return mapGroupResponse(response.data);
};

export const searchGroups = async (query: string): Promise<Group[]> => {
  const response = await apiClient.post<any[]>('/groups/search', { query });
  return response.data.map(mapGroupResponse);
};

export const getTournamentGroups = async (tournamentAddress: string): Promise<Group[]> => {
  const response = await apiClient.get<any[]>(`/tournaments/${tournamentAddress}/groups`);
  return response.data.map(mapGroupResponse);
}; 