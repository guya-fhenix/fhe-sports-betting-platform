import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  VStack,
  Badge as ChakraBadge,
  Spinner,
  Button as ChakraButton
} from '@chakra-ui/react';
import { API_BASE_URL } from '../config';
import { io, Socket } from 'socket.io-client';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardBody, CardHeader } from './ui/card';

// Define the event type that will come from Socket.IO
interface CloudEvent {
  id: string;
  type: 'tournament' | 'group' | 'block' | 'system';
  message: string;
  timestamp: number;
  data?: any;
}

// Define gas information interface
interface GasInfo {
  gas_used: number;
  gas_price_gwei: number;
  gas_cost_eth: number;
  gas_cost_usd?: number;
  eth_price_usd?: number;
}

interface EventLogProps {
  isOpen: boolean;
  onClose: () => void;
}

const EventLog = ({ isOpen, onClose }: EventLogProps) => {
  const [events, setEvents] = useState<CloudEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const bgColor = 'white';
  const borderColor = 'gray.200';
  
  // When the component mounts or is shown
  useEffect(() => {
    // Create a token to track this specific mount instance
    const mountToken = Date.now();
    (window as any).__lastEventLogMount = mountToken;
    
    // Connect to Socket.IO server
    connectSocket();
    
    return () => {
      // Mark this mount as outdated
      if ((window as any).__lastEventLogMount === mountToken) {
        delete (window as any).__lastEventLogMount;
      }
      
      // Disconnect socket
      disconnectSocket();
    };
  }, []);
  
  // Scroll to top when new events arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = 0; // Scroll to top since newest events are on top
    }
  }, [events]);
  
  const connectSocket = () => {
    // Don't connect if already connecting or connected
    if (isConnecting || isConnected) {
      return;
    }
    
    setIsConnecting(true);
    
    // Create Socket.IO connection with auto reconnection
    const socketUrl = API_BASE_URL;
    console.log(`Connecting to Socket.IO: ${socketUrl}`);
    
    try {
      const socket = io(socketUrl, { 
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        path: '/socket.io'
      });
      
      // Save socket reference
      socketRef.current = socket;
      
      // Handle connection event
      socket.on('connect', () => {
        setIsConnected(true);
        setIsConnecting(false);
        console.log('Connected to Socket.IO server');
        
        // We no longer need to add our own connected event since the server sends one
        // The server will emit a 'blockchain_event' with the connection message
      });
      
      // Handle disconnection
      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log(`Disconnected from Socket.IO server: ${reason}`);
        
        // Add disconnected event
        const disconnectedEvent: CloudEvent = {
          id: `disconnect-${Date.now()}`,
          type: 'system',
          message: `Client disconnected: ${reason}`,
          timestamp: Date.now()
        };
        setEvents(prev => [disconnectedEvent, ...prev].slice(0, 100));
      });
      
      // Handle reconnection attempt
      socket.on('reconnect_attempt', (attemptNumber) => {
        setIsConnecting(true);
        console.log(`Reconnection attempt ${attemptNumber}...`);
        
        // Add reconnect event
        const reconnectEvent: CloudEvent = {
          id: `reconnect-${Date.now()}`,
          type: 'system',
          message: `Client reconnection attempt ${attemptNumber}`,
          timestamp: Date.now()
        };
        setEvents(prev => [reconnectEvent, ...prev].slice(0, 100));
      });
      
      // Handle reconnection success
      socket.on('reconnect', (attemptNumber) => {
        setIsConnected(true);
        setIsConnecting(false);
        console.log(`Reconnected after ${attemptNumber} attempts`);
        
        // We don't need to add our own reconnected event
        // The server will emit a 'blockchain_event' with the connection message upon reconnect
      });
      
      // Handle error
      socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
        
        // Add error event
        const errorEvent: CloudEvent = {
          id: `error-${Date.now()}`,
          type: 'system',
          message: `Client connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: Date.now()
        };
        setEvents(prev => [errorEvent, ...prev].slice(0, 100));
      });
      
      // Handle blockchain events
      socket.on('blockchain_event', (event: CloudEvent) => {
        setEvents(prev => [event, ...prev].slice(0, 100));
      });
      
    } catch (error) {
      console.error('Error creating Socket.IO connection:', error);
      setIsConnecting(false);
      
      // Add error event
      const errorEvent: CloudEvent = {
        id: `error-${Date.now()}`,
        type: 'system',
        message: `Client failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
      setEvents(prev => [errorEvent, ...prev].slice(0, 100));
    }
  };
  
  const disconnectSocket = () => {
    if (socketRef.current) {
      console.log('Disconnecting Socket.IO...');
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  };
  
  const reconnect = () => {
    disconnectSocket();
    connectSocket();
  };
  
  const getEventBadge = (type: string) => {
    switch (type) {
      case 'tournament':
        return <Badge variant="success">Tournament</Badge>;
      case 'group':
        return <Badge variant="betting">Group</Badge>;
      case 'block':
        return <Badge variant="outline">Block</Badge>;
      case 'system':
        return <Badge variant="ended">System</Badge>;
      default:
        return <Badge variant="solid">Event</Badge>;
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Format gas information for display
  const formatGasInfo = (gasInfo: GasInfo) => {
    const gasUsedFormatted = gasInfo.gas_used.toLocaleString();
    const gasPriceFormatted = gasInfo.gas_price_gwei.toFixed(2);
    const gasEthFormatted = gasInfo.gas_cost_eth.toFixed(6);
    const gasUsdFormatted = gasInfo.gas_cost_usd ? `$${gasInfo.gas_cost_usd.toFixed(2)}` : 'N/A';
    
    return {
      gasUsed: gasUsedFormatted,
      gasPrice: gasPriceFormatted,
      gasEth: gasEthFormatted,
      gasUsd: gasUsdFormatted
    };
  };
  
  // Check if event has gas information
  const hasGasInfo = (event: CloudEvent): boolean => {
    return event.data && event.data.gas_info && typeof event.data.gas_info === 'object';
  };
  
  // Return null if not open
  if (!isOpen) return null;
  
  return (
    <Box
      w="100%"
      h="100%"
      minH="100%"
      maxH="100%"
      bg="white"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Fixed Header - Event Log Title and Connection Status */}
      <Box 
        p={4} 
        borderBottom="1px solid" 
        borderColor="gray.200"
        bg="gray.50"
        flexShrink={0}
        w="100%"
        overflow="hidden"
      >
        <Flex justify="space-between" align="center" w="100%">
          <Heading 
            size="md" 
            color="gray.800" 
            overflow="hidden"
            textOverflow="ellipsis"
            whiteSpace="nowrap"
          >
            Event Log
          </Heading>
          <Flex align="center" gap={2} flexShrink={0}>
            {isConnected ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="error">Disconnected</Badge>
            )}
          </Flex>
        </Flex>
      </Box>
      
      {/* Scrollable Content Area - Only this section scrolls */}
      <Box 
        flex="1"
        overflow="hidden"
        position="relative"
        w="100%"
      >
        {isConnecting ? (
          <Flex justify="center" align="center" h="100%" direction="column" gap={4}>
            <Spinner size="lg" color="brand.500" />
            <Text color="gray.500" fontWeight="medium">Connecting to event stream...</Text>
          </Flex>
        ) : !isConnected ? (
          <Flex justify="center" align="center" h="100%" direction="column" gap={6} p={6}>
            <VStack gap={3} textAlign="center">
              <Text color="gray.600" fontSize="lg">Not connected to event stream</Text>
              <Text color="gray.500" fontSize="sm">
                Unable to receive real-time blockchain events
              </Text>
            </VStack>
            <Button variant="solid" onClick={reconnect}>
              Reconnect Now
            </Button>
          </Flex>
        ) : (
          <Box 
            h="100%"
            w="100%"
            overflowY="auto" 
            overflowX="hidden"
            ref={containerRef}
            p={4}
          >
            {events.length === 0 ? (
              <Flex justify="center" align="center" h="100%" direction="column" gap={3}>
                <Text color="gray.500" fontSize="lg">Waiting for events...</Text>
                <Text color="gray.400" fontSize="sm" textAlign="center">
                  Blockchain events will appear here in real-time
                </Text>
              </Flex>
            ) : (
              <VStack 
                gap={3} 
                align="stretch" 
                w="100%"
                pb={4}
              >
                {events.map((event, index) => (
                  <Card 
                    key={event.id || index} 
                    variant="outline" 
                    _hover={{ 
                      bg: 'gray.50',
                      borderColor: 'brand.200',
                      transform: 'translateY(-1px)',
                      boxShadow: 'md'
                    }}
                    transition="all 0.2s ease"
                    w="100%"
                    minW={0}
                    maxW="100%"
                  >
                    <CardBody p={4}>
                      <VStack align="stretch" gap={3} w="100%">
                        <Flex justify="space-between" align="center" w="100%">
                          {getEventBadge(event.type)}
                          <Text fontSize="xs" color="gray.500" fontWeight="medium" flexShrink={0}>
                            {formatTimestamp(event.timestamp)}
                          </Text>
                        </Flex>
                        <Text 
                          fontSize="sm" 
                          color="gray.700" 
                          lineHeight="1.5"
                          wordBreak="break-word"
                          overflowWrap="break-word"
                          w="100%"
                          maxW="100%"
                        >
                          {event.message}
                        </Text>
                        
                        {/* Gas Information Display */}
                        {hasGasInfo(event) && (
                          <Box 
                            mt={2} 
                            p={3} 
                            bg="gray.50" 
                            borderRadius="md" 
                            border="1px solid" 
                            borderColor="gray.200"
                          >
                            <Text fontSize="xs" fontWeight="semibold" color="gray.600" mb={2}>
                              ⛽ Transaction Gas Details
                            </Text>
                            <VStack align="stretch" gap={1}>
                              {(() => {
                                const gasInfo = formatGasInfo(event.data.gas_info);
                                return (
                                  <>
                                    <Flex justify="space-between" align="center">
                                      <Text fontSize="xs" color="gray.600">Gas Used:</Text>
                                      <Text fontSize="xs" color="gray.800" fontWeight="medium" fontFamily="mono">
                                        {gasInfo.gasUsed}
                                      </Text>
                                    </Flex>
                                    <Flex justify="space-between" align="center">
                                      <Text fontSize="xs" color="gray.600">Gas Price:</Text>
                                      <Text fontSize="xs" color="gray.800" fontWeight="medium" fontFamily="mono">
                                        {gasInfo.gasPrice} Gwei
                                      </Text>
                                    </Flex>
                                    <Flex justify="space-between" align="center">
                                      <Text fontSize="xs" color="gray.600">Cost (ETH):</Text>
                                      <Text fontSize="xs" color="blue.600" fontWeight="semibold" fontFamily="mono">
                                        {gasInfo.gasEth} ETH
                                      </Text>
                                    </Flex>
                                    <Flex justify="space-between" align="center">
                                      <Text fontSize="xs" color="gray.600">Cost (USD):</Text>
                                      <Text fontSize="xs" color="green.600" fontWeight="semibold" fontFamily="mono">
                                        {gasInfo.gasUsd}
                                      </Text>
                                    </Flex>
                                  </>
                                );
                              })()}
                            </VStack>
                          </Box>
                        )}
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
              </VStack>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default EventLog; 