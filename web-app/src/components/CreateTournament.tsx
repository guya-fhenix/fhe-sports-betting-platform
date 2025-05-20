import { useState } from 'react';
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
  Textarea
} from '@chakra-ui/react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { ethers } from 'ethers';
import { createTournament } from '../services/blockchain';
import type { TournamentCreateInput, BettingOpportunity } from '../types';

interface CreateTournamentProps {
  provider: ethers.BrowserProvider | null;
}

const CreateTournament = ({ provider }: CreateTournamentProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, control, handleSubmit, formState: { errors } } = useForm<TournamentCreateInput>({
    defaultValues: {
      description: '',
      start_time: 0,
      end_time: 0,
      betting_opportunities: [{ id: 1, description: '', options: [''] }]
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'betting_opportunities'
  });
  
  const onSubmit = async (data: TournamentCreateInput) => {
    if (!provider) {
      alert('Please connect your wallet to create a tournament');
      return;
    }
    
    // Assign IDs sequentially to betting opportunities
    data.betting_opportunities = data.betting_opportunities.map((opportunity, index) => ({
      ...opportunity,
      id: index + 1
    }));
    
    // Convert date strings to timestamps
    // Keep minutes, but set seconds to 0
    data.start_time = Math.floor(new Date(data.start_time).setSeconds(0) / 1000);
    data.end_time = Math.floor(new Date(data.end_time).setSeconds(0) / 1000);
    
    setIsSubmitting(true);
    try {
      const tournamentAddress = await createTournament(provider, data);
      
      alert(`Tournament created at ${tournamentAddress}`);
      // Reset form or redirect
    } catch (error) {
      console.error('Error creating tournament:', error);
      alert('Failed to create tournament');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper function to add option to a betting opportunity
  const addOption = (index: number) => {
    const currentOptions = fields[index].options;
    const updatedOptions = [...currentOptions, ''];
    fields[index].options = updatedOptions;
  };
  
  // Helper function to remove option from a betting opportunity
  const removeOption = (betIndex: number, optionIndex: number) => {
    const currentOptions = fields[betIndex].options;
    if (currentOptions.length > 1) {
      const updatedOptions = currentOptions.filter((_, i) => i !== optionIndex);
      fields[betIndex].options = updatedOptions;
    }
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
          
          <Field.Root invalid={!!errors.start_time}>
            <Field.Label>Start Time</Field.Label>
            <Input 
              type="datetime-local" 
              {...register('start_time', { 
                required: 'Start time is required',
                valueAsNumber: true 
              })} 
            />
            {errors.start_time && <Field.ErrorText>{errors.start_time.message}</Field.ErrorText>}
            <Text fontSize="sm" color="gray.500">Select date, hour and minutes (seconds will be set to 00)</Text>
          </Field.Root>
          
          <Field.Root invalid={!!errors.end_time}>
            <Field.Label>End Time</Field.Label>
            <Input 
              type="datetime-local" 
              {...register('end_time', { 
                required: 'End time is required',
                valueAsNumber: true 
              })} 
            />
            {errors.end_time && <Field.ErrorText>{errors.end_time.message}</Field.ErrorText>}
            <Text fontSize="sm" color="gray.500">Select date, hour and minutes (seconds will be set to 00)</Text>
          </Field.Root>
          
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
                        color="white"
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
                      {...register(`betting_opportunities.${betIndex}.description` as const, {
                        required: 'Description is required'
                      })}
                      placeholder="Enter a description for this betting opportunity"
                    />
                  </Field.Root>
                  
                  <Field.Root>
                    <Field.Label>Options</Field.Label>
                    
                    <Box>
                      {field.options.map((option, optionIndex) => (
                        <HStack key={optionIndex} mb={2}>
                          <Field.Root>
                            <Input 
                              {...register(`betting_opportunities.${betIndex}.options.${optionIndex}` as const, {
                                required: 'Option is required'
                              })}
                              placeholder={`Option ${optionIndex + 1}`}
                            />
                          </Field.Root>
                          
                          {field.options.length > 1 && (
                            <IconButton
                              aria-label="Remove option"
                              size="sm"
                              colorScheme="red"
                              color="white"
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
                    </Box>
                  </Field.Root>
                </VStack>
              </Box>
            ))}
            
            <Button
              colorScheme="blue"
              color="white"
              onClick={() => append({ id: fields.length + 1, description: '', options: [''] })}
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
            color="white"
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