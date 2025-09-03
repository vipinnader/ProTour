// Registration screen for ProTour - Epic 1 Implementation

import React, { useState } from 'react';
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
  useToast,
  KeyboardAvoidingView,
  ScrollView,
  Progress,
  Checkbox,
} from 'native-base';
import { Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { isValidEmail, AuthService } from '@protour/shared';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface RegisterScreenProps {
  navigation: NativeStackNavigationProp<any>;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuth();
  const toast = useToast();

  // Password strength calculation
  const calculatePasswordStrength = (password: string): number => {
    const validation = AuthService.validatePassword(password);
    const totalCriteria = 5; // length, lowercase, uppercase, number, special char
    const metCriteria = totalCriteria - validation.errors.length;
    return (metCriteria / totalCriteria) * 100;
  };

  const getPasswordStrengthColor = (strength: number): string => {
    if (strength < 40) return 'red.500';
    if (strength < 80) return 'yellow.500';
    return 'green.500';
  };

  const getPasswordStrengthText = (strength: number): string => {
    if (strength < 40) return 'Weak';
    if (strength < 80) return 'Medium';
    return 'Strong';
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): boolean => {
    // Name validation
    if (!formData.name.trim()) {
      toast.show({
        title: 'Name Required',
        description: 'Please enter your full name',
      });
      return false;
    }

    if (formData.name.trim().length < 2) {
      toast.show({
        title: 'Invalid Name',
        description: 'Name must be at least 2 characters long',
      });
      return false;
    }

    // Email validation
    if (!formData.email.trim()) {
      toast.show({
        title: 'Email Required',
        description: 'Please enter your email address',
      });
      return false;
    }

    if (!isValidEmail(formData.email)) {
      toast.show({
        title: 'Invalid Email',
        description: 'Please enter a valid email address',
      });
      return false;
    }

    // Password validation
    if (!formData.password) {
      toast.show({
        title: 'Password Required',
        description: 'Please enter a password',
      });
      return false;
    }

    const passwordValidation = AuthService.validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      toast.show({
        title: 'Weak Password',
        description: passwordValidation.errors[0],
      });
      return false;
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      toast.show({
        title: "Passwords Don't Match",
        description: 'Please make sure both passwords are the same',
      });
      return false;
    }

    // Terms acceptance
    if (!acceptTerms) {
      toast.show({
        title: 'Terms Required',
        description: 'Please accept the terms and conditions to continue',
      });
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await register(
        formData.email.trim(),
        formData.password,
        formData.name.trim()
      );

      toast.show({
        title: 'Registration Successful!',
        description: 'Please check your email to verify your account',
      });

      // Navigate to email verification screen
      navigation.navigate('EmailVerification');
    } catch (error: unknown) {
      toast.show({
        title: 'Registration Failed',
        description: error.message || 'An error occurred during registration',
      });
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = calculatePasswordStrength(formData.password);

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
                Join ProTour
              </Text>
              <Text fontSize="lg" color="gray.600" textAlign="center">
                Create your account to start managing tournaments
              </Text>
            </VStack>

            {/* Registration Form */}
            <Box bg="white" p={6} rounded="xl" shadow={2}>
              <VStack space={4}>
                {/* Name Field */}
                <VStack space={2}>
                  <Text fontWeight="medium" color="gray.700">
                    Full Name
                  </Text>
                  <Input
                    placeholder="Enter your full name"
                    value={formData.name}
                    onChangeText={value => handleInputChange('name', value)}
                    autoCapitalize="words"
                    InputLeftElement={
                      <Icon
                        as={<MaterialIcons name="person" />}
                        size={5}
                        ml="2"
                        color="muted.400"
                      />
                    }
                  />
                </VStack>

                {/* Email Field */}
                <VStack space={2}>
                  <Text fontWeight="medium" color="gray.700">
                    Email Address
                  </Text>
                  <Input
                    placeholder="Enter your email"
                    value={formData.email}
                    onChangeText={value => handleInputChange('email', value)}
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

                {/* Password Field */}
                <VStack space={2}>
                  <Text fontWeight="medium" color="gray.700">
                    Password
                  </Text>
                  <Input
                    placeholder="Create a strong password"
                    value={formData.password}
                    onChangeText={value => handleInputChange('password', value)}
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

                  {/* Password Strength Indicator */}
                  {formData.password.length > 0 && (
                    <VStack space={1}>
                      <HStack
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Text fontSize="xs" color="gray.500">
                          Password Strength
                        </Text>
                        <Text
                          fontSize="xs"
                          color={getPasswordStrengthColor(passwordStrength)}
                          fontWeight="medium"
                        >
                          {getPasswordStrengthText(passwordStrength)}
                        </Text>
                      </HStack>
                      <Progress
                        value={passwordStrength}
                        colorScheme={
                          getPasswordStrengthColor(passwordStrength).split(
                            '.'
                          )[0]
                        }
                        size="sm"
                      />
                    </VStack>
                  )}
                </VStack>

                {/* Confirm Password Field */}
                <VStack space={2}>
                  <Text fontWeight="medium" color="gray.700">
                    Confirm Password
                  </Text>
                  <Input
                    placeholder="Confirm your password"
                    value={formData.confirmPassword}
                    onChangeText={value =>
                      handleInputChange('confirmPassword', value)
                    }
                    type={showConfirmPassword ? 'text' : 'password'}
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
                              showConfirmPassword
                                ? 'visibility'
                                : 'visibility-off'
                            }
                          />
                        }
                        size={5}
                        mr="2"
                        color="muted.400"
                        onPress={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      />
                    }
                  />
                </VStack>

                {/* Terms and Conditions */}
                <Checkbox
                  value="terms"
                  isChecked={acceptTerms}
                  onChange={setAcceptTerms}
                  colorScheme="primary"
                >
                  <Text fontSize="sm" color="gray.700" flex={1}>
                    I agree to the{' '}
                    <Link _text={{ color: 'primary.600' }}>
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link _text={{ color: 'primary.600' }}>Privacy Policy</Link>
                  </Text>
                </Checkbox>

                <Button
                  onPress={handleRegister}
                  isLoading={loading}
                  isLoadingText="Creating Account..."
                  size="lg"
                  colorScheme="primary"
                  rounded="lg"
                  isDisabled={!acceptTerms}
                >
                  Create Account
                </Button>
              </VStack>
            </Box>

            {/* Sign In Link */}
            <HStack justifyContent="center" space={2}>
              <Text color="gray.600">Already have an account?</Text>
              <Link
                onPress={() => navigation.navigate('Login')}
                _text={{ color: 'primary.600', fontWeight: 'medium' }}
              >
                Sign In
              </Link>
            </HStack>
          </VStack>
        </Center>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default RegisterScreen;
