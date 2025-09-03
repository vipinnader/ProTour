// Authentication service for ProTour - Epic 1 Implementation

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { User, UserProfile } from '../types';
import { isValidEmail } from '../utils/validation';

export class AuthService {
  private readonly USERS_COLLECTION = 'users';

  // Registration
  async register(email: string, password: string, name: string): Promise<User> {
    // Validate input
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    if (name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters');
    }

    try {
      // Create Firebase Auth user
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password
      );
      const firebaseUser = userCredential.user;

      // Update Firebase Auth profile
      await firebaseUser.updateProfile({
        displayName: name.trim(),
      });

      // Send email verification
      await firebaseUser.sendEmailVerification();

      // Create user document in Firestore
      const userData: Omit<User, 'id'> = {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        role: 'organizer', // Default role for Epic 1
        emailVerified: false,
        createdAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now(),
      };

      await firestore()
        .collection(this.USERS_COLLECTION)
        .doc(firebaseUser.uid)
        .set(userData);

      return {
        id: firebaseUser.uid,
        ...userData,
      };
    } catch (error: any) {
      // Handle Firebase Auth specific errors
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new Error('An account with this email already exists');
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        case 'auth/weak-password':
          throw new Error('Password is too weak');
        default:
          throw new Error('Registration failed: ' + error.message);
      }
    }
  }

  // Login
  async login(email: string, password: string): Promise<User> {
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!password) {
      throw new Error('Password is required');
    }

    try {
      const userCredential = await auth().signInWithEmailAndPassword(
        email,
        password
      );
      const firebaseUser = userCredential.user;

      // Get user document from Firestore
      const userDoc = await firestore()
        .collection(this.USERS_COLLECTION)
        .doc(firebaseUser.uid)
        .get();

      if (!userDoc.exists) {
        throw new Error('User data not found');
      }

      const userData = userDoc.data() as Omit<User, 'id'>;

      // Update email verification status
      if (firebaseUser.emailVerified !== userData.emailVerified) {
        await this.updateUserProfile(firebaseUser.uid, {
          emailVerified: firebaseUser.emailVerified,
        });
        userData.emailVerified = firebaseUser.emailVerified;
      }

      return {
        id: firebaseUser.uid,
        ...userData,
      };
    } catch (error: any) {
      switch (error.code) {
        case 'auth/user-not-found':
          throw new Error('No account found with this email');
        case 'auth/wrong-password':
          throw new Error('Incorrect password');
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        case 'auth/user-disabled':
          throw new Error('This account has been disabled');
        case 'auth/too-many-requests':
          throw new Error('Too many failed attempts. Try again later.');
        default:
          throw new Error('Login failed: ' + error.message);
      }
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      await auth().signOut();
    } catch (error: any) {
      throw new Error('Logout failed: ' + error.message);
    }
  }

  // Password reset
  async resetPassword(email: string): Promise<void> {
    if (!isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error: any) {
      switch (error.code) {
        case 'auth/user-not-found':
          throw new Error('No account found with this email');
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        default:
          throw new Error('Password reset failed: ' + error.message);
      }
    }
  }

  // Update user profile
  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    try {
      // Update Firebase Auth profile if name changed
      if (updates.name) {
        await currentUser.updateProfile({
          displayName: updates.name.trim(),
        });
      }

      // Update email if changed (requires re-authentication)
      if (updates.email && updates.email !== currentUser.email) {
        await currentUser.updateEmail(updates.email);
        await currentUser.sendEmailVerification();
        updates.emailVerified = false;
      }

      // Update Firestore document
      await this.updateUserProfile(currentUser.uid, updates);
    } catch (error: any) {
      switch (error.code) {
        case 'auth/email-already-in-use':
          throw new Error('This email is already in use by another account');
        case 'auth/invalid-email':
          throw new Error('Invalid email address');
        case 'auth/requires-recent-login':
          throw new Error('Please log in again to update your email');
        default:
          throw new Error('Profile update failed: ' + error.message);
      }
    }
  }

  // Change password
  async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const currentUser = auth().currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('No user is currently logged in');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    try {
      // Re-authenticate user
      const credential = auth.EmailAuthProvider.credential(
        currentUser.email,
        currentPassword
      );
      await currentUser.reauthenticateWithCredential(credential);

      // Update password
      await currentUser.updatePassword(newPassword);
    } catch (error: any) {
      switch (error.code) {
        case 'auth/wrong-password':
          throw new Error('Current password is incorrect');
        case 'auth/weak-password':
          throw new Error('New password is too weak');
        default:
          throw new Error('Password change failed: ' + error.message);
      }
    }
  }

  // Get current user
  getCurrentUser(): User | null {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) {
      return null;
    }

    // This will return cached user data
    // For fresh data, use getCurrentUserFromDatabase()
    return {
      id: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: firebaseUser.displayName || '',
      role: 'organizer', // Default for Epic 1
      emailVerified: firebaseUser.emailVerified,
      createdAt: firestore.Timestamp.now(), // Placeholder
      updatedAt: firestore.Timestamp.now(), // Placeholder
    };
  }

  // Get current user with fresh data from database
  async getCurrentUserFromDatabase(): Promise<User | null> {
    const firebaseUser = auth().currentUser;
    if (!firebaseUser) {
      return null;
    }

    try {
      const userDoc = await firestore()
        .collection(this.USERS_COLLECTION)
        .doc(firebaseUser.uid)
        .get();

      if (!userDoc.exists) {
        return null;
      }

      const userData = userDoc.data() as Omit<User, 'id'>;
      return {
        id: firebaseUser.uid,
        ...userData,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  }

  // Auth state change listener
  onAuthStateChanged(callback: (user: User | null) => void): () => void {
    return auth().onAuthStateChanged(async firebaseUser => {
      if (!firebaseUser) {
        callback(null);
        return;
      }

      // Fetch complete user data from Firestore
      try {
        const user = await this.getCurrentUserFromDatabase();
        callback(user);
      } catch (error) {
        console.error('Error fetching user data in auth state change:', error);
        callback(null);
      }
    });
  }

  // Delete account
  async deleteAccount(): Promise<void> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    try {
      // Delete user document from Firestore
      await firestore()
        .collection(this.USERS_COLLECTION)
        .doc(currentUser.uid)
        .delete();

      // Delete Firebase Auth user
      await currentUser.delete();
    } catch (error: any) {
      switch (error.code) {
        case 'auth/requires-recent-login':
          throw new Error('Please log in again to delete your account');
        default:
          throw new Error('Account deletion failed: ' + error.message);
      }
    }
  }

  // Resend email verification
  async resendEmailVerification(): Promise<void> {
    const currentUser = auth().currentUser;
    if (!currentUser) {
      throw new Error('No user is currently logged in');
    }

    if (currentUser.emailVerified) {
      throw new Error('Email is already verified');
    }

    try {
      await currentUser.sendEmailVerification();
    } catch (error: any) {
      throw new Error('Failed to send verification email: ' + error.message);
    }
  }

  // Check if user has specific role
  async hasRole(userId: string, role: User['role']): Promise<boolean> {
    try {
      const userDoc = await firestore()
        .collection(this.USERS_COLLECTION)
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        return false;
      }

      const userData = userDoc.data() as Omit<User, 'id'>;
      return userData.role === role;
    } catch (error) {
      console.error('Error checking user role:', error);
      return false;
    }
  }

  // Private helper methods
  private async updateUserProfile(
    userId: string,
    updates: Partial<UserProfile & { emailVerified?: boolean }>
  ): Promise<void> {
    const updateData = {
      ...updates,
      updatedAt: firestore.Timestamp.now(),
    };

    await firestore()
      .collection(this.USERS_COLLECTION)
      .doc(userId)
      .update(updateData);
  }

  // Password strength validation
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
