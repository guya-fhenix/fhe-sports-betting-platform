import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Drawer,
  Flex,
  Heading,
  Icon,
  HStack,
  VStack
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { FiX, FiActivity } from 'react-icons/fi';

// Components
import WalletConnect from './components/WalletConnect';
import TournamentSearch from './components/TournamentSearch';
import TournamentScreen from './components/TournamentScreen';
import CreateTournament from './components/CreateTournament';
import EventLog from './components/EventLog';
import { Toaster } from './components/ui/toaster';
import BettingGroupScreen from './components/BettingGroupScreen';
import { Button } from './components/ui/button';

interface OpenChangeEvent {
  open: boolean;
}

function App() {
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Check if wallet was disconnected when component mounts
  useEffect(() => {
    const hasDisconnected = localStorage.getItem('wallet_disconnected') === 'true';
    if (hasDisconnected) {
      setProvider(null);
    }
  }, []);

  const handleConnect = (newProvider: ethers.BrowserProvider) => {
    // Check if this is a disconnection event
    const hasDisconnected = localStorage.getItem('wallet_disconnected') === 'true';
    
    if (hasDisconnected) {
      // If disconnected flag is set, immediately set provider to null
      // This handles the case when the WalletConnect component signals a disconnect
      setTimeout(() => setProvider(null), 0);
    } else {
      // Normal connection - update provider
      setProvider(newProvider);
    }
  };

  const openDrawer = () => setIsDrawerOpen(true);
  const closeDrawer = () => setIsDrawerOpen(false);

  // Handle successful tournament creation
  const handleTournamentCreated = () => {
    // Close the drawer
    closeDrawer();
  };

  const drawerProps = {
    id: "tournament-drawer",
    open: isDrawerOpen,
    onOpenChange: ({ open }: OpenChangeEvent) => setIsDrawerOpen(open),
    modal: true
  };

  // Expose drawer context for child components
  useEffect(() => {
    // Add the drawer context to window so child components can access it
    (window as any).__drawerContext = {
      openDrawer,
      provider
    };
    
    return () => {
      // Clean up when component unmounts
      delete (window as any).__drawerContext;
    };
  }, [provider, openDrawer]);

  return (
    <Router>
      <Box minH="100vh" bg="gray.50" w="100vw" display="flex" flexDirection="column">
        {/* Header - Fixed at top */}
        <Box 
          bg="white" 
          borderBottom="1px solid" 
          borderColor="gray.200" 
          boxShadow="sm"
          w="100%"
          flexShrink={0}
          zIndex={10}
        >
          <Container maxW="100%" py={4} px={8}>
            <Flex align="center" justify="space-between" w="100%">
              <Link to="/">
                <HStack gap={3} cursor="pointer" _hover={{ opacity: 0.8 }}>
                  <Box
                    w={10}
                    h={10}
                    bg="brand.500"
                    borderRadius="lg"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Icon color="white" fontSize="xl">
                      <FiActivity />
                    </Icon>
                  </Box>
                  <VStack align="start" gap={0}>
                    <Heading size="lg" color="gray.800" lineHeight="1">
                      Sports Bets
                    </Heading>
                    <Box fontSize="xs" color="gray.500" fontWeight="medium">
                      Blockchain Betting Platform
                    </Box>
                  </VStack>
                </HStack>
              </Link>
              
              <WalletConnect onConnect={handleConnect} />
            </Flex>
          </Container>
        </Box>

        {/* Main Layout - Content + EventLog */}
        <Flex flex="1" overflow="hidden" w="100%">
          {/* Main Content Area - Uses full page scroll */}
          <Box 
            flex="1" 
            p={8}
            overflowY="auto"
            overflowX="hidden"
            bg="gray.50"
            h="calc(100vh - 80px)"
          >
            <Routes>
              <Route path="/" element={<TournamentSearch />} />
              <Route path="/tournaments/:address" element={<TournamentScreen />} />
              <Route path="/tournaments/:tournamentAddress/groups/:groupAddress" element={<BettingGroupScreen />} />
            </Routes>
          </Box>
          
          {/* Event Log - Natural flow with own scroll */}
          <Box
            w={{ base: "300px", lg: "400px" }}
            minW={{ base: "300px", lg: "400px" }}
            maxW={{ base: "300px", lg: "400px" }}
            borderLeft="1px solid"
            borderColor="gray.200"
            bg="white"
            h="calc(100vh - 80px)"
            flexShrink={0}
          >
            <EventLog 
              isOpen={true} 
              onClose={() => {}} 
            />
          </Box>
        </Flex>

        {/* Create Tournament Drawer */}
        <Drawer.Root {...drawerProps}>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content width="50vw" maxWidth="50vw" bg="white">
              <Drawer.Header borderBottom="1px solid" borderColor="gray.200" p={6}>
                <Drawer.Title fontSize="xl" fontWeight="bold" color="gray.800">
                  Create Tournament
                </Drawer.Title>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={closeDrawer} 
                  position="absolute" 
                  right={4} 
                  top={4}
                  p={2}
                >
                  <Icon>
                    <FiX />
                  </Icon>
                </Button>
              </Drawer.Header>
              <Drawer.Body p={6}>
                <CreateTournament 
                  provider={provider} 
                  onSuccess={handleTournamentCreated} 
                />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
        
        {/* Toast notifications */}
        <Toaster />
      </Box>
    </Router>
  );
}

export default App;
