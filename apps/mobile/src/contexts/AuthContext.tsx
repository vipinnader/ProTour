// Authentication context for ProTour - Epic 1 Implementation

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, AuthService } from '@protour/shared';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateProfile: (
    updates: Partial<{ name: string; email: string; phone?: string }>
  ) => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  isAuthenticated: boolean;
  isEmailVerified: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const STORAGE_KEYS = {
  USER_SESSION: '@protour/user_session',
} as const;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const authService = new AuthService();

  useEffect(() => {
    // Set up auth state listener
    const unsubscribe = authService.onAuthStateChanged(async authUser => {
      setUser(authUser);
      setLoading(false);

      // Cache user session
      if (authUser) {
        try {
          await AsyncStorage.setItem(
            STORAGE_KEYS.USER_SESSION,
            JSON.stringify(authUser)
          );
        } catch (error) {
          console.error('Error caching user session:', error);
        }
      } else {
        try {
          await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
        } catch (error) {
          console.error('Error removing user session:', error);
        }
      }
    });

    // Load cached session on app start
    loadCachedSession();

    return unsubscribe;
  }, []);

  const loadCachedSession = async () => {
    try {
      const cachedSession = await AsyncStorage.getItem(
        STORAGE_KEYS.USER_SESSION
      );
      if (cachedSession) {
        const parsedUser = JSON.parse(cachedSession) as User;
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('Error loading cached session:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<void> => {
    setLoading(true);
    try {
      const loggedInUser = await authService.login(email, password);
      setUser(loggedInUser);

      // Cache successful login
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_SESSION,
        JSON.stringify(loggedInUser)
      );
    } catch (error) {
      setLoading(false);
      throw error; // Re-throw to handle in component
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string
  ): Promise<void> => {
    setLoading(true);
    try {
      const newUser = await authService.register(email, password, name);
      setUser(newUser);

      // Cache successful registration
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_SESSION,
        JSON.stringify(newUser)
      );
    } catch (error) {
      setLoading(false);
      throw error; // Re-throw to handle in component
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await authService.logout();
      setUser(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
    } catch (error) {
      console.error('Error during logout:', error);
      // Still clear local state even if server logout fails
      setUser(null);
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_SESSION);
      throw error;
    }
  };

  const resetPassword = async (email: string): Promise<void> => {
    return authService.resetPassword(email);
  };

  const updateProfile = async (
    updates: Partial<{ name: string; email: string; phone?: string }>
  ): Promise<void> => {
    if (!user) {
      throw new Error('No user is currently logged in');
    }

    try {
      await authService.updateProfile(updates);

      // Refresh user data from database
      const updatedUser = await authService.getCurrentUserFromDatabase();
      if (updatedUser) {
        setUser(updatedUser);
        await AsyncStorage.setItem(
          STORAGE_KEYS.USER_SESSION,
          JSON.stringify(updatedUser)
        );
      }
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ): Promise<void> => {
    return authService.changePassword(currentPassword, newPassword);
  };

  const resendEmailVerification = async (): Promise<void> => {
    return authService.resendEmailVerification();
  };

  const isAuthenticated = !!user;
  const isEmailVerified = user?.emailVerified || false;

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    changePassword,
    resendEmailVerification,
    isAuthenticated,
    isEmailVerified,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
