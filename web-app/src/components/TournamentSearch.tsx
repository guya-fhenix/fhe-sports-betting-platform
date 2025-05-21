import { useState, useEffect, useRef } from 'react';
import { 
  Input, 
  Button, 
  VStack, 
  Heading, 
  Field,
  Spinner,
  Text,
  Grid,
  GridItem,
  Box,
  Flex,
  Spacer,
  Icon,
  Portal,
  Select,
  createListCollection
} from '@chakra-ui/react';
import { FiPlus } from 'react-icons/fi';
import { getTournaments } from '../services/api';
import type { Tournament } from '../types';
import TournamentCard from './TournamentCard';

// Tournament status types
type TournamentStatus = 'active' | 'upcoming' | 'ended' | null;

// Access the drawer context if available
const TournamentSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [allTournaments, setAllTournaments] = useState<Tournament[]>([]);
  const [filteredTournaments, setFilteredTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TournamentStatus>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Create the filter collection for the Select component
  const statusCollection = createListCollection({
    items: [
      { label: "Active", value: "active" },
      { label: "Upcoming", value: "upcoming" },
      { label: "Ended", value: "ended" },
    ]
  });
  
  // Try to access parent component context if available
  const drawerContext = (window as any).__drawerContext;
  const openDrawer = drawerContext?.openDrawer;
  const provider = drawerContext?.provider;

  // Fetch all tournaments on component mount and set up polling
  useEffect(() => {
    // Initial fetch
    fetchTournaments();
    
    // Set up polling interval (every 5 seconds)
    const intervalId = setInterval(() => {
      fetchTournaments();
    }, 5000);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  // Apply filters whenever search query or status filter changes
  useEffect(() => {
    applyFilters();
  }, [searchQuery, statusFilter, allTournaments]);

  const fetchTournaments = async () => {
    try {
      const tournaments = await getTournaments();
      setAllTournaments(tournaments);
      
      // Only show loading indicator on first load
      if (loading) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
      // Only update loading state on first load
      if (loading) {
        setLoading(false);
      }
    }
  };

  const applyFilters = () => {
    let filtered = [...allTournaments];
    
    // Apply search filter if there's a query with at least 1 characters
    if (searchQuery.trim().length >= 1) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tournament => 
        tournament.description.toLowerCase().includes(query) || 
        tournament.address.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter if one is selected
    if (statusFilter !== null) {
      const now = Math.floor(Date.now() / 1000);
      
      filtered = filtered.filter(tournament => {
        if (statusFilter === 'active') {
          return now >= tournament.startTime && now <= tournament.endTime;
        } else if (statusFilter === 'upcoming') {
          return now < tournament.startTime;
        } else if (statusFilter === 'ended') {
          return now > tournament.endTime;
        }
        return true;
      });
    }
    
    setFilteredTournaments(filtered);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Handle filter changes from select
  const handleFilterChange = (details: any) => {
    // If nothing selected (value empty array), set to null
    if (!details.value || details.value.length === 0) {
      setStatusFilter(null);
      return;
    }
    
    // Otherwise set to the selected status
    setStatusFilter(details.value[0] as TournamentStatus);
  };

  // Create Tournament button
  const renderCreateButton = () => {
    return (
      <Button 
        colorScheme="teal"
        size="md"
        onClick={openDrawer}
        disabled={!provider}
        opacity={!provider ? 0.7 : 1}
        cursor={!provider ? "not-allowed" : "pointer"}
        borderWidth="1px"
        borderColor="gray.500"
        title={!provider ? "Please connect your wallet first" : ""}
      >
        <Icon as={FiPlus} mr={2} />
        Create Tournament
      </Button>
    );
  };

  return (
    <VStack gap={6} align="stretch" width="100%" color="gray.700">
      <Flex 
        align="center" 
        gap={6} 
        flexWrap={{ base: "wrap", lg: "nowrap" }}
        alignItems="flex-end"
      >
        <Flex 
          flex={{ base: "1 1 100%", md: "1 1 auto" }} 
          mt={{ base: 4, lg: 0 }} 
          alignItems="flex-end"
          gap={4}
          flexWrap={{ base: "wrap", md: "nowrap" }}
        >
          <Box width={{ base: "100%", md: "250px" }}>
            <Field.Root>
              <Field.Label>Filter by description or address</Field.Label>
              <Input 
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Filter tournaments by keywords"
                ref={inputRef}
                color="gray.500"
              />
            </Field.Root>
          </Box>
          
          <Box width={{ base: "100%", md: "200px" }}>
            <Field.Root>
              <Field.Label>Filter by status</Field.Label>
              <Select.Root 
                collection={statusCollection} 
                size="md"
                variant="outline"
                color="gray.500"
                onValueChange={handleFilterChange}
              >
                <Select.HiddenSelect />
                <Select.Control>
                  <Select.Trigger>
                    <Select.ValueText placeholder="All Tournaments" />
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.ClearTrigger />
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Portal>
                  <Select.Positioner>
                    <Select.Content>
                      {statusCollection.items.map((status) => (
                        <Select.Item item={status} key={status.value}>
                          {status.label}
                          <Select.ItemIndicator />
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select.Positioner>
                </Portal>
              </Select.Root>
            </Field.Root>
          </Box>
        </Flex>
        
        <Spacer />
        
        <Box mt={{ base: 4, lg: 0 }}>
          {renderCreateButton()}
        </Box>
      </Flex>

      {loading ? (
        <VStack py={10}>
          <Spinner size="xl" color="teal.500" />
          <Text color="gray.600">Loading tournaments...</Text>
        </VStack>
      ) : (
        <VStack gap={4} align="stretch">
          <Heading size="md" color="gray.700">
            {filteredTournaments.length > 0 
              ? `Found ${filteredTournaments.length} tournament(s)` 
              : 'No tournaments found'}
          </Heading>
          
          <Grid 
            templateColumns={{
              base: "1fr",
              md: "repeat(2, 1fr)",
              lg: "repeat(3, 1fr)",
              xl: "repeat(4, 1fr)"
            }} 
            gap={4}
          >
            {filteredTournaments.map(tournament => (
              <GridItem key={tournament.address}>
                <TournamentCard tournament={tournament} />
              </GridItem>
            ))}
          </Grid>
        </VStack>
      )}
    </VStack>
  );
};

export default TournamentSearch; 