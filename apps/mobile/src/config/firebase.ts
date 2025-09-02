import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import storage from '@react-native-firebase/storage';
import { Platform } from 'react-native';

// Firebase configuration interface
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

// Environment-specific configuration
const getFirebaseConfig = (): FirebaseConfig => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        apiKey: process.env.FIREBASE_API_KEY_PROD || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN_PROD || '',
        projectId: process.env.FIREBASE_PROJECT_ID_PROD || 'protour-prod',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET_PROD || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID_PROD || '',
        appId: process.env.FIREBASE_APP_ID_PROD || '',
      };
    
    case 'staging':
      return {
        apiKey: process.env.FIREBASE_API_KEY_STAGING || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN_STAGING || '',
        projectId: process.env.FIREBASE_PROJECT_ID_STAGING || 'protour-staging',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET_STAGING || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID_STAGING || '',
        appId: process.env.FIREBASE_APP_ID_STAGING || '',
      };
    
    default: // development
      return {
        apiKey: process.env.FIREBASE_API_KEY || 'demo-key',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
        projectId: process.env.FIREBASE_PROJECT_ID || 'protour-dev',
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '123456789',
        appId: process.env.FIREBASE_APP_ID || 'demo-app-id',
      };
  }
};

// Initialize Firebase services
export const firebaseConfig = getFirebaseConfig();

// Configure emulators for development
if (__DEV__ && process.env.NODE_ENV !== 'test') {
  // Connect to emulators
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
  
  // Auth emulator
  auth().useEmulator(`http://${host}:9099`);
  
  // Firestore emulator
  firestore().useEmulator(host, 8080);
  
  // Functions emulator
  functions().useEmulator(host, 5001);
  
  // Storage emulator
  storage().useEmulator(host, 9199);
}

// Export Firebase services
export { auth, firestore, functions, storage };

// Helper functions for common operations
export const getCurrentUser = () => auth().currentUser;

export const signOut = () => auth().signOut();

export const createUserWithEmailAndPassword = (email: string, password: string) =>
  auth().createUserWithEmailAndPassword(email, password);

export const signInWithEmailAndPassword = (email: string, password: string) =>
  auth().signInWithEmailAndPassword(email, password);

export const sendPasswordResetEmail = (email: string) =>
  auth().sendPasswordResetEmail(email);

// Firestore helpers
export const db = firestore();

export const createDocument = (collection: string, data: any) =>
  db.collection(collection).add(data);

export const updateDocument = (collection: string, id: string, data: any) =>
  db.collection(collection).doc(id).update(data);

export const deleteDocument = (collection: string, id: string) =>
  db.collection(collection).doc(id).delete();

export const getDocument = (collection: string, id: string) =>
  db.collection(collection).doc(id).get();

export const getCollection = (collection: string) =>
  db.collection(collection).get();

// Storage helpers
export const uploadFile = async (path: string, file: any) => {
  const reference = storage().ref(path);
  return reference.putFile(file);
};

export const getDownloadURL = async (path: string) => {
  const reference = storage().ref(path);
  return reference.getDownloadURL();
};

// Cloud Functions helpers
export const callFunction = (name: string, data?: any) =>
  functions().httpsCallable(name)(data);

export default {
  auth,
  firestore: db,
  functions,
  storage,
  config: firebaseConfig,
};