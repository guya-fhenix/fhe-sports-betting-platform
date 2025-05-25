import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Box,
  Button as ChakraButton,
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
import { Button } from './ui/button';
import { Card, CardBody, CardHeader } from './ui/card';

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
    <Box maxW="800px" mx="auto">
      <form onSubmit={handleSubmit(onSubmit)}>
        <VStack gap={8} align="stretch">
          {/* Tournament Details */}
          <Card variant="default">
            <CardHeader>
              <Heading size="lg" color="gray.800">Tournament Details</Heading>
            </CardHeader>
            <CardBody>
              <VStack gap={6} align="stretch">
                <Field.Root invalid={!!errors.description}>
                  <Field.Label fontWeight="medium" color="gray.700">Tournament Description</Field.Label>
                  <Input 
                    {...register('description', { required: 'Description is required' })} 
                    placeholder="Enter tournament description"
                    size="lg"
                  />
                  {errors.description && <Field.ErrorText>{errors.description.message}</Field.ErrorText>}
                </Field.Root>
                
                <HStack gap={6} align="start">
                  <Field.Root invalid={!!errors.startTime} flex="1">
                    <Field.Label fontWeight="medium" color="gray.700">Start Time</Field.Label>
                    <Input 
                      type="datetime-local" 
                      value={startDateValue}
                      onChange={(e) => setStartDateValue(e.target.value)}
                      size="lg"
                    />
                    {errors.startTime && <Field.ErrorText>{errors.startTime.message}</Field.ErrorText>}
                    <Text fontSize="sm" color="gray.500" mt={1}>Select start date and time</Text>
                  </Field.Root>
                  
                  <Field.Root invalid={!!errors.endTime} flex="1">
                    <Field.Label fontWeight="medium" color="gray.700">End Time</Field.Label>
                    <Input 
                      type="datetime-local" 
                      value={endDateValue}
                      onChange={(e) => setEndDateValue(e.target.value)}
                      size="lg"
                    />
                    {errors.endTime && <Field.ErrorText>{errors.endTime.message}</Field.ErrorText>}
                    <Text fontSize="sm" color="gray.500" mt={1}>Select end date and time</Text>
                  </Field.Root>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
          
          {/* Betting Opportunities */}
          <Card variant="default">
            <CardHeader>
              <HStack justify="space-between" align="center">
                <Heading size="lg" color="gray.800">Bets</Heading>
                <Button
                  variant="outline"
                  onClick={() => append({ id: fields.length + 1, description: '', startTime: 0, options: ['', ''] })}
                  size="md"
                >
                  <Icon mr={2}>
                    <FiPlus />
                  </Icon>
                  Add
                </Button>
              </HStack>
            </CardHeader>
            <CardBody>
              <VStack gap={6} align="stretch">
                {fields.map((field, betIndex) => (
                  <Card key={field.id} variant="outline">
                    <CardBody p={6}>
                      <VStack gap={5} align="stretch">
                        <HStack justifyContent="space-between" align="center">
                          <Heading size="md" color="gray.700">Bet #{betIndex + 1}</Heading>
                          
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
                          <Field.Label fontWeight="medium" color="gray.700">Description</Field.Label>
                          <Textarea 
                            {...register(`bettingOpportunities.${betIndex}.description` as const, {
                              required: 'Description is required'
                            })}
                            placeholder="Enter a description for this betting opportunity"
                            size="lg"
                            rows={3}
                          />
                        </Field.Root>
                        
                        <Field.Root invalid={!!errors.bettingOpportunities?.[betIndex]?.options}>
                          <Field.Label fontWeight="medium" color="gray.700">
                            Betting Options (minimum 2 required)
                          </Field.Label>
                          
                          <VStack gap={3} align="stretch">
                            {field.options.map((option, optionIndex) => (
                              <HStack key={optionIndex} gap={3}>
                                <Input 
                                  {...register(`bettingOpportunities.${betIndex}.options.${optionIndex}` as const, {
                                    required: 'Option is required'
                                  })}
                                  placeholder={`Option ${optionIndex + 1}`}
                                  size="md"
                                  flex="1"
                                />
                                
                                {field.options.length > 2 && (
                                  <IconButton
                                    aria-label="Remove option"
                                    size="sm"
                                    colorScheme="red"
                                    onClick={() => removeOption(betIndex, optionIndex)}
                                  >
                                    <Icon>
                                      <FiTrash2 />
                                    </Icon>
                                  </IconButton>
                                )}
                              </HStack>
                            ))}
                            
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => addOption(betIndex)}
                              w="fit-content"
                            >
                              <Icon mr={2}>
                                <FiPlus />
                              </Icon>
                              Add Option
                            </Button>
                            
                            {errors.bettingOpportunities?.[betIndex]?.options && (
                              <Text color="error.500" fontSize="sm">
                                {errors.bettingOpportunities[betIndex].options?.message}
                              </Text>
                            )}
                          </VStack>
                        </Field.Root>
                      </VStack>
                    </CardBody>
                  </Card>
                ))}
                
                {fields.length === 0 && (
                  <Box textAlign="center" py={8}>
                    <Text color="gray.500" mb={4}>No betting opportunities added yet</Text>
                    <Button
                      variant="outline"
                      onClick={() => append({ id: 1, description: '', startTime: 0, options: ['', ''] })}
                    >
                      <Icon mr={2}>
                        <FiPlus />
                      </Icon>
                      Add First Opportunity
                    </Button>
                  </Box>
                )}
              </VStack>
            </CardBody>
          </Card>
          
          {/* Submit Section */}
          <Card variant="outline">
            <CardBody p={6}>
              <VStack gap={4} align="stretch">
                <Button
                  variant="solid"
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  loadingText="Creating Tournament..."
                  disabled={!provider}
                  w="100%"
                >
                  Create Tournament
                </Button>
                
                {!provider && (
                  <Text color="error.500" fontSize="sm" textAlign="center">
                    Connect your wallet to create a tournament
                  </Text>
                )}
              </VStack>
            </CardBody>
          </Card>
        </VStack>
      </form>
    </Box>
  );
};

export default CreateTournament; 