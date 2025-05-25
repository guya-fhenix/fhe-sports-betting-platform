import { Box, HStack, Text, IconButton, Icon } from '@chakra-ui/react';
import { FiCopy } from 'react-icons/fi';
import { toaster } from './toaster';

interface CopyAddressProps {
  address: string;
  label?: string;
  fontSize?: string;
  showFullAddress?: boolean;
  variant?: 'default' | 'compact';
}

export const CopyAddress = ({ 
  address, 
  label = "Contract Address", 
  fontSize = "sm",
  showFullAddress = true,
  variant = 'default'
}: CopyAddressProps) => {
  const copyToClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent parent click events
    
    try {
      await navigator.clipboard.writeText(address);
      toaster.success({
        title: 'Address Copied',
        description: 'Contract address copied to clipboard'
      });
    } catch (error) {
      console.error('Failed to copy address:', error);
      toaster.error({
        title: 'Copy Failed',
        description: 'Failed to copy address to clipboard'
      });
    }
  };

  const formatAddress = (addr: string) => {
    if (showFullAddress) return addr;
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  if (variant === 'compact') {
    return (
      <HStack gap={2} align="center">
        <Text 
          fontSize={fontSize}
          fontFamily="mono"
          color="gray.700"
          lineClamp={1}
        >
          {formatAddress(address)}
        </Text>
        <IconButton
          aria-label="Copy address"
          size="xs"
          variant="ghost"
          onClick={copyToClipboard}
          color="gray.500"
          _hover={{ color: "gray.700", bg: "gray.100" }}
        >
          <Icon>
            <FiCopy />
          </Icon>
        </IconButton>
      </HStack>
    );
  }

  return (
    <Box
      bg="gray.50"
      p={4}
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
    >
      <HStack justify="space-between" align="start" gap={3}>
        <Box flex="1" minW="0">
          <Text 
            fontSize="xs" 
            color="gray.500" 
            fontWeight="medium"
            mb={2}
            textTransform="uppercase"
            letterSpacing="wide"
          >
            {label}
          </Text>
          <Text 
            fontSize={fontSize}
            fontFamily="mono" 
            color="gray.700"
            wordBreak="break-all"
            lineHeight="1.4"
          >
            {formatAddress(address)}
          </Text>
        </Box>
        <IconButton
          aria-label="Copy address"
          size="sm"
          variant="ghost"
          onClick={copyToClipboard}
          color="gray.500"
          _hover={{ color: "gray.700", bg: "gray.100" }}
          flexShrink={0}
        >
          <Icon>
            <FiCopy />
          </Icon>
        </IconButton>
      </HStack>
    </Box>
  );
}; 