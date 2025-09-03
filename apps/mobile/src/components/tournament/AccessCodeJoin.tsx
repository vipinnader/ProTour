// Access code join component for ProTour - Epic 2B Implementation

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useSync } from '../../contexts/SyncContext';

interface AccessCodeJoinProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (sessionInfo: any) => void;
}

const AccessCodeJoin: React.FC<AccessCodeJoinProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const { joinWithAccessCode } = useSync();
  
  const [accessCode, setAccessCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleJoin = async () => {
    if (!accessCode.trim()) {
      Alert.alert('Error', 'Please enter an access code');
      return;
    }

    setIsJoining(true);
    
    try {
      const session = await joinWithAccessCode(accessCode.trim().toUpperCase());
      
      Alert.alert(
        'Success!',
        `Joined tournament as ${session.role}`,
        [
          {
            text: 'OK',
            onPress: () => {
              onSuccess?.(session);
              onClose();
              setAccessCode('');
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Join Failed',
        error.message || 'Invalid or expired access code'
      );
    } finally {
      setIsJoining(false);
    }
  };

  const handleClose = () => {
    setAccessCode('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Join Tournament</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>
            Enter the access code provided by the tournament organizer
          </Text>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Access Code</Text>
            <TextInput
              style={styles.textInput}
              value={accessCode}
              onChangeText={(text) => setAccessCode(text.toUpperCase())}
              placeholder="Enter 8-character code"
              placeholderTextColor="#999"
              maxLength={8}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isJoining}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.joinButton,
              (!accessCode.trim() || isJoining) && styles.joinButtonDisabled
            ]}
            onPress={handleJoin}
            disabled={!accessCode.trim() || isJoining}
          >
            {isJoining ? (
              <View style={styles.joinButtonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.joinButtonText}>Joining...</Text>
              </View>
            ) : (
              <Text style={styles.joinButtonText}>Join Tournament</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What happens next?</Text>
            <Text style={styles.infoText}>
              • You'll be granted permissions based on your assigned role
            </Text>
            <Text style={styles.infoText}>
              • Tournament data will sync to your device for offline access
            </Text>
            <Text style={styles.infoText}>
              • You can start participating in the tournament immediately
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#666',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  inputContainer: {
    marginBottom: 30,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontFamily: 'monospace',
    backgroundColor: '#fff',
    textAlign: 'center',
    letterSpacing: 2,
  },
  joinButton: {
    backgroundColor: '#007bff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
  },
  joinButtonDisabled: {
    backgroundColor: '#ccc',
  },
  joinButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#e7f3ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0056b3',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#0056b3',
    marginBottom: 6,
    lineHeight: 20,
  },
});

export default AccessCodeJoin;