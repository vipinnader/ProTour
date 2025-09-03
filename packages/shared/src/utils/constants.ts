// Constants for ProTour - Epic 1 Implementation

// Tournament Configuration
export const TOURNAMENT_CONSTRAINTS = {
  NAME_MIN_LENGTH: 3,
  NAME_MAX_LENGTH: 100,
  DESCRIPTION_MAX_LENGTH: 500,
  LOCATION_MAX_LENGTH: 200,
  MIN_PLAYERS: 4,
  MAX_PLAYERS: 64,
  TOURNAMENT_CODE_LENGTH: 6,
} as const;

// Player Configuration
export const PLAYER_CONSTRAINTS = {
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  PHONE_MAX_LENGTH: 20,
  NOTES_MAX_LENGTH: 500,
  MIN_RANKING: 0,
  MAX_RANKING: 10000,
} as const;

// CSV Import Configuration
export const CSV_IMPORT_CONSTRAINTS = {
  MAX_FILE_SIZE_MB: 2,
  MAX_PLAYERS_PER_IMPORT: 100,
  SUPPORTED_DELIMITERS: [',', ';', '\t'],
  SUPPORTED_ENCODINGS: ['utf-8', 'iso-8859-1'],
  REQUIRED_HEADERS: ['name', 'email'],
  OPTIONAL_HEADERS: ['phone', 'ranking', 'notes'],
} as const;

// Sports Configuration
export const SPORTS = {
  BADMINTON: 'badminton',
  TENNIS: 'tennis',
  SQUASH: 'squash',
} as const;

export const SPORT_LABELS = {
  [SPORTS.BADMINTON]: 'Badminton',
  [SPORTS.TENNIS]: 'Tennis',
  [SPORTS.SQUASH]: 'Squash',
} as const;

// Tournament Formats
export const TOURNAMENT_FORMATS = {
  SINGLE_ELIMINATION: 'single-elimination',
  DOUBLE_ELIMINATION: 'double-elimination',
} as const;

export const TOURNAMENT_FORMAT_LABELS = {
  [TOURNAMENT_FORMATS.SINGLE_ELIMINATION]: 'Single Elimination',
  [TOURNAMENT_FORMATS.DOUBLE_ELIMINATION]: 'Double Elimination',
} as const;

// Match Formats
export const MATCH_FORMATS = {
  BEST_OF_1: 'best-of-1',
  BEST_OF_3: 'best-of-3',
  BEST_OF_5: 'best-of-5',
} as const;

export const MATCH_FORMAT_LABELS = {
  [MATCH_FORMATS.BEST_OF_1]: 'Best of 1',
  [MATCH_FORMATS.BEST_OF_3]: 'Best of 3',
  [MATCH_FORMATS.BEST_OF_5]: 'Best of 5',
} as const;

// Status Types
export const TOURNAMENT_STATUSES = {
  SETUP: 'setup',
  ACTIVE: 'active',
  COMPLETED: 'completed',
} as const;

export const TOURNAMENT_STATUS_LABELS = {
  [TOURNAMENT_STATUSES.SETUP]: 'Setup',
  [TOURNAMENT_STATUSES.ACTIVE]: 'Active',
  [TOURNAMENT_STATUSES.COMPLETED]: 'Completed',
} as const;

export const MATCH_STATUSES = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
} as const;

export const MATCH_STATUS_LABELS = {
  [MATCH_STATUSES.PENDING]: 'Pending',
  [MATCH_STATUSES.IN_PROGRESS]: 'In Progress',
  [MATCH_STATUSES.COMPLETED]: 'Completed',
} as const;

// User Roles
export const USER_ROLES = {
  ORGANIZER: 'organizer',
  PLAYER: 'player',
  SPECTATOR: 'spectator',
} as const;

export const USER_ROLE_LABELS = {
  [USER_ROLES.ORGANIZER]: 'Organizer',
  [USER_ROLES.PLAYER]: 'Player',
  [USER_ROLES.SPECTATOR]: 'Spectator',
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Generic
  REQUIRED_FIELD: 'This field is required',
  INVALID_FORMAT: 'Invalid format',
  
  // Tournament
  TOURNAMENT_NOT_FOUND: 'Tournament not found',
  TOURNAMENT_NAME_TOO_SHORT: `Tournament name must be at least ${TOURNAMENT_CONSTRAINTS.NAME_MIN_LENGTH} characters`,
  TOURNAMENT_FULL: 'Tournament is full',
  TOURNAMENT_ALREADY_STARTED: 'Tournament has already started',
  
  // Player
  PLAYER_NOT_FOUND: 'Player not found',
  PLAYER_NAME_TOO_SHORT: `Player name must be at least ${PLAYER_CONSTRAINTS.NAME_MIN_LENGTH} characters`,
  INVALID_EMAIL: 'Invalid email address',
  DUPLICATE_EMAIL: 'A player with this email already exists',
  
  // Match
  MATCH_NOT_FOUND: 'Match not found',
  INVALID_MATCH_STATUS: 'Invalid match status',
  MATCH_ALREADY_COMPLETED: 'Match is already completed',
  
  // Bracket
  INSUFFICIENT_PLAYERS: `At least ${TOURNAMENT_CONSTRAINTS.MIN_PLAYERS} players required`,
  TOO_MANY_PLAYERS_TOURNAMENT: `Maximum ${TOURNAMENT_CONSTRAINTS.MAX_PLAYERS} players allowed`,
  BRACKET_NOT_GENERATED: 'Tournament bracket has not been generated',
  
  // CSV Import
  FILE_TOO_LARGE: `File size must be less than ${CSV_IMPORT_CONSTRAINTS.MAX_FILE_SIZE_MB}MB`,
  INVALID_FILE_TYPE: 'Only CSV files are supported',
  MISSING_REQUIRED_HEADERS: 'CSV file is missing required headers',
  TOO_MANY_PLAYERS_IMPORT: `Cannot import more than ${CSV_IMPORT_CONSTRAINTS.MAX_PLAYERS_PER_IMPORT} players`,
  
  // Authentication
  UNAUTHORIZED: 'You are not authorized to perform this action',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_NOT_VERIFIED: 'Please verify your email address',
  
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  TOURNAMENT_CREATED: 'Tournament created successfully',
  TOURNAMENT_UPDATED: 'Tournament updated successfully',
  TOURNAMENT_DELETED: 'Tournament deleted successfully',
  PLAYERS_IMPORTED: 'Players imported successfully',
  BRACKET_GENERATED: 'Tournament bracket generated successfully',
  MATCH_COMPLETED: 'Match completed successfully',
} as const;

// Validation Regex Patterns
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^[\+]?[0-9\-\s\(\)]{8,15}$/,
  TOURNAMENT_CODE: /^[A-Z0-9]{6}$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
} as const;

// Database Collections
export const COLLECTIONS = {
  USERS: 'users',
  TOURNAMENTS: 'tournaments',
  PLAYERS: 'players',
  MATCHES: 'matches',
  ORGANIZATIONS: 'organizations',
} as const;

// Firebase Configuration
export const FIREBASE_CONFIG = {
  EMULATOR_PORTS: {
    AUTH: 9099,
    FIRESTORE: 8080,
    FUNCTIONS: 5001,
    STORAGE: 9199,
  },
  EMULATOR_HOST: {
    ANDROID: '10.0.2.2',
    IOS: 'localhost',
  },
} as const;

// CSV Template
export const CSV_TEMPLATE_HEADERS = [
  'Name',
  'Email', 
  'Phone',
  'Ranking',
  'Notes',
] as const;

export const CSV_SAMPLE_DATA = [
  ['John Smith', 'john@email.com', '+91-9876543210', '1500', 'Previous champion'],
  ['Jane Doe', 'jane@email.com', '+91-8765432109', '', 'First time player'],
  ['Mike Johnson', 'mike@email.com', '', '1200', ''],
] as const;