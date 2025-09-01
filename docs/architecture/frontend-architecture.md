# Frontend Architecture

Frontend-specific architecture details optimized for React Native cross-platform development with offline-first capabilities and real-time tournament management.

## Component Architecture

**Component Organization Structure:**
```
apps/mobile/src/
├── components/                 # Shared UI components
│   ├── tournament/            # Tournament-specific components
│   │   ├── BracketView.tsx
│   │   ├── MatchCard.tsx
│   │   └── PlayerList.tsx
│   ├── forms/                 # Reusable form components
│   │   ├── TournamentForm.tsx
│   │   └── ScoreEntry.tsx
│   └── ui/                    # Base UI components
│       ├── Button.tsx
│       ├── Card.tsx
│       └── LoadingSpinner.tsx
├── screens/                   # Screen-level components
│   ├── organizer/
│   ├── player/
│   └── spectator/
├── navigation/                # Navigation configuration
├── hooks/                     # Custom React hooks
├── services/                  # API and data services
├── stores/                    # State management
├── utils/                     # Utility functions
└── types/                     # TypeScript definitions
```

**Component Template Pattern:**
```typescript
// Standard component template for tournament features
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useOfflineSync, useRealTimeSubscription } from '../hooks';
import { TournamentService } from '../services';
import { Tournament } from '../types';

interface BracketViewProps {
  tournamentId: string;
  userRole: 'organizer' | 'player' | 'spectator';
  onMatchSelect?: (matchId: string) => void;
}

export const BracketView: React.FC<BracketViewProps> = ({
  tournamentId,
  userRole,
  onMatchSelect
}) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const { isOnline, syncStatus } = useOfflineSync();
  
  // Real-time subscription for live updates
  useRealTimeSubscription(`tournaments/${tournamentId}`, setTournament);
  
  // Offline-first data loading
  useEffect(() => {
    TournamentService.getTournament(tournamentId)
      .then(setTournament)
      .catch(error => console.error('Failed to load tournament:', error));
  }, [tournamentId]);
  
  if (!tournament) {
    return <LoadingSpinner />;
  }
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{tournament.name}</Text>
      {/* Component implementation */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
});
```

## State Management Architecture

**State Structure using Zustand:**
```typescript
// stores/tournamentStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TournamentState {
  // Current tournament data
  activeTournament: Tournament | null;
  matches: Match[];
  players: Player[];
  
  // UI state
  isLoading: boolean;
  selectedMatchId: string | null;
  
  // Offline sync state
  syncStatus: 'synced' | 'syncing' | 'offline' | 'error';
  pendingOperations: Operation[];
  lastSyncTime: Date | null;
  
  // Actions
  setActiveTournament: (tournament: Tournament) => void;
  updateMatch: (matchId: string, updates: Partial<Match>) => void;
  addPendingOperation: (operation: Operation) => void;
  processPendingOperations: () => Promise<void>;
  
  // Real-time subscription management
  subscribeToTournament: (tournamentId: string) => void;
  unsubscribeFromTournament: () => void;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      activeTournament: null,
      matches: [],
      players: [],
      isLoading: false,
      selectedMatchId: null,
      syncStatus: 'synced',
      pendingOperations: [],
      lastSyncTime: null,
      
      setActiveTournament: (tournament) => {
        set({ activeTournament: tournament });
      },
      
      updateMatch: (matchId, updates) => {
        const matches = get().matches.map(match =>
          match.id === matchId ? { ...match, ...updates } : match
        );
        set({ matches });
        
        // Add to pending operations if offline
        if (get().syncStatus === 'offline') {
          get().addPendingOperation({
            type: 'UPDATE_MATCH',
            data: { matchId, updates },
            timestamp: new Date()
          });
        }
      },
      
      addPendingOperation: (operation) => {
        set(state => ({
          pendingOperations: [...state.pendingOperations, operation]
        }));
      },
      
      processPendingOperations: async () => {
        const { pendingOperations } = get();
        set({ syncStatus: 'syncing' });
        
        try {
          for (const operation of pendingOperations) {
            await TournamentService.executeOperation(operation);
          }
          set({ pendingOperations: [], syncStatus: 'synced', lastSyncTime: new Date() });
        } catch (error) {
          set({ syncStatus: 'error' });
          throw error;
        }
      },
      
      subscribeToTournament: (tournamentId) => {
        // Real-time subscription implementation
      },
      
      unsubscribeFromTournament: () => {
        // Cleanup subscriptions
      }
    }),
    {
      name: 'tournament-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        activeTournament: state.activeTournament,
        matches: state.matches,
        players: state.players,
        pendingOperations: state.pendingOperations
      })
    }
  )
);
```

