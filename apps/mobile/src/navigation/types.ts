/**
 * Navigation types for ProTour app
 */

import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  EmailVerification: undefined;
};

export type MainStackParamList = {
  Dashboard: undefined;
  CreateTournament: undefined;
  ImportPlayers: { tournamentId: string; tournamentName: string };
  BracketView: { tournamentId: string };
  BracketEdit: { tournamentId: string };
  MatchManagement: { tournamentId: string };
  MatchDetail: { matchId: string; tournamentId: string };
  LiveScoring: { matchId: string; tournamentId: string };
  TournamentProgress: { tournamentId: string };
  RefereeTools: { matchId: string; tournamentId: string };
};

export type RootStackParamList = AuthStackParamList & MainStackParamList;

// Screen props types
export type ImportPlayersScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'ImportPlayers'
>;
export type BracketViewScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'BracketView'
>;
export type BracketEditScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'BracketEdit'
>;
export type MatchManagementScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'MatchManagement'
>;
export type MatchDetailScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'MatchDetail'
>;
export type LiveScoringScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'LiveScoring'
>;
export type TournamentProgressScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'TournamentProgress'
>;
export type RefereeToolsScreenProps = NativeStackScreenProps<
  MainStackParamList,
  'RefereeTools'
>;
