// Validation utilities for ProTour - Epic 1 Implementation

import { Tournament, Player, Match } from '../types';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Tournament validation
export const validateTournament = (tournament: Partial<Tournament>): void => {
  if (!tournament.name || tournament.name.trim().length < 3) {
    throw new ValidationError('Tournament name must be at least 3 characters', 'name');
  }

  if (!tournament.date) {
    throw new ValidationError('Tournament date is required', 'date');
  }

  if (tournament.date) {
    const dateToCheck = tournament.date.toDate ? tournament.date.toDate() : tournament.date;
    if (new Date(dateToCheck) < new Date()) {
      throw new ValidationError('Tournament date cannot be in the past', 'date');
    }
  }

  if (!tournament.sport || !['badminton', 'tennis', 'squash'].includes(tournament.sport)) {
    throw new ValidationError('Valid sport selection is required', 'sport');
  }

  if (!tournament.format || !['single-elimination', 'double-elimination'].includes(tournament.format)) {
    throw new ValidationError('Valid tournament format is required', 'format');
  }

  if (tournament.maxPlayers && (tournament.maxPlayers < 4 || tournament.maxPlayers > 64)) {
    throw new ValidationError('Max players must be between 4 and 64', 'maxPlayers');
  }
};

// Player validation
export const validatePlayer = (player: Partial<Player>): void => {
  if (!player.name || player.name.trim().length < 2) {
    throw new ValidationError('Player name must be at least 2 characters', 'name');
  }

  if (!player.email || !isValidEmail(player.email)) {
    throw new ValidationError('Valid email address is required', 'email');
  }

  if (player.phone && !isValidPhone(player.phone)) {
    throw new ValidationError('Phone number format is invalid', 'phone');
  }

  if (player.ranking !== undefined && (player.ranking < 0 || player.ranking > 10000)) {
    throw new ValidationError('Ranking must be between 0 and 10000', 'ranking');
  }
};

// Match validation
export const validateMatch = (match: Partial<Match>): void => {
  if (!match.tournamentId) {
    throw new ValidationError('Tournament ID is required', 'tournamentId');
  }

  if (!match.player1Id) {
    throw new ValidationError('Player 1 is required', 'player1Id');
  }

  if (match.round !== undefined && match.round < 1) {
    throw new ValidationError('Round must be a positive number', 'round');
  }

  if (match.matchNumber !== undefined && match.matchNumber < 1) {
    throw new ValidationError('Match number must be a positive number', 'matchNumber');
  }

  if (match.status && !['pending', 'in-progress', 'completed'].includes(match.status)) {
    throw new ValidationError('Invalid match status', 'status');
  }
};

// Email validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Phone validation (international format support)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^[\+]?[0-9\-\s\(\)]{8,15}$/;
  return phoneRegex.test(phone.trim());
};

// Tournament code validation
export const isValidTournamentCode = (code: string): boolean => {
  const codeRegex = /^[A-Z0-9]{6}$/;
  return codeRegex.test(code);
};

// CSV validation helpers
export const validateCSVHeaders = (
  headers: string[], 
  requiredHeaders: string[]
): { isValid: boolean; missingHeaders: string[] } => {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());
  const normalizedRequired = requiredHeaders.map(h => h.toLowerCase());
  
  const missingHeaders = normalizedRequired.filter(
    required => !normalizedHeaders.includes(required)
  );

  return {
    isValid: missingHeaders.length === 0,
    missingHeaders: missingHeaders.map(h => 
      requiredHeaders[normalizedRequired.indexOf(h)]
    ),
  };
};

// Sanitization helpers
export const sanitizeString = (str: string | undefined): string => {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
};

export const sanitizeEmail = (email: string | undefined): string => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

// Tournament business logic validation
export const canStartTournament = (tournament: Tournament, playerCount: number): boolean => {
  return (
    tournament.status === 'setup' &&
    playerCount >= 4 &&
    playerCount <= tournament.maxPlayers
  );
};

export const canModifyTournament = (tournament: Tournament): boolean => {
  return tournament.status === 'setup';
};

export const canDeleteTournament = (tournament: Tournament): boolean => {
  return tournament.status !== 'active';
};

// Bracket validation helpers
export const isValidBracketSize = (playerCount: number): boolean => {
  return playerCount >= 4 && playerCount <= 64;
};

export const calculateNextPowerOf2 = (num: number): number => {
  return Math.pow(2, Math.ceil(Math.log2(num)));
};

export const validateBracketStructure = (
  playerCount: number,
  matchCount: number
): { isValid: boolean; error?: string } => {
  if (!isValidBracketSize(playerCount)) {
    return {
      isValid: false,
      error: 'Player count must be between 4 and 64',
    };
  }

  const expectedMatches = playerCount - 1; // Single elimination
  if (matchCount !== expectedMatches) {
    return {
      isValid: false,
      error: `Expected ${expectedMatches} matches for ${playerCount} players, got ${matchCount}`,
    };
  }

  return { isValid: true };
};