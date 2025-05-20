import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import {
  Box,
  Button,
  Container,
  Drawer,
  Flex,
  Heading,
  Icon,
  Spacer
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { FiPlus, FiX } from 'react-icons/fi';

// Components
import WalletConnect from './components/WalletConnect';
import TournamentSearch from './components/TournamentSearch';
import CreateTournament from './components/CreateTournament';

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

  const drawerProps = {
    id: "tournament-drawer",
    open: isDrawerOpen,
    onOpenChange: ({ open }: OpenChangeEvent) => setIsDrawerOpen(open),
    modal: true
  };

  return (
    <Router>
      <Container minH="100vh" bg="gray.50" minW="100vw">
        {/* Header */}
        <Box bg="teal.500" py={4} px={8} color="white">
          <Flex align="center">
            <Heading size="2xl">Sports Bets</Heading>
            <Spacer />
            <Button 
              colorScheme="teal" 
              variant="outline" 
              color="white"
              mr={4}
              onClick={openDrawer}
            >
              <Icon mr={2}>
                <FiPlus />
              </Icon>
              Create Tournament
            </Button>
            <WalletConnect onConnect={handleConnect} />
          </Flex>
        </Box>

        {/* Main Content - Full Width */}
        <Box py={8} px={8}>
          <Routes>
            <Route path="/" element={<TournamentSearch />} />
            {/* Add more routes as needed */}
          </Routes>
        </Box>

        {/* Create Tournament Drawer */}
        <Drawer.Root {...drawerProps}>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
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
                <CreateTournament provider={provider} />
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      </Container>
    </Router>
  );
}

export default App;
