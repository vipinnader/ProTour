import React from 'react';
import { Box, HStack, VStack, Text, Icon, Progress } from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  status: 'completed' | 'current' | 'pending' | 'disabled';
}

interface WorkflowStepperProps {
  currentStep: string;
  tournamentId?: string;
  playerCount?: number;
  hasValidation?: boolean;
}

const WorkflowStepper: React.FC<WorkflowStepperProps> = ({
  currentStep,
  tournamentId,
  playerCount = 0,
  hasValidation = false,
}) => {
  const getSteps = (): WorkflowStep[] => [
    {
      id: 'create',
      title: 'Create Tournament',
      description: 'Set up tournament details',
      icon: 'add-circle',
      status: tournamentId
        ? 'completed'
        : currentStep === 'create'
          ? 'current'
          : 'pending',
    },
    {
      id: 'import',
      title: 'Import Players',
      description: `${playerCount} players imported`,
      icon: 'upload-file',
      status: !tournamentId
        ? 'disabled'
        : playerCount > 0
          ? 'completed'
          : currentStep === 'import'
            ? 'current'
            : 'pending',
    },
    {
      id: 'validate',
      title: 'Validate Data',
      description: hasValidation ? 'Data validated' : 'Review imported data',
      icon: 'check-circle',
      status: !tournamentId
        ? 'disabled'
        : playerCount === 0
          ? 'disabled'
          : hasValidation
            ? 'completed'
            : currentStep === 'validate'
              ? 'current'
              : 'pending',
    },
    {
      id: 'bracket',
      title: 'Generate Bracket',
      description: 'Create tournament bracket',
      icon: 'account-tree',
      status:
        !tournamentId || playerCount < 4
          ? 'disabled'
          : currentStep === 'bracket'
            ? 'current'
            : hasValidation
              ? 'pending'
              : 'pending',
    },
  ];

  const steps = getSteps();
  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

  const getStatusColor = (status: WorkflowStep['status']) => {
    switch (status) {
      case 'completed':
        return 'green.500';
      case 'current':
        return 'blue.500';
      case 'pending':
        return 'gray.400';
      case 'disabled':
        return 'gray.300';
      default:
        return 'gray.400';
    }
  };

  const getStatusIcon = (step: WorkflowStep) => {
    if (step.status === 'completed') return 'check';
    if (step.status === 'current') return 'radio-button-checked';
    return step.icon;
  };

  return (
    <Box bg="white" p={4} rounded="lg" shadow={1} mb={4}>
      <VStack space={4}>
        {/* Progress Header */}
        <VStack space={2}>
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize="md" fontWeight="bold">
              Tournament Setup Progress
            </Text>
            <Text fontSize="sm" color="gray.600">
              {completedSteps}/{totalSteps} completed
            </Text>
          </HStack>
          <Progress
            value={progressPercentage}
            colorScheme="green"
            rounded="full"
            h={2}
          />
        </VStack>

        {/* Steps */}
        <VStack space={3}>
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <HStack space={3} alignItems="center">
                {/* Step Icon */}
                <Box
                  w={10}
                  h={10}
                  rounded="full"
                  bg={getStatusColor(step.status)}
                  alignItems="center"
                  justifyContent="center"
                  opacity={step.status === 'disabled' ? 0.5 : 1}
                >
                  <Icon
                    as={MaterialIcons}
                    name={getStatusIcon(step)}
                    size="sm"
                    color="white"
                  />
                </Box>

                {/* Step Content */}
                <VStack flex={1} space={1}>
                  <Text
                    fontWeight={step.status === 'current' ? 'bold' : 'medium'}
                    color={step.status === 'disabled' ? 'gray.400' : 'gray.800'}
                  >
                    {step.title}
                  </Text>
                  <Text
                    fontSize="sm"
                    color={step.status === 'disabled' ? 'gray.300' : 'gray.600'}
                  >
                    {step.description}
                  </Text>
                </VStack>

                {/* Step Status */}
                {step.status === 'current' && (
                  <Box px={2} py={1} bg="blue.100" rounded="md">
                    <Text fontSize="xs" color="blue.700" fontWeight="medium">
                      Current
                    </Text>
                  </Box>
                )}
                {step.status === 'completed' && (
                  <Box px={2} py={1} bg="green.100" rounded="md">
                    <Text fontSize="xs" color="green.700" fontWeight="medium">
                      Done
                    </Text>
                  </Box>
                )}
              </HStack>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <Box ml={5} w="0.5px" h={2} bg="gray.300" />
              )}
            </React.Fragment>
          ))}
        </VStack>

        {/* Next Step Hint */}
        {currentStep !== 'bracket' && (
          <Box bg="blue.50" p={3} rounded="md">
            <HStack space={2} alignItems="center">
              <Icon as={MaterialIcons} name="lightbulb" color="blue.600" />
              <VStack flex={1}>
                <Text fontSize="sm" fontWeight="medium" color="blue.800">
                  {currentStep === 'create' &&
                    'Next: Import player data from CSV'}
                  {currentStep === 'import' &&
                    'Next: Review and validate imported players'}
                  {currentStep === 'validate' &&
                    'Next: Generate tournament bracket'}
                </Text>
              </VStack>
            </HStack>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default WorkflowStepper;
