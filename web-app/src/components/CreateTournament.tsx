import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Box,
  Button,
  Field,
  Heading,
  Icon,
  IconButton,
  Input,
  VStack,
  HStack,
  Text,
  Separator,
  Textarea,
  Flex
} from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { ethers } from 'ethers';
import { createTournament } from '../services/blockchain';
import type { TournamentCreateInput } from '../types';
import { toaster } from '../components/ui/toaster';

interface CreateTournamentProps {
  provider: ethers.BrowserProvider | null;
  onSuccess?: () => void; // Callback for successful creation
}

const CreateTournament = ({ provider, onSuccess }: CreateTournamentProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startDateValue, setStartDateValue] = useState('');
  const [endDateValue, setEndDateValue] = useState('');
  
  // Initialize date values on component mount
  useEffect(() => {
    // Set default dates
    const now = new Date();
    const oneWeekLater = new Date();
    oneWeekLater.setDate(now.getDate() + 7);
    
    // Format for datetime-local (YYYY-MM-DDThh:mm)
    setStartDateValue(formatDateForInput(now));
    setEndDateValue(formatDateForInput(oneWeekLater));
  }, []);
  
  const { register, control, handleSubmit, formState: { errors }, setError, clearErrors, getValues, reset } = useForm<TournamentCreateInput>({
    defaultValues: {
      description: '',
      startTime: 0,
      endTime: 0,
      bettingOpportunities: [{ id: 1, description: '', startTime: 0, options: ['', ''] }]
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'bettingOpportunities'
  });
  
  const validateOptions = () => {
    let isValid = true;
    
    // Check each betting opportunity for at least 2 options
    const values = getValues();
    values.bettingOpportunities.forEach((opportunity, index) => {
      // Count non-empty options
      const validOptions = opportunity.options.filter(opt => opt.trim() !== '');
      if (validOptions.length < 2) {
        setError(`bettingOpportunities.${index}.options`, {
          type: 'manual',
          message: 'At least 2 options are required'
        });
        isValid = false;
      }
    });
    
    return isValid;
  };
  
  const onSubmit = async (data: TournamentCreateInput) => {
    if (!provider) {
      toaster.error({
        title: 'Wallet Not Connected',
        description: 'Please connect your wallet to create a tournament'
      });
      return;
    }
    
    // Validate that each betting opportunity has at least 2 options
    if (!validateOptions()) {
      return;
    }
    
    // Process betting opportunities - keep as strings for the TournamentCreateInput
    data.bettingOpportunities = data.bettingOpportunities.map((opportunity, index) => ({
      ...opportunity,
      id: index + 1,
      startTime: 0, // Set startTime explicitly to 0 for each opportunity
      // Filter out any empty options but keep as strings
      options: opportunity.options.filter(opt => opt.trim() !== '')
    }));
    
    // Convert date strings to timestamps
    try {
      // Get the datetime values from our state
      console.log('Start date value:', startDateValue);
      console.log('End date value:', endDateValue);
      
      // Process start time
      if (startDateValue) {
        const startDate = new Date(startDateValue);
        if (isNaN(startDate.getTime())) {
          throw new Error('Invalid start time format');
        }
        data.startTime = Math.floor(startDate.getTime() / 1000);
      } else {
        throw new Error('Start time is required');
      }
      
      // Process end time
      if (endDateValue) {
        const endDate = new Date(endDateValue);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid end time format');
        }
        data.endTime = Math.floor(endDate.getTime() / 1000);
      } else {
        throw new Error('End time is required');
      }
      
      console.log('Processed data:', data);
    } catch (error) {
      console.error('Error processing dates:', error);
      toaster.error({
        title: 'Invalid Date Format',
        description: 'Please select valid dates for start and end times'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    // Show loading toast
    const loadingToastId = toaster.create({
      title: 'Creating Tournament',
      description: 'Please wait while your tournament is being created on the blockchain...',
      type: 'loading'
    });

    try {
      console.log('Creating tournament with data:', data);
      const tournamentAddress = await createTournament(provider, data);
      
      // Reset the form
      reset();
      
      // Close the drawer if callback is provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Show success toast
      toaster.success({
        title: 'Tournament Created',
        description: (
          <>
            Tournament created successfully.
            <Box as="div" mt={1} wordBreak="break-all" fontSize="sm">
              Address: {tournamentAddress}
            </Box>
          </>
        )
      });
      
    } catch (error) {
      console.error('Error creating tournament:', error);
      toaster.error({
        title: 'Tournament Creation Failed',
        description: 'Failed to create tournament. Please try again.'
      });
    } finally {
      // Remove loading toast
      toaster.dismiss(loadingToastId);
      setIsSubmitting(false);
    }
  };
  
  // Helper function to add option to a betting opportunity
  const addOption = (index: number) => {
    const currentOptions = fields[index].options;
    const updatedOptions = [...currentOptions, ''];
    fields[index].options = updatedOptions;
    
    // Clear any option errors since we're adding more options
    clearErrors(`bettingOpportunities.${index}.options`);
  };
  
  // Helper function to remove option from a betting opportunity
  const removeOption = (betIndex: number, optionIndex: number) => {
    const currentOptions = fields[betIndex].options;
    // Only allow removal if there will still be at least 2 options
    if (currentOptions.length > 2) {
      const updatedOptions = currentOptions.filter((_, i) => i !== optionIndex);
      fields[betIndex].options = updatedOptions;
    }
  };
  
  // Helper function to format date for datetime-local input
  const formatDateForInput = (date: Date) => {
    // Format: YYYY-MM-DDThh:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  
  return (
    <Box maxW="800px" mx="auto" p={4}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack gap={6} align="stretch">
          <Field.Root invalid={!!errors.description}>
            <Field.Label>Tournament Description</Field.Label>
            <Input 
              {...register('description', { required: 'Description is required' })} 
              placeholder="Enter tournament description"
            />
            {errors.description && <Field.ErrorText>{errors.description.message}</Field.ErrorText>}
          </Field.Root>
          
          <HStack gap={4} align="start">
            <Field.Root invalid={!!errors.startTime} flex="1">
              <Field.Label>Start Time</Field.Label>
              <Input 
                type="datetime-local" 
                value={startDateValue}
                onChange={(e) => setStartDateValue(e.target.value)}
              />
              {errors.startTime && <Field.ErrorText>{errors.startTime.message}</Field.ErrorText>}
              <Text fontSize="sm" color="gray.500">Select start date and time</Text>
            </Field.Root>
            
            <Field.Root invalid={!!errors.endTime} flex="1">
              <Field.Label>End Time</Field.Label>
              <Input 
                type="datetime-local" 
                value={endDateValue}
                onChange={(e) => setEndDateValue(e.target.value)}
              />
              {errors.endTime && <Field.ErrorText>{errors.endTime.message}</Field.ErrorText>}
              <Text fontSize="sm" color="gray.500">Select end date and time</Text>
            </Field.Root>
          </HStack>
          
          <Separator />
          
          <Box>
            <Heading size="md" mb={4}>Betting Opportunities</Heading>
            
            {fields.map((field, betIndex) => (
              <Box key={field.id} p={4} borderWidth="1px" borderRadius="md" mb={4}>
                <VStack gap={4} align="stretch">
                  <HStack justifyContent="space-between">
                    <Heading size="sm">Opportunity #{betIndex + 1}</Heading>
                    
                    {fields.length > 1 && (
                      <IconButton
                        aria-label="Remove opportunity"
                        size="sm"
                        colorScheme="red"
                        onClick={() => remove(betIndex)}
                      >
                        <Icon>
                          <FiTrash2 />
                        </Icon>
                      </IconButton>
                    )}
                  </HStack>
                  
                  <Field.Root>
                    <Field.Label>Description</Field.Label>
                    <Textarea 
                      {...register(`bettingOpportunities.${betIndex}.description` as const, {
                        required: 'Description is required'
                      })}
                      placeholder="Enter a description for this betting opportunity"
                    />
                  </Field.Root>
                  
                  <Field.Root invalid={!!errors.bettingOpportunities?.[betIndex]?.options}>
                    <Field.Label>Options (minimum 2 required)</Field.Label>
                    
                    <Box>
                      <Flex wrap="wrap" gap={2} mb={2}>
                        {field.options.map((option, optionIndex) => (
                          <Flex key={optionIndex} mb={2} width={{ base: "100%", md: "auto" }}>
                            <Field.Root flex="1">
                              <Input 
                                {...register(`bettingOpportunities.${betIndex}.options.${optionIndex}` as const, {
                                  required: 'Option is required'
                                })}
                                placeholder={`Option ${optionIndex + 1}`}
                              />
                            </Field.Root>
                            
                            {field.options.length > 2 && (
                              <IconButton
                                aria-label="Remove option"
                                size="sm"
                                colorScheme="red"
                                onClick={() => removeOption(betIndex, optionIndex)}
                                ml={2}
                              >
                                <Icon>
                                  <FiTrash2 />
                                </Icon>
                              </IconButton>
                            )}
                          </Flex>
                        ))}
                      </Flex>
                      
                      <Button
                        size="sm"
                        mt={2}
                        color="black"
                        onClick={() => addOption(betIndex)}
                      >
                        <Icon mr={2}>
                          <FiPlus />
                        </Icon>
                        Add Option
                      </Button>
                      
                      {errors.bettingOpportunities?.[betIndex]?.options && (
                        <Text color="red.500" fontSize="sm" mt={2}>
                          {errors.bettingOpportunities[betIndex].options?.message}
                        </Text>
                      )}
                    </Box>
                  </Field.Root>
                </VStack>
              </Box>
            ))}
            
            <Button
              colorScheme="blue"
              onClick={() => append({ id: fields.length + 1, description: '', startTime: 0, options: ['', ''] })}
              size="md"
              mt={2}
            >
              <Icon mr={2}>
                <FiPlus />
              </Icon>
              Add Betting Opportunity
            </Button>
          </Box>
          
          <Button
            colorScheme="teal"
            data-active={isSubmitting}
            type="submit"
            size="lg"
            mt={4}
            disabled={!provider}
          >
            {isSubmitting ? "Creating..." : "Create Tournament"}
          </Button>
          
          {!provider && (
            <Text color="red.500" fontSize="sm">
              Connect your wallet to create a tournament
            </Text>
          )}
        </VStack>
      </form>
    </Box>
  );
};

export default CreateTournament; 