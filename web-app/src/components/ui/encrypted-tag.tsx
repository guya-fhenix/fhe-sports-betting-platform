import { Box, HStack, Icon, Text } from '@chakra-ui/react';
import { FiLock } from 'react-icons/fi';

// Animated Space-themed Encrypted Tag Component
export const EncryptedTag = () => (
  <HStack 
    gap={2} 
    px={3} 
    py={2} 
    borderRadius="full"
    position="relative"
    overflow="hidden"
    bg="linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
    boxShadow="0 0 20px rgba(102, 126, 234, 0.4)"
    _before={{
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
      animation: 'shimmer 2s infinite'
    }}
    css={{
      '@keyframes shimmer': {
        '0%': { left: '-100%' },
        '100%': { left: '100%' }
      },
      '@keyframes float': {
        '0%, 100%': { transform: 'translateY(0px)' },
        '50%': { transform: 'translateY(-2px)' }
      },
      '@keyframes glow': {
        '0%, 100%': { 
          boxShadow: '0 0 20px rgba(102, 126, 234, 0.4), 0 0 40px rgba(118, 75, 162, 0.2)' 
        },
        '50%': { 
          boxShadow: '0 0 30px rgba(102, 126, 234, 0.6), 0 0 60px rgba(118, 75, 162, 0.4)' 
        }
      },
      animation: 'float 3s ease-in-out infinite, glow 2s ease-in-out infinite'
    }}
    transition="all 0.3s ease"
    _hover={{ 
      transform: 'scale(1.05)',
      boxShadow: '0 0 30px rgba(102, 126, 234, 0.6), 0 0 60px rgba(118, 75, 162, 0.4)'
    }}
  >
    <Icon 
      as={FiLock} 
      color="white" 
      boxSize={4}
      filter="drop-shadow(0 0 4px rgba(255,255,255,0.8))"
      css={{
        '@keyframes spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' }
        },
        animation: 'spin 8s linear infinite'
      }}
    />
    <Text 
      fontSize="xs" 
      color="white" 
      fontWeight="bold" 
      letterSpacing="wider"
      textShadow="0 0 8px rgba(255,255,255,0.8)"
      position="relative"
      zIndex={1}
    >
      ENCRYPTED
    </Text>
    {/* Floating particles effect */}
    <Box
      position="absolute"
      top="50%"
      left="20%"
      width="2px"
      height="2px"
      bg="white"
      borderRadius="full"
      opacity={0.8}
      css={{
        '@keyframes particle1': {
          '0%, 100%': { 
            transform: 'translate(0, 0) scale(1)',
            opacity: 0.8
          },
          '50%': { 
            transform: 'translate(10px, -5px) scale(1.5)',
            opacity: 0.4
          }
        },
        animation: 'particle1 4s ease-in-out infinite'
      }}
    />
    <Box
      position="absolute"
      top="30%"
      right="25%"
      width="1px"
      height="1px"
      bg="white"
      borderRadius="full"
      opacity={0.6}
      css={{
        '@keyframes particle2': {
          '0%, 100%': { 
            transform: 'translate(0, 0) scale(1)',
            opacity: 0.6
          },
          '33%': { 
            transform: 'translate(-8px, 8px) scale(2)',
            opacity: 0.2
          },
          '66%': { 
            transform: 'translate(5px, -3px) scale(1.2)',
            opacity: 0.8
          }
        },
        animation: 'particle2 5s ease-in-out infinite'
      }}
    />
  </HStack>
); 