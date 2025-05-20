import { useState, useEffect, useRef } from 'react';
import { 
  Button, 
  Text, 
  HStack, 
  Box,
  Icon,
  Flex,
  Menu,
  Portal
} from '@chakra-ui/react';
import { ethers } from 'ethers';
import { FiChevronDown, FiLogOut, FiCopy } from 'react-icons/fi';

interface WalletConnectProps {
  onConnect: (provider: ethers.BrowserProvider) => void;
}

const WalletConnect = ({ onConnect }: WalletConnectProps) => {
  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const providerRef = useRef<ethers.BrowserProvider | null>(null);

  useEffect(() => {
    // Check if user has previously disconnected
    const hasDisconnected = localStorage.getItem('wallet_disconnected') === 'true';
    
    if (hasDisconnected) {
      return; // Don't auto-connect if user previously disconnected
    }
    
    const checkConnection = async () => {
      // Check if already connected
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          providerRef.current = provider;
          
          // Just check accounts without requesting
          const accounts = await provider.listAccounts();
          
          if (accounts.length > 0) {
            setAccount(accounts[0].address);
            onConnect(provider);
          }
        } catch (error) {
          console.error('Error checking connection:', error);
        }
      }
    };

    checkConnection();
  }, [onConnect]);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install a Web3 wallet like MetaMask');
      return;
    }

    try {
      setConnecting(true);
      
      // Reset connection state to force a fresh connection request
      localStorage.removeItem('wallet_disconnected');
      
      // Reset ethereum connection to force a new request
      try {
        // Force disconnect by requesting with empty params
        // This helps clear MetaMask's cached permission
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (e) {
        // The above might fail on some wallets, but that's okay
        console.log('Forcing permission reset:', e);
      }
      
      // Create new provider
      const provider = new ethers.BrowserProvider(window.ethereum);
      providerRef.current = provider;
      
      // Request account access - this will prompt the user even if previously connected
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      const accounts = await provider.listAccounts();
      setAccount(accounts[0].address);
      onConnect(provider);
      
      alert('Wallet connected successfully');
    } catch (error) {
      console.error('Error connecting wallet:', error);
      alert('Failed to connect wallet');
    } finally {
      setConnecting(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      // Clear ethereum cached connection if possible
      if (window.ethereum && window.ethereum.removeAllListeners) {
        window.ethereum.removeAllListeners();
      }
      
      // Set localStorage flag to remember disconnected state
      localStorage.setItem('wallet_disconnected', 'true');
      
      // Clear UI state immediately
      setAccount(null);
      providerRef.current = null;
      
      // Notify parent component about the disconnection
      if (onConnect) {
        try {
          // We need to maintain type safety here
          // Pass an empty BrowserProvider that will be immediately set to null in parent
          const emptyProvider = new ethers.BrowserProvider(
            window.ethereum || {} as any
          );
          onConnect(emptyProvider);
          // Parent will set provider to null in App.tsx
        } catch (e) {
          console.log('Error creating empty provider', e);
        }
      }
      
      // Notification
      alert('Wallet disconnected');
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      alert('Address copied to clipboard');
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <HStack gap={4}>
      {account ? (
        <Menu.Root positioning={{ placement: "bottom" }}>
          <Menu.Trigger padding={0}>
            <Button colorScheme="teal" color="white">
              Wallet Connected <Icon ml={2}><FiChevronDown /></Icon>
            </Button>
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content>
                <Menu.Item value="copy" onClick={copyAddress}>
                  <Flex align="center" gap={2}>
                    <Icon><FiCopy /></Icon>
                    <Box>
                      <Text fontWeight="bold">Address</Text>
                      <Text fontSize="sm">{formatAddress(account)}</Text>
                    </Box>
                  </Flex>
                </Menu.Item>
                <Menu.Item value="disconnect" onClick={disconnectWallet}>
                  <Flex align="center" gap={2}>
                    <Icon><FiLogOut /></Icon>
                    <Text>Disconnect</Text>
                  </Flex>
                </Menu.Item>
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      ) : (
        <Button
          colorScheme="teal"
          color="white"
          onClick={connectWallet}
          loading={connecting}
          loadingText="Connecting"
        >
          Connect Wallet
        </Button>
      )}
    </HStack>
  );
};

export default WalletConnect;

// Add type declaration for window.ethereum
declare global {
  interface Window {
    ethereum: any;
  }
} 