import {
  Heading,
  Text,
  VStack,
  HStack,
  Box
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import type { Tournament } from '../types';
import { Card, CardBody } from './ui/card';
import { Badge } from './ui/badge';
import { CopyAddress } from './ui/copy-address';

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
      return <Badge variant="active">Active</Badge>;
    } else if (isUpcoming()) {
      return <Badge variant="upcoming">Upcoming</Badge>;
    } else {
      return <Badge variant="ended">Ended</Badge>;
    }
  };
  
  const handleCardClick = () => {
    navigate(`/tournaments/${tournament.address}`);
  };
  
  return (
    <Card
      variant="betting"
      cursor="pointer"
      onClick={handleCardClick}
      h="full"
      display="flex"
      flexDirection="column"
    >
      <CardBody p={6}>
        <VStack align="stretch" gap={4} h="full">
          <HStack justify="space-between" align="start">
            <Heading 
              size="md" 
              color="gray.800"
              lineClamp={2}
              flex="1"
              mr={3}
            >
              {tournament.description}
            </Heading>
            {getStatusBadge()}
          </HStack>
          
          <CopyAddress 
            address={tournament.address}
            label="Contract Address"
            fontSize="sm"
            variant="default"
          />
          
          <VStack align="stretch" gap={2} mt="auto">
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.500" fontWeight="medium">
                Start Time
              </Text>
              <Text fontSize="sm" color="gray.800" fontWeight="semibold">
                {formatDate(tournament.startTime)}
              </Text>
            </HStack>
            
            <HStack justify="space-between">
              <Text fontSize="sm" color="gray.500" fontWeight="medium">
                End Time
              </Text>
              <Text fontSize="sm" color="gray.800" fontWeight="semibold">
                {formatDate(tournament.endTime)}
              </Text>
            </HStack>
          </VStack>
        </VStack>
      </CardBody>
    </Card>
  );
};

export default TournamentCard; 