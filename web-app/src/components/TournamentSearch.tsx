import { useState } from 'react';
import { 
  Input, 
  Button, 
  VStack, 
  HStack, 
  Heading, 
  Field,
  Spinner,
  Text
} from '@chakra-ui/react';
import { searchTournaments } from '../services/api';
import type { Tournament } from '../types';
import TournamentCard from './TournamentCard';

const TournamentSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const results = await searchTournaments(searchQuery);
      setTournaments(results);
      setSearched(true);
    } catch (error) {
      console.error('Error searching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack gap={6} align="stretch" width="100%">
      <Heading size="lg">Search Tournaments</Heading>
      
      <Field.Root>
        <Field.Label>Search by description</Field.Label>
        <HStack>
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter keywords to search"
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button 
            onClick={handleSearch}
            colorScheme="blue"
            disabled={!searchQuery.trim()}
            width="150px"
          >
            Search
          </Button>
        </HStack>
      </Field.Root>

      {loading && (
        <VStack py={10}>
          <Spinner size="xl" />
          <Text>Searching tournaments...</Text>
        </VStack>
      )}

      {!loading && searched && (
        <VStack gap={4} align="stretch">
          <Heading size="md">
            {tournaments.length > 0 
              ? `Found ${tournaments.length} tournament(s)` 
              : 'No tournaments found'}
          </Heading>
          
          {tournaments.map(tournament => (
            <TournamentCard key={tournament.address} tournament={tournament} />
          ))}
        </VStack>
      )}
    </VStack>
  );
};

export default TournamentSearch; 