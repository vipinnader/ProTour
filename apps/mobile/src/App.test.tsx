/**
 * Example test for ProTour App component
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import App from './App';

// Mock Firebase initialization
jest.mock('./config/firebase');

// Mock navigation container
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
}));

describe('App Component', () => {
  it('should render without crashing', () => {
    const { getByText } = render(<App />);

    // Check if the app renders the main content
    expect(getByText('ProTour')).toBeTruthy();
  });

  it('should display tournament management platform subtitle', () => {
    const { getByText } = render(<App />);

    expect(getByText('Tournament Management Platform')).toBeTruthy();
  });

  it('should show development ready message', () => {
    const { getByText } = render(<App />);

    expect(getByText('Mobile app is ready for development!')).toBeTruthy();
  });

  it('should have proper accessibility', () => {
    const { getByText } = render(<App />);

    const titleElement = getByText('ProTour');
    expect(titleElement).toHaveValidAccessibility();
  });
});
