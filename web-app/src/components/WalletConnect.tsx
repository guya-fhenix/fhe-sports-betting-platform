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
import { toaster } from '../components/ui/toaster';

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
      toaster.error({
        title: 'Wallet Error',
        description: 'Please install a Web3 wallet like MetaMask'
      });
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
      
      // Request account access - this will prompt the user
      // This will throw an error if user rejects/cancels
      const accountsResult = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      // Check if user rejected or no accounts returned
      if (!accountsResult || accountsResult.length === 0) {
        throw new Error('User rejected the connection request or no accounts returned');
      }
      
      // Get the accounts using the provider to ensure we have the proper format
      const accounts = await provider.listAccounts();
      
      // Only proceed if we actually have accounts
      if (accounts.length === 0) {
        throw new Error('No accounts available after connection');
      }
      
      // Set the connected account and provider
      setAccount(accounts[0].address);
      onConnect(provider);
      
      toaster.success({
        title: 'Wallet Connected',
        description: 'Your wallet has been connected successfully'
      });
    } catch (error: any) {
      console.error('Error connecting wallet:', error);
      
      // Check for user rejection errors
      const errorMessage = error?.message || '';
      const isUserRejection = 
        errorMessage.includes('rejected') || 
        errorMessage.includes('cancelled') || 
        errorMessage.includes('canceled') ||
        errorMessage.includes('user denied');
      
      if (isUserRejection) {
        toaster.info({
          title: 'Connection Cancelled',
          description: 'You cancelled the wallet connection request'
        });
        
        // Ensure disconnected state is maintained
        localStorage.setItem('wallet_disconnected', 'true');
      } else {
        toaster.error({
          title: 'Connection Failed',
          description: 'Failed to connect wallet'
        });
      }
      
      // Clear any partial connection state
      setAccount(null);
      providerRef.current = null;
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
      toaster.info({
        title: 'Wallet Disconnected',
        description: 'Your wallet has been disconnected'
      });
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  };

  const copyAddress = () => {
    if (account) {
      navigator.clipboard.writeText(account);
      toaster.info({
        description: 'Address copied to clipboard'
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <HStack gap={4}>
      {account ? (
        <Menu.Root positioning={{ placement: "bottom" }}>
          <Menu.Trigger asChild padding={0}>
            <span>
              <Button colorScheme="teal">
                Wallet Connected <Icon ml={2}><FiChevronDown /></Icon>
              </Button>
            </span>
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