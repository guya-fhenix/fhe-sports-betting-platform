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

// Tournament API calls
export const getTournaments = async (): Promise<Tournament[]> => {
  const response = await apiClient.get<Tournament[]>('/tournaments');
  return response.data;
};

export const getTournamentByAddress = async (address: string): Promise<Tournament> => {
  const response = await apiClient.get<Tournament>(`/tournaments/${address}`);
  return response.data;
};

export const searchTournaments = async (query: string): Promise<Tournament[]> => {
  const response = await apiClient.post<Tournament[]>('/tournaments/search', { query });
  return response.data;
};

// Group API calls
export const getGroups = async (): Promise<Group[]> => {
  const response = await apiClient.get<Group[]>('/groups');
  return response.data;
};

export const getGroupByAddress = async (address: string): Promise<Group> => {
  const response = await apiClient.get<Group>(`/groups/${address}`);
  return response.data;
};

export const searchGroups = async (query: string): Promise<Group[]> => {
  const response = await apiClient.post<Group[]>('/groups/search', { query });
  return response.data;
};

export const getTournamentGroups = async (tournamentAddress: string): Promise<Group[]> => {
  const response = await apiClient.get<Group[]>(`/tournaments/${tournamentAddress}/groups`);
  return response.data;
}; 