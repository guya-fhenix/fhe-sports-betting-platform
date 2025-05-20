import {
  Box,
  Heading,
  Text,
  Badge,
  VStack,
  HStack,
  Button
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { Tournament } from '../types';

interface TournamentCardProps {
  tournament: Tournament;
}

const TournamentCard = ({ tournament }: TournamentCardProps) => {
  const navigate = useNavigate();
  
  // Format timestamp to readable date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };
  
  // Check if tournament is active
  const isActive = () => {
    const now = Math.floor(Date.now() / 1000);
    return now >= tournament.start_time && now <= tournament.end_time;
  };
  
  // Check if tournament is upcoming
  const isUpcoming = () => {
    const now = Math.floor(Date.now() / 1000);
    return now < tournament.start_time;
  };
  
  // Get status badge
  const getStatusBadge = () => {
    if (isActive()) {
      return <Badge colorScheme="green">Active</Badge>;
    } else if (isUpcoming()) {
      return <Badge colorScheme="blue">Upcoming</Badge>;
    } else {
      return <Badge colorScheme="red">Ended</Badge>;
    }
  };
  
  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      overflow="hidden"
      p={4}
      boxShadow="md"
    >
      <VStack align="start" gap={2}>
        <HStack width="100%" justify="space-between">
          <Heading size="md" truncate maxW="70%">
            {tournament.description}
          </Heading>
          {getStatusBadge()}
        </HStack>
        
        <Text fontSize="sm" color="gray.500">
          Tournament ID: {tournament.address}
        </Text>
        
        <Text>
          <Text as="span" fontWeight="bold">Start:</Text> {formatDate(tournament.start_time)}
        </Text>
        
        <Text>
          <Text as="span" fontWeight="bold">End:</Text> {formatDate(tournament.end_time)}
        </Text>
        
        <Text>
          <Text as="span" fontWeight="bold">Betting Opportunities:</Text> {tournament.betting_opportunities_count}
        </Text>
        
        <HStack width="100%" pt={2}>
          <Button
            colorScheme="teal"
            size="sm"
            onClick={() => navigate(`/tournaments/${tournament.address}`)}
          >
            View Details
          </Button>
          
          <Button
            colorScheme="blue"
            size="sm"
            onClick={() => navigate(`/tournaments/${tournament.address}/groups`)}
          >
            View Groups
          </Button>
          
          {isUpcoming() && (
            <Button
              colorScheme="green"
              size="sm"
              onClick={() => navigate(`/groups/create?tournament=${tournament.address}`)}
              ml="auto"
            >
              Create Group
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );
};

export default TournamentCard; 