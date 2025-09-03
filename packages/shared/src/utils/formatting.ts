// Formatting utilities for ProTour - Epic 1 Implementation

import { Tournament, Player, Match } from '../types';

// Date formatting
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateTime = (date: Date): string => {
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (date: Date): string => {
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Tournament formatting
export const formatTournamentStatus = (status: Tournament['status']): string => {
  const statusMap = {
    'setup': 'Setup',
    'active': 'Active',
    'completed': 'Completed',
  };
  return statusMap[status] || status;
};

export const formatSport = (sport: Tournament['sport']): string => {
  const sportMap = {
    'badminton': 'Badminton',
    'tennis': 'Tennis',
    'squash': 'Squash',
  };
  return sportMap[sport] || sport;
};

export const formatTournamentFormat = (format: Tournament['format']): string => {
  const formatMap = {
    'single-elimination': 'Single Elimination',
    'double-elimination': 'Double Elimination',
  };
  return formatMap[format] || format;
};

export const formatMatchFormat = (format: Tournament['matchFormat']): string => {
  const formatMap = {
    'best-of-1': 'Best of 1',
    'best-of-3': 'Best of 3',
    'best-of-5': 'Best of 5',
  };
  return formatMap[format] || format;
};

// Player formatting
export const formatPlayerName = (player: Player): string => {
  return player.name.trim();
};

export const formatPlayerEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

export const formatPhone = (phone?: string): string => {
  if (!phone) return '';
  
  // Basic phone formatting for Indian numbers
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+91-${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  }
  
  if (cleaned.length === 10) {
    return `+91-${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
  }
  
  return phone; // Return original if can't format
};

// Match formatting
export const formatMatchStatus = (status: Match['status']): string => {
  const statusMap = {
    'pending': 'Pending',
    'in-progress': 'In Progress',
    'completed': 'Completed',
  };
  return statusMap[status] || status;
};

export const formatMatchTitle = (match: Match): string => {
  return `Round ${match.round} - Match ${match.matchNumber}`;
};

export const formatScore = (match: Match): string => {
  if (!match.score || match.status !== 'completed') {
    return '-';
  }

  const { player1Sets, player2Sets } = match.score;
  const setsDisplay = player1Sets.map((p1Score, index) => {
    return `${p1Score}-${player2Sets[index]}`;
  }).join(', ');

  return setsDisplay;
};

// Tournament code formatting
export const formatTournamentCode = (code: string): string => {
  return code.toUpperCase().replace(/(.{3})/g, '$1 ').trim();
};

// CSV formatting
export const formatCSVData = (data: any[][]): string => {
  return data.map(row => 
    row.map(cell => {
      const cellStr = String(cell || '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
        return `"${cellStr.replace(/"/g, '""')}"`;
      }
      return cellStr;
    }).join(',')
  ).join('\n');
};

// File size formatting
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Number formatting
export const formatPlayerCount = (current: number, max: number): string => {
  return `${current} / ${max} players`;
};

export const formatRanking = (ranking?: number): string => {
  if (ranking === undefined) return 'Unranked';
  return `#${ranking}`;
};

// Error message formatting
export const formatValidationError = (field: string, message: string): string => {
  const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
  return `${fieldName}: ${message}`;
};

// URL formatting
export const formatTournamentUrl = (tournamentId: string): string => {
  return `/tournaments/${tournamentId}`;
};

export const formatPlayerUrl = (tournamentId: string, playerId: string): string => {
  return `/tournaments/${tournamentId}/players/${playerId}`;
};

export const formatBracketUrl = (tournamentId: string): string => {
  return `/tournaments/${tournamentId}/bracket`;
};

// Bracket formatting
export const formatBracketPosition = (round: number, matchNumber: number): string => {
  return `R${round}M${matchNumber}`;
};

export const formatRoundName = (round: number, totalRounds: number): string => {
  if (round === totalRounds) return 'Final';
  if (round === totalRounds - 1) return 'Semifinal';
  if (round === totalRounds - 2) return 'Quarterfinal';
  return `Round ${round}`;
};

// Validation message formatting
export const formatCSVError = (row: number, field: string, message: string): string => {
  return `Row ${row}, ${field}: ${message}`;
};

export const formatImportSummary = (
  valid: number, 
  errors: number, 
  duplicates: number
): string => {
  const parts = [`${valid} valid players`];
  
  if (errors > 0) {
    parts.push(`${errors} errors`);
  }
  
  if (duplicates > 0) {
    parts.push(`${duplicates} duplicates`);
  }
  
  return parts.join(', ');
};