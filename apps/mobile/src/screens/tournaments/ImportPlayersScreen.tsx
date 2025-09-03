import React, { useState } from 'react';
import {
  Box,
  ScrollView,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  useToast,
  Progress,
  Alert,
  Card,
  Badge,
  Divider,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import DocumentPicker, {
  DocumentPickerResponse,
} from 'react-native-document-picker';
import Papa from 'papaparse';
import {
  PlayerImportData,
  CSVImportResult,
  CSVImportError,
  CSVDuplicate,
  PlayerService,
} from '@protour/shared';
import WorkflowStepper from '../../components/tournament/WorkflowStepper';
import { ImportPlayersScreenProps } from '../../navigation/types';

interface ImportStep {
  id: number;
  title: string;
  description: string;
  completed: boolean;
}

const ImportPlayersScreen: React.FC<ImportPlayersScreenProps> = ({
  navigation,
  route,
}) => {
  const { tournamentId, tournamentName } = route.params;
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] =
    useState<DocumentPickerResponse | null>(null);
  const [csvData, setCsvData] = useState<PlayerImportData[]>([]);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(
    null
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const toast = useToast();
  const playerService = new PlayerService();

  const steps: ImportStep[] = [
    {
      id: 1,
      title: 'Select CSV File',
      description: 'Choose your CSV file with player data',
      completed: selectedFile !== null,
    },
    {
      id: 2,
      title: 'Validate Data',
      description: 'Review and fix any data issues',
      completed: importResult !== null,
    },
    {
      id: 3,
      title: 'Import Players',
      description: 'Add players to your tournament',
      completed: false,
    },
  ];

  const selectCSVFile = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.csv, DocumentPicker.types.plainText],
        copyTo: 'documentDirectory',
      });

      setSelectedFile(result);
      await processCSV(result);
    } catch (error: any) {
      if (DocumentPicker.isCancel(error)) {
        // User cancelled the picker
        return;
      }
      console.error('Error selecting file:', error);
      toast.show({
        title: 'Error',
        description: 'Failed to select CSV file. Please try again.',
      });
    }
  };

  const processCSV = async (file: DocumentPickerResponse) => {
    setIsProcessing(true);

    try {
      // Read file content
      const response = await fetch(file.fileCopyUri || file.uri);
      const csvText = await response.text();

      // Parse CSV
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transform: (value: string, header: string) => {
          // Clean up the data
          return value.trim();
        },
        complete: async results => {
          try {
            // Map CSV data to PlayerImportData format
            const mappedData: PlayerImportData[] = results.data.map(
              (row: any) => ({
                name: row.name || row.Name || '',
                email: row.email || row.Email || '',
                phone:
                  row.phone ||
                  row.Phone ||
                  row.phoneNumber ||
                  row['Phone Number'] ||
                  undefined,
                ranking:
                  row.ranking || row.Ranking
                    ? parseInt(row.ranking || row.Ranking)
                    : undefined,
                notes: row.notes || row.Notes || undefined,
              })
            );

            setCsvData(mappedData);

            // Validate the data using PlayerService
            const validationResult = await playerService.importPlayersFromCSV(
              mappedData,
              tournamentId
            );
            setImportResult(validationResult);
            setCurrentStep(2);
          } catch (error) {
            console.error('Error processing CSV data:', error);
            toast.show({
              title: 'Processing Error',
              description:
                'Failed to process CSV data. Please check the format.',
            });
          } finally {
            setIsProcessing(false);
          }
        },
        error: (error: any) => {
          console.error('CSV parsing error:', error);
          toast.show({
            title: 'Parsing Error',
            description: 'Failed to parse CSV file. Please check the format.',
          });
          setIsProcessing(false);
        },
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast.show({
        title: 'File Error',
        description: 'Failed to read CSV file. Please try again.',
      });
      setIsProcessing(false);
    }
  };

  const importPlayers = async () => {
    if (!importResult || importResult.validPlayers.length === 0) {
      toast.show({
        title: 'No Valid Players',
        description: 'Please fix validation errors before importing.',
      });
      return;
    }

    setIsImporting(true);
    try {
      await playerService.batchCreatePlayers(
        importResult.validPlayers,
        tournamentId
      );

      toast.show({
        title: 'Import Successful',
        description: `Successfully imported ${importResult.validPlayers.length} players.`,
      });

      // Navigate to bracket generation screen
      navigation.navigate('BracketView', { tournamentId });
    } catch (error) {
      console.error('Error importing players:', error);
      toast.show({
        title: 'Import Failed',
        description: 'Failed to import players. Please try again.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const renderStepIndicator = () => (
    <HStack space={4} alignItems="center" mb={6}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <VStack alignItems="center" flex={1}>
            <Box
              w={10}
              h={10}
              rounded="full"
              bg={
                step.completed
                  ? 'green.500'
                  : currentStep === step.id
                    ? 'primary.500'
                    : 'gray.300'
              }
              alignItems="center"
              justifyContent="center"
              mb={2}
            >
              {step.completed ? (
                <Icon as={MaterialIcons} name="check" size="sm" color="white" />
              ) : (
                <Text color="white" fontSize="sm" fontWeight="bold">
                  {step.id}
                </Text>
              )}
            </Box>
            <Text
              fontSize="xs"
              textAlign="center"
              color={step.completed ? 'green.600' : 'gray.600'}
            >
              {step.title}
            </Text>
          </VStack>
          {index < steps.length - 1 && <Box flex={0.5} h={0.5} bg="gray.300" />}
        </React.Fragment>
      ))}
    </HStack>
  );

  const renderFileSelection = () => (
    <VStack space={4}>
      <Text fontSize="lg" fontWeight="semibold">
        Import Players from CSV
      </Text>
      <Text color="gray.600">
        Upload a CSV file with player information. Required columns: name,
        email. Optional: phone, ranking, notes.
      </Text>

      <Card p={4}>
        <VStack space={3}>
          <Text fontWeight="medium">CSV Format Example:</Text>
          <Box bg="gray.50" p={3} rounded="md">
            <Text fontFamily="mono" fontSize="sm">
              name,email,phone,ranking,notes{'\n'}
              John Smith,john@email.com,+1-555-0123,100,Strong player{'\n'}
              Jane Doe,jane@email.com,,85,
            </Text>
          </Box>
        </VStack>
      </Card>

      {selectedFile && (
        <Alert status="info" variant="left-accent">
          <VStack space={1} w="100%">
            <Text fontWeight="medium">Selected File:</Text>
            <Text fontSize="sm">{selectedFile.name}</Text>
            <Text fontSize="xs" color="gray.600">
              Size: {((selectedFile.size || 0) / 1024).toFixed(1)} KB
            </Text>
          </VStack>
        </Alert>
      )}

      <Button
        onPress={selectCSVFile}
        leftIcon={<Icon as={MaterialIcons} name="upload-file" />}
        isLoading={isProcessing}
        isLoadingText="Processing..."
      >
        {selectedFile ? 'Select Different File' : 'Select CSV File'}
      </Button>
    </VStack>
  );

  const renderValidationResults = () => {
    if (!importResult) return null;

    return (
      <VStack space={4}>
        <Text fontSize="lg" fontWeight="semibold">
          Data Validation Results
        </Text>

        {/* Summary Cards */}
        <HStack space={3}>
          <Card flex={1} p={3} bg="green.50">
            <VStack alignItems="center">
              <Text fontSize="2xl" fontWeight="bold" color="green.600">
                {importResult.validPlayers.length}
              </Text>
              <Text fontSize="sm" color="green.600" textAlign="center">
                Valid Players
              </Text>
            </VStack>
          </Card>

          {importResult.errors.length > 0 && (
            <Card flex={1} p={3} bg="red.50">
              <VStack alignItems="center">
                <Text fontSize="2xl" fontWeight="bold" color="red.600">
                  {importResult.errors.length}
                </Text>
                <Text fontSize="sm" color="red.600" textAlign="center">
                  Errors
                </Text>
              </VStack>
            </Card>
          )}

          {importResult.duplicates.length > 0 && (
            <Card flex={1} p={3} bg="orange.50">
              <VStack alignItems="center">
                <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                  {importResult.duplicates.length}
                </Text>
                <Text fontSize="sm" color="orange.600" textAlign="center">
                  Duplicates
                </Text>
              </VStack>
            </Card>
          )}
        </HStack>

        {/* Errors */}
        {importResult.errors.length > 0 && (
          <Card>
            <VStack space={3} p={4}>
              <HStack alignItems="center" space={2}>
                <Icon as={MaterialIcons} name="error" color="red.500" />
                <Text fontWeight="semibold" color="red.600">
                  Data Errors ({importResult.errors.length})
                </Text>
              </HStack>
              <Divider />
              <VStack space={2}>
                {importResult.errors.slice(0, 5).map((error, index) => (
                  <Box key={index} bg="red.50" p={3} rounded="md">
                    <HStack
                      justifyContent="space-between"
                      alignItems="flex-start"
                    >
                      <VStack flex={1}>
                        <Text fontSize="sm" fontWeight="medium">
                          Row {error.row}: {error.field}
                        </Text>
                        <Text fontSize="xs" color="red.600">
                          {error.message}
                        </Text>
                        {error.suggestion && (
                          <Text fontSize="xs" color="gray.600" italic>
                            Suggestion: {error.suggestion}
                          </Text>
                        )}
                      </VStack>
                      <Badge colorScheme="red" variant="subtle" size="sm">
                        {error.field}
                      </Badge>
                    </HStack>
                  </Box>
                ))}
                {importResult.errors.length > 5 && (
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    ... and {importResult.errors.length - 5} more errors
                  </Text>
                )}
              </VStack>
            </VStack>
          </Card>
        )}

        {/* Duplicates */}
        {importResult.duplicates.length > 0 && (
          <Card>
            <VStack space={3} p={4}>
              <HStack alignItems="center" space={2}>
                <Icon as={MaterialIcons} name="warning" color="orange.500" />
                <Text fontWeight="semibold" color="orange.600">
                  Duplicate Players ({importResult.duplicates.length})
                </Text>
              </HStack>
              <Divider />
              <VStack space={2}>
                {importResult.duplicates.slice(0, 3).map((duplicate, index) => (
                  <Box key={index} bg="orange.50" p={3} rounded="md">
                    <VStack space={1}>
                      <Text fontSize="sm" fontWeight="medium">
                        Row {duplicate.row}: {duplicate.player.name}
                      </Text>
                      <Text fontSize="xs" color="orange.600">
                        {duplicate.conflictField === 'email'
                          ? 'Email already exists'
                          : 'Name already exists'}
                      </Text>
                      <Text fontSize="xs" color="gray.600">
                        {duplicate.player.email}
                      </Text>
                    </VStack>
                  </Box>
                ))}
                {importResult.duplicates.length > 3 && (
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    ... and {importResult.duplicates.length - 3} more duplicates
                  </Text>
                )}
              </VStack>
            </VStack>
          </Card>
        )}

        {/* Action Buttons */}
        <HStack space={3}>
          <Button
            variant="outline"
            flex={1}
            onPress={() => {
              setCurrentStep(1);
              setSelectedFile(null);
              setCsvData([]);
              setImportResult(null);
            }}
          >
            Select New File
          </Button>
          <Button
            flex={1}
            onPress={importPlayers}
            isDisabled={importResult.validPlayers.length === 0}
            isLoading={isImporting}
            isLoadingText="Importing..."
          >
            Import {importResult.validPlayers.length} Players
          </Button>
        </HStack>
      </VStack>
    );
  };

  return (
    <Box flex={1} bg="white" safeArea>
      {/* Header */}
      <HStack
        alignItems="center"
        px={4}
        py={3}
        borderBottomWidth={1}
        borderBottomColor="gray.200"
      >
        <Button
          variant="ghost"
          onPress={() => navigation.goBack()}
          leftIcon={<Icon as={MaterialIcons} name="arrow-back" />}
        >
          Back
        </Button>
        <VStack flex={1} alignItems="center" mx={4}>
          <Text fontSize="lg" fontWeight="semibold">
            Import Players
          </Text>
          <Text fontSize="sm" color="gray.600">
            {tournamentName}
          </Text>
        </VStack>
        <Box w={16} />
      </HStack>

      <ScrollView flex={1} contentContainerStyle={{ padding: 16 }}>
        {/* Workflow Progress */}
        <WorkflowStepper
          currentStep={currentStep === 1 ? 'import' : 'validate'}
          tournamentId={tournamentId}
          playerCount={csvData.length}
          hasValidation={importResult !== null}
        />

        {/* Step Indicator */}
        {renderStepIndicator()}

        {/* Content based on current step */}
        {currentStep === 1 && renderFileSelection()}
        {currentStep === 2 && renderValidationResults()}
      </ScrollView>
    </Box>
  );
};

export default ImportPlayersScreen;
