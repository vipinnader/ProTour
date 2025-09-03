// Email verification screen for ProTour - Epic 1 Implementation

import React, { useState, useEffect } from 'react';
import {
  Box,
  Center,
  VStack,
  Text,
  Button,
  Icon,
  useToast,
  HStack,
} from 'native-base';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface EmailVerificationScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({
  navigation,
}) => {
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { user, resendEmailVerification, logout } = useAuth();
  const toast = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  // Check if user's email is already verified
  useEffect(() => {
    if (user?.emailVerified) {
      navigation.replace('Main'); // Navigate to main app
    }
  }, [user?.emailVerified, navigation]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    setResendLoading(true);
    try {
      await resendEmailVerification();
      setResendCooldown(60); // 60 second cooldown
      toast.show({
        title: 'Verification Email Sent',
        description: 'Check your email for verification instructions',
      });
    } catch (error: unknown) {
      toast.show({
        title: 'Failed to Send Email',
        description: error.message || 'Could not send verification email',
      });
    } finally {
      setResendLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    try {
      await logout();
      navigation.replace('Login');
    } catch (error) {
      // If logout fails, still navigate back
      navigation.replace('Login');
    }
  };

  const handleContinueAnyway = () => {
    // For Epic 1, allow users to continue without verification for testing
    navigation.replace('Main');
  };

  return (
    <Center flex={1} px={4} bg="gray.50">
      <VStack space={8} w="full" maxW="sm" alignItems="center">
        {/* Icon and Header */}
        <VStack space={4} alignItems="center">
          <Icon
            as={<MaterialIcons name="mark-email-unread" />}
            size={20}
            color="primary.600"
          />
          <Text
            fontSize="3xl"
            fontWeight="bold"
            color="primary.600"
            textAlign="center"
          >
            Verify Your Email
          </Text>
          <Text fontSize="lg" color="gray.600" textAlign="center">
            We've sent a verification link to
          </Text>
          <Text
            fontSize="lg"
            fontWeight="medium"
            color="gray.800"
            textAlign="center"
          >
            {user?.email}
          </Text>
        </VStack>

        {/* Instructions */}
        <Box bg="white" p={6} rounded="xl" shadow={2} w="full">
          <VStack space={4}>
            <Text fontSize="md" color="gray.700" textAlign="center">
              Please check your email and click the verification link to
              activate your account.
            </Text>

            <VStack space={3}>
              <Text fontSize="sm" fontWeight="medium" color="gray.600">
                Didn't receive the email?
              </Text>
              <VStack space={2} pl={2}>
                <Text fontSize="sm" color="gray.500">
                  • Check your spam folder
                </Text>
                <Text fontSize="sm" color="gray.500">
                  • Make sure you entered the correct email
                </Text>
                <Text fontSize="sm" color="gray.500">
                  • Wait a few minutes for delivery
                </Text>
              </VStack>
            </VStack>
          </VStack>
        </Box>

        {/* Action Buttons */}
        <VStack space={3} w="full">
          <Button
            onPress={handleResendVerification}
            isLoading={resendLoading}
            isLoadingText="Sending..."
            size="lg"
            colorScheme="primary"
            rounded="lg"
            isDisabled={resendCooldown > 0}
          >
            {resendCooldown > 0
              ? `Resend in ${resendCooldown}s`
              : 'Resend Verification Email'}
          </Button>

          {/* For Epic 1 development - allow skip verification */}
          {__DEV__ && (
            <Button
              onPress={handleContinueAnyway}
              variant="outline"
              colorScheme="gray"
              size="lg"
              rounded="lg"
            >
              Continue Anyway (Dev Only)
            </Button>
          )}
        </VStack>

        {/* Back to Login */}
        <HStack space={2} alignItems="center">
          <Text color="gray.600" fontSize="sm">
            Wrong email address?
          </Text>
          <Button
            variant="link"
            size="sm"
            onPress={handleBackToLogin}
            _text={{ color: 'primary.600', fontWeight: 'medium' }}
          >
            Sign In Again
          </Button>
        </HStack>

        {/* Help Section */}
        <VStack space={2} alignItems="center">
          <Text fontSize="sm" color="gray.500" textAlign="center">
            Still having trouble?
          </Text>
          <Button
            variant="link"
            size="sm"
            _text={{ color: 'primary.600', fontSize: 'sm' }}
          >
            Contact Support
          </Button>
        </VStack>
      </VStack>
    </Center>
  );
};

export default EmailVerificationScreen;
