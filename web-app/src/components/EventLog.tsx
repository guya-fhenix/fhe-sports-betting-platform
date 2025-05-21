import { useEffect, useState, useRef } from 'react';
import {
  Box,
  Flex,
  Text,
  Heading,
  VStack,
  Badge,
  Spinner,
  Button
} from '@chakra-ui/react';
import { API_BASE_URL } from '../config';
import { io, Socket } from 'socket.io-client';

// Define the event type that will come from Socket.IO
interface CloudEvent {
  id: string;
  type: 'tournament' | 'group' | 'block' | 'system';
  message: string;
  timestamp: number;
  data?: any;
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
        return <Badge colorScheme="green">Tournament</Badge>;
      case 'group':
        return <Badge colorScheme="blue">Group</Badge>;
      case 'block':
        return <Badge colorScheme="purple">Block</Badge>;
      case 'system':
        return <Badge colorScheme="gray">System</Badge>;
      default:
        return <Badge>Event</Badge>;
    }
  };
  
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Return null if not open
  if (!isOpen) return null;
  
  return (
    <Box
      width="350px"
      minWidth="350px"
      maxWidth="350px"
      height="calc(100vh - 72px)" // Subtract header height
      bg={bgColor}
      borderLeft="1px"
      borderColor={borderColor}
      overflow="hidden"
      display="flex"
      flexDirection="column"
    >
      <Flex 
        p={4} 
        borderBottom="1px" 
        borderColor={borderColor} 
        justify="space-between" 
        align="center"
      >
        <Heading size="md" color="gray.700">Event Log</Heading>
        <Flex align="center" gap={2}>
          {isConnected ? (
            <Badge colorScheme="green">Connected</Badge>
          ) : (
            <Badge colorScheme="red">Disconnected</Badge>
          )}
        </Flex>
      </Flex>
      
      {isConnecting ? (
        <Flex justify="center" align="center" flex="1">
          <Spinner size="lg" color="teal.500" />
          <Text ml={3} color="gray.500">Connecting...</Text>
        </Flex>
      ) : !isConnected ? (
        <Flex justify="center" align="center" flex="1" direction="column" gap={4}>
          <Text>Not connected to event stream</Text>
          <Button size="sm" colorScheme="teal" onClick={reconnect}>
            Reconnect Now
          </Button>
        </Flex>
      ) : (
        <VStack 
          flex="1" 
          overflowY="auto" 
          gap={0} 
          align="stretch" 
          ref={containerRef}
          p={2}
        >
          {events.length === 0 ? (
            <Flex justify="center" align="center" height="100%">
              <Text color="gray.500">Waiting for events...</Text>
            </Flex>
          ) : (
            events.map((event, index) => (
              <Box key={event.id || index} p={2} _hover={{ bg: 'gray.50' }} color="gray.700">
                <Flex justify="space-between" align="center" mb={1}>
                  {getEventBadge(event.type)}
                  <Text fontSize="xs" color="gray.500">
                    {formatTimestamp(event.timestamp)}
                  </Text>
                </Flex>
                <Text fontSize="sm">{event.message}</Text>
                {index < events.length - 1 && (
                  <Box height="1px" bg="gray.200" my={2} />
                )}
              </Box>
            ))
          )}
        </VStack>
      )}
    </Box>
  );
};

export default EventLog; 