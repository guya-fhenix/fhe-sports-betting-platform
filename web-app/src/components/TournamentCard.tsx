import {
  Box,
  Heading,
  Text,
  Badge,
  VStack,
  HStack
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
    try {      
      // Validate timestamp is a reasonable value
      if (!timestamp || isNaN(timestamp) || timestamp <= 0) {
        console.error(`Invalid timestamp value: ${timestamp}`);
        return 'Invalid date';
      }
      
      const date = new Date(timestamp * 1000);
      
      // Verify the date is valid
      if (isNaN(date.getTime())) {
        console.error(`Invalid date from timestamp: ${timestamp}`);
        return 'Invalid date';
      }
      
      return date.toLocaleString(undefined, { 
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error(`Error formatting date: ${error}`);
      return 'Invalid date';
    }
  };
  
  // Check if tournament is active
  const isActive = () => {
    const now = Math.floor(Date.now() / 1000);
    return now >= tournament.startTime && now <= tournament.endTime;
  };
  
  // Check if tournament is upcoming
  const isUpcoming = () => {
    const now = Math.floor(Date.now() / 1000);
    return now < tournament.startTime;
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
  
  const handleCardClick = () => {
    navigate(`/tournaments/${tournament.address}`);
  };
  
  return (
    <Box
      color="gray.800"
      borderWidth="1px"
      borderRadius="lg"
      borderColor="gray.200"
      overflow="hidden"
      p={3}
      boxShadow="sm"
      height="100%"
      display="flex"
      flexDirection="column"
      cursor="pointer"
      onClick={handleCardClick}
      _hover={{
        boxShadow: "md",
        borderColor: "teal.300",
        transform: "translateY(-2px)"
      }}
      transition="all 0.2s"
    >
      <VStack align="start" gap={1} flex="1">
        <HStack width="100%" justify="space-between">
          <Heading size="sm" maxW="80%" title={tournament.description} truncate>
            {tournament.description}
          </Heading>
          {getStatusBadge()}
        </HStack>
        
        <Text fontSize="xs" maxW="100%" truncate>
          {tournament.address}
        </Text>
        
        <Text fontSize="sm">
          <Text as="span" fontWeight="bold">Start:</Text> {formatDate(tournament.startTime)}
        </Text>
        
        <Text fontSize="sm">
          <Text as="span" fontWeight="bold">End:</Text> {formatDate(tournament.endTime)}
        </Text>
      </VStack>
    </Box>
  );
};

export default TournamentCard; 