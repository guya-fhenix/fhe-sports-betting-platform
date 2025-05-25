import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import {
  Box,
  Container,
  Drawer,
  Flex,
  Heading,
  Spacer,
  Button,
  Icon
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { FiX, FiActivity, FiList } from 'react-icons/fi';

// Components
import WalletConnect from './components/WalletConnect';
import TournamentSearch from './components/TournamentSearch';
import TournamentScreen from './components/TournamentScreen';
import CreateTournament from './components/CreateTournament';
import EventLog from './components/EventLog';
import { Toaster } from './components/ui/toaster';
import BettingGroupScreen from './components/BettingGroupScreen';

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
      <Container minH="100vh" bg="gray.50" minW="100vw" padding={0}>
        {/* Header */}
        <Box bg="teal.500" py={4} px={8} color="white">
          <Flex align="center">
            <Link to="/">
              <Heading size="2xl" cursor="pointer" _hover={{ opacity: 0.9 }}>Sports Bets</Heading>
            </Link>
            <Spacer />
            <WalletConnect onConnect={handleConnect} />
          </Flex>
        </Box>

        {/* Main Content Layout with EventLog */}
        <Flex>
          {/* Main Content Area */}
          <Box 
            py={8} 
            px={8} 
            flex="1" 
            transition="width 0.3s ease"
            overflowX="hidden"
          >
            <Routes>
              <Route path="/" element={<TournamentSearch />} />
              <Route path="/tournaments/:address" element={<TournamentScreen />} />
              <Route path="/tournaments/:tournamentAddress/groups/:groupAddress" element={<BettingGroupScreen />} />
              {/* Add more routes as needed */}
            </Routes>
          </Box>
          
          {/* Event Log - Always visible */}
          <EventLog 
            isOpen={true} 
            onClose={() => {}} 
          />
        </Flex>

        {/* Create Tournament Drawer */}
        <Drawer.Root {...drawerProps}>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content width="50vw" maxWidth="50vw">
              <Drawer.Header>
                <Drawer.Title>Create Tournament</Drawer.Title>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={closeDrawer} 
                  position="absolute" 
                  right="8px" 
                  top="8px"
                >
                  <Icon>
                    <FiX />
                  </Icon>
                </Button>
              </Drawer.Header>
              <Drawer.Body>
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
      </Container>
    </Router>
  );
}

export default App;
