// Core data models for ProTour platform - Epic 1 Implementation

import { Timestamp } from '@react-native-firebase/firestore';

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'organizer' | 'player' | 'spectator';
  phone?: string;
  profileImage?: string;
  emailVerified: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
}

// Tournament Types - Epic 1 Focus
export interface Tournament {
  id: string;
  name: string;
  date: Timestamp;
  sport: 'badminton' | 'tennis' | 'squash';
  format: 'single-elimination' | 'double-elimination';
  matchFormat: 'best-of-1' | 'best-of-3' | 'best-of-5';
  description?: string;
  location?: string;
  organizerId: string;
  status: 'setup' | 'active' | 'completed';
  isPublic: boolean;
  tournamentCode: string; // 6-digit alphanumeric code
  maxPlayers: number;
  currentPlayerCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface TournamentFormData {
  name: string;
  date: Date;
  sport: 'badminton' | 'tennis' | 'squash';
  format: 'single-elimination' | 'double-elimination';
  matchFormat: 'best-of-1' | 'best-of-3' | 'best-of-5';
  location?: string;
  description?: string;
  isPublic: boolean;
  maxPlayers: number;
}

// Player Types - Epic 1 CSV Import Focus
export interface Player {
  id: string;
  name: string;
  email: string;
  phone?: string;
  ranking?: number;
  notes?: string;
  tournamentId: string;
  seedPosition?: number;
  eliminated?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PlayerImportData {
  name: string;
  email: string;
  phone?: string;
  ranking?: number;
  notes?: string;
}

export interface CSVImportResult {
  validPlayers: PlayerImportData[];
  errors: CSVImportError[];
  duplicates: CSVDuplicate[];
  totalRows: number;
}

export interface CSVImportError {
  row: number;
  field: string;
  value: string;
  message: string;
  suggestion?: string;
}

export interface CSVDuplicate {
  row: number;
  existingRow: number;
  player: PlayerImportData;
  conflictField: 'email' | 'name';
  resolution?: 'merge' | 'skip' | 'rename';
}

// Match and Bracket Types - Epic 1 Generation Focus
export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  player1Id: string;
  player2Id?: string; // null for bye
  winnerId?: string;
  score?: MatchScore;
  status: 'pending' | 'in-progress' | 'completed';
  startTime?: Timestamp;
  endTime?: Timestamp;
  court?: string;
  nextMatchId?: string; // For bracket progression
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MatchScore {
  player1Sets: number[];
  player2Sets: number[];
  winner: 'player1' | 'player2';
}

export interface BracketStructure {
  tournamentId: string;
  format: 'single-elimination' | 'double-elimination';
  playerCount: number;
  byeCount: number;
  totalRounds: number;
  matches: Match[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BracketValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Organization Types (Future Epic Support)
export interface Organization {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  ownerId: string;
  subscription: {
    plan: 'free' | 'basic' | 'premium' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired';
    expiresAt?: Timestamp;
  };
  settings: {
    allowPublicTournaments: boolean;
    requireApproval: boolean;
    maxTournaments: number;
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface FilterParams extends PaginationParams {
  search?: string;
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Tournament Progress and Monitoring Types - Epic 2A
export type TournamentStage = 'setup' | 'match-scheduling' | 'active-play' | 'completed';

export interface TournamentProgressStats {
  totalMatches: number;
  completedMatches: number;
  inProgressMatches: number;
  pendingMatches: number;
  activePlayers: number;
  eliminatedPlayers: number;
  overallProgress: number; // percentage
  estimatedCompletion: Date;
}

// Epic 3 Types - Multi-Role Tournament Experience
export interface TournamentRegistration {
  id: string;
  tournamentId: string;
  playerId: string;
  userId: string;
  role: 'player' | 'spectator';
  registeredAt: Timestamp;
  status: 'active' | 'withdrawn';
  withdrawnAt?: Timestamp;
  withdrawalReason?: string;
}

export interface PlayerSchedule {
  playerId: string;
  tournamentId: string;
  currentMatch?: Match;
  upcomingMatches: Match[];
  completedMatches: Match[];
  tournamentProgress: BracketPosition;
  estimatedNextMatchTime?: Date;
  nextMatchNotification?: {
    thirtyMinutes: boolean;
    tenMinutes: boolean;
    ready: boolean;
  };
}

export interface BracketPosition {
  currentRound: number;
  position: number;
  eliminated: boolean;
  advancedToRound?: number;
  canAdvanceToRound?: number;
}

export interface PlayerProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  statistics: PlayerStatistics;
  tournaments: PlayerTournamentHistory[];
  privacySettings: PlayerPrivacySettings;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PlayerStatistics {
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  setsWon: number;
  setsLost: number;
  tournamentsEntered: number;
  tournamentsWon: number;
  winPercentage: number;
  currentStreak: number;
  bestStreak: number;
}

export interface PlayerTournamentHistory {
  tournamentId: string;
  tournamentName: string;
  sport: string;
  date: Timestamp;
  finalPosition: number;
  totalParticipants: number;
  matchesWon: number;
  matchesLost: number;
}

export interface PlayerPrivacySettings {
  showProfile: 'everyone' | 'tournament-participants' | 'private';
  showStatistics: 'everyone' | 'tournament-participants' | 'private';
  showTournamentHistory: 'everyone' | 'tournament-participants' | 'private';
  allowFollowing: boolean;
  allowNotifications: boolean;
}

export interface PlayerFollow {
  id: string;
  followerId: string;
  followedPlayerId: string;
  createdAt: Timestamp;
  notificationsEnabled: boolean;
}

export interface SpectatorSession {
  id: string;
  spectatorId: string;
  tournamentId: string;
  followedPlayers: string[];
  followedMatches: string[];
  preferredNotifications: SpectatorNotificationSettings;
  createdAt: Timestamp;
  lastActivity: Timestamp;
}

export interface SpectatorNotificationSettings {
  matchCompletions: boolean;
  bracketUpdates: boolean;
  followedPlayerMatches: boolean;
  tournamentStart: boolean;
  tournamentEnd: boolean;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  tournamentId?: string;
  type: 'match-ready' | 'match-completed' | 'bracket-updated' | 'tournament-update';
  enabled: boolean;
  timing?: {
    thirtyMinutes?: boolean;
    tenMinutes?: boolean;
    immediate?: boolean;
  };
  delivery: ('push' | 'email' | 'sms')[];
}

export interface MatchTimeline {
  matchId: string;
  events: MatchEvent[];
  duration: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface MatchEvent {
  id: string;
  timestamp: Date;
  type: 'match-start' | 'point-scored' | 'set-completed' | 'match-end' | 'timeout' | 'injury';
  player?: 'player1' | 'player2';
  details: {
    score?: MatchScore;
    note?: string;
    duration?: number;
  };
}

// Tournament Access and Discovery
export interface TournamentAccess {
  tournamentId: string;
  accessCode: string;
  userId: string;
  role: 'player' | 'spectator';
  joinedAt: Timestamp;
  active: boolean;
}

export interface TournamentSearchFilters {
  sport?: 'badminton' | 'tennis' | 'squash';
  dateFrom?: Date;
  dateTo?: Date;
  location?: string;
  status?: 'setup' | 'active' | 'completed';
  isPublic?: boolean;
  maxDistance?: number; // km radius for location-based search
}