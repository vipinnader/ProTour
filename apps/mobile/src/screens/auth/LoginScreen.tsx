// Login screen for ProTour - Epic 1 Implementation

import React, { useState, useRef } from 'react';
import {
  Box,
  Center,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Link,
  Icon,
  AlertDialog,
  useToast,
  KeyboardAvoidingView,
  ScrollView,
} from 'native-base';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { isValidEmail } from '@protour/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface LoginScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { login, resetPassword } = useAuth();
  const toast = useToast();
  const cancelRef = useRef(null);

  const handleLogin = async () => {
    // Validation
    if (!email.trim()) {
      toast.show({
        title: 'Email Required',
        description: 'Please enter your email address',
      });
      return;
    }

    if (!isValidEmail(email)) {
      toast.show({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
      });
      return;
    }

    if (!password) {
      toast.show({
        title: 'Password Required',
        description: 'Please enter your password',
      });
      return;
    }

    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.show({
        title: 'Welcome Back!',
        description: 'You have successfully logged in',
      });
    } catch (error: unknown) {
      toast.show({
        title: 'Login Failed',
        description: error.message || 'An error occurred during login',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      toast.show({
        title: 'Email Required',
        description: 'Please enter your email address',
      });
      return;
    }

    if (!isValidEmail(resetEmail)) {
      toast.show({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
      });
      return;
    }

    setResetLoading(true);
    try {
      await resetPassword(resetEmail.trim());
      setResetDialogOpen(false);
      setResetEmail('');
      toast.show({
        title: 'Reset Email Sent',
        description: 'Check your email for password reset instructions',
      });
    } catch (error: unknown) {
      toast.show({
        title: 'Reset Failed',
        description: error.message || 'Failed to send reset email',
      });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      flex={1}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <Center flex={1} px={4} py={8} bg="gray.50">
          <VStack space={6} w="full" maxW="sm">
            {/* Header */}
            <VStack space={3} alignItems="center">
              <Text fontSize="4xl">🏆</Text>
              <Text fontSize="3xl" fontWeight="bold" color="primary.600">
                ProTour
              </Text>
              <Text fontSize="lg" color="gray.600" textAlign="center">
                Sign in to manage your tournaments
              </Text>
            </VStack>

            {/* Login Form */}
            <Box bg="white" p={6} rounded="xl" shadow={2}>
              <VStack space={4}>
                <VStack space={2}>
                  <Text fontWeight="medium" color="gray.700">
                    Email Address
                  </Text>
                  <Input
                    placeholder="Enter your email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    InputLeftElement={
                      <Icon
                        as={<MaterialIcons name="email" />}
                        size={5}
                        ml="2"
                        color="muted.400"
                      />
                    }
                  />
                </VStack>

                <VStack space={2}>
                  <Text fontWeight="medium" color="gray.700">
                    Password
                  </Text>
                  <Input
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    type={showPassword ? 'text' : 'password'}
                    InputLeftElement={
                      <Icon
                        as={<MaterialIcons name="lock" />}
                        size={5}
                        ml="2"
                        color="muted.400"
                      />
                    }
                    InputRightElement={
                      <Icon
                        as={
                          <MaterialIcons
                            name={
                              showPassword ? 'visibility' : 'visibility-off'
                            }
                          />
                        }
                        size={5}
                        mr="2"
                        color="muted.400"
                        onPress={() => setShowPassword(!showPassword)}
                      />
                    }
                  />
                </VStack>

                <Button
                  onPress={handleLogin}
                  isLoading={loading}
                  isLoadingText="Signing In..."
                  size="lg"
                  colorScheme="primary"
                  rounded="lg"
                >
                  Sign In
                </Button>

                <Link
                  onPress={() => setResetDialogOpen(true)}
                  alignSelf="center"
                  _text={{ color: 'primary.600', fontSize: 'sm' }}
                >
                  Forgot your password?
                </Link>
              </VStack>
            </Box>

            {/* Sign Up Link */}
            <HStack justifyContent="center" space={2}>
              <Text color="gray.600">Don't have an account?</Text>
              <Link
                onPress={() => navigation.navigate('Register')}
                _text={{ color: 'primary.600', fontWeight: 'medium' }}
              >
                Sign Up
              </Link>
            </HStack>
          </VStack>
        </Center>
      </ScrollView>

      {/* Password Reset Dialog */}
      <AlertDialog
        isOpen={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        leastDestructiveRef={cancelRef}
      >
        <AlertDialog.Content>
          <AlertDialog.CloseButton />
          <AlertDialog.Header>Reset Password</AlertDialog.Header>
          <AlertDialog.Body>
            <VStack space={3}>
              <Text>
                Enter your email address and we'll send you instructions to
                reset your password.
              </Text>
              <Input
                placeholder="Email address"
                value={resetEmail}
                onChangeText={setResetEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </VStack>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button.Group space={2}>
              <Button
                variant="unstyled"
                colorScheme="coolGray"
                onPress={() => setResetDialogOpen(false)}
                ref={cancelRef}
              >
                Cancel
              </Button>
              <Button
                colorScheme="primary"
                onPress={handleForgotPassword}
                isLoading={resetLoading}
                isLoadingText="Sending..."
              >
                Send Reset Email
              </Button>
            </Button.Group>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