**State Management Patterns:**
- **Optimistic Updates:** UI updates immediately, sync operations queued for later
- **Offline Queue:** Pending operations persisted locally and processed when connectivity returns
- **Real-time Subscriptions:** Automatic state updates via Firestore listeners
- **Conflict Resolution:** Server state takes precedence, with user notification for conflicts

## Routing Architecture

**Route Organization:**
```
navigation/
├── AppNavigator.tsx           # Root navigation setup
├── AuthNavigator.tsx          # Authentication flow
├── OrganizerNavigator.tsx     # Organizer-specific screens
├── PlayerNavigator.tsx        # Player-specific screens
├── SpectatorNavigator.tsx     # Spectator-specific screens
└── TournamentNavigator.tsx    # Tournament-specific screens
```

**Protected Route Pattern:**
```typescript
// navigation/ProtectedRoute.tsx
import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { LoginScreen } from '../screens/auth/LoginScreen';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'organizer' | 'player' | 'spectator';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole
}) => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <LoginScreen />;
  }
  
  if (requiredRole && user?.role !== requiredRole) {
    return <UnauthorizedScreen />;
  }
  
  return <>{children}</>;
};

// Usage in navigator
<Stack.Screen 
  name="OrganizerDashboard" 
  component={() => (
    <ProtectedRoute requiredRole="organizer">
      <OrganizerDashboardScreen />
    </ProtectedRoute>
  )}
/>
```

## Frontend Services Layer

**API Client Setup:**
```typescript
// services/ApiClient.ts
import { NetworkInfo } from '@react-native-community/netinfo';
import { useTournamentStore } from '../stores/tournamentStore';

class ApiClient {
  private baseURL: string;
  private isOnline: boolean = true;
  
  constructor() {
    this.baseURL = __DEV__ 
      ? 'http://localhost:5001/protour-dev/us-central1/api'
      : 'https://asia-south1-protour-prod.cloudfunctions.net/api';
    
    // Monitor network connectivity
    NetworkInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
    });
  }
  
  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    // If offline, queue operation and return cached data
    if (!this.isOnline) {
      const cachedData = await this.getCachedData<T>(endpoint);
      if (cachedData) {
        return cachedData;
      }
      throw new Error('No cached data available offline');
    }
    
    const url = `${this.baseURL}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache successful responses
    await this.cacheData(endpoint, data);
    
    return data;
  }
  
  private async getCachedData<T>(endpoint: string): Promise<T | null> {
    // Implementation for retrieving cached API responses
    return null;
  }
  
  private async cacheData<T>(endpoint: string, data: T): Promise<void> {
    // Implementation for caching API responses locally
  }
}

export const apiClient = new ApiClient();
```

**Service Example:**
```typescript
// services/TournamentService.ts
import { apiClient } from './ApiClient';
import { Tournament, Match, Player } from '../types';
import { useTournamentStore } from '../stores/tournamentStore';

export class TournamentService {
  static async createTournament(data: CreateTournamentRequest): Promise<Tournament> {
    return await apiClient.request<Tournament>('/tournaments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
  
  static async updateMatchScore(
    tournamentId: string, 
    matchId: string, 
    scoreData: ScoreUpdateRequest
  ): Promise<Match> {
    const match = await apiClient.request<Match>(
      `/tournaments/${tournamentId}/matches/${matchId}/score`,
      {
        method: 'PUT',
        body: JSON.stringify(scoreData)
      }
    );
    
    // Update local store optimistically
    useTournamentStore.getState().updateMatch(matchId, match);
    
    return match;
  }
  
  static async importPlayersFromCSV(
    tournamentId: string,
    csvFile: File
  ): Promise<ImportResult> {
    const formData = new FormData();
    formData.append('csvFile', csvFile);
    
    return await apiClient.request<ImportResult>(
      `/tournaments/${tournamentId}/players/import`,
      {
        method: 'POST',
        body: formData
      }
    );
  }
}
```
