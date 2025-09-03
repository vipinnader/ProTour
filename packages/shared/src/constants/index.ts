// Constants for ProTour platform

export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ORG_ADMIN: 'org_admin',
  TOURNAMENT_ADMIN: 'tournament_admin',
  TOURNAMENT_ORGANIZER: 'tournament_organizer',
  REFEREE: 'referee',
  PARTICIPANT: 'participant',
  VIEWER: 'viewer',
} as const;

export const TOURNAMENT_FORMATS = {
  SINGLE_ELIMINATION: 'single-elimination',
  DOUBLE_ELIMINATION: 'double-elimination',
  ROUND_ROBIN: 'round-robin',
  SWISS: 'swiss',
} as const;

export const TOURNAMENT_STATUSES = {
  DRAFT: 'draft',
  OPEN: 'open',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const MATCH_STATUSES = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const PARTICIPANT_STATUSES = {
  REGISTERED: 'registered',
  CONFIRMED: 'confirmed',
  CHECKED_IN: 'checked-in',
  ELIMINATED: 'eliminated',
  WITHDRAWN: 'withdrawn',
} as const;

export const SUBSCRIPTION_PLANS = {
  FREE: 'free',
  BASIC: 'basic',
  PREMIUM: 'premium',
  ENTERPRISE: 'enterprise',
} as const;

export const SUBSCRIPTION_STATUSES = {
  ACTIVE: 'active',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  USERS: '/api/users',
  ORGANIZATIONS: '/api/organizations',
  TOURNAMENTS: '/api/tournaments',
  PARTICIPANTS: '/api/participants',
  MATCHES: '/api/matches',
  PAYMENTS: '/api/payments',
  REPORTS: '/api/reports',
} as const;

export const ERROR_CODES = {
  // Authentication errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Authorization errors
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Tournament specific errors
  TOURNAMENT_FULL: 'TOURNAMENT_FULL',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  TOURNAMENT_STARTED: 'TOURNAMENT_STARTED',

  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REQUIRED: 'PAYMENT_REQUIRED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',

  // System errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
} as const;

export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100,
} as const;

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 1000,
  TOURNAMENT_NAME_MAX_LENGTH: 100,
  MAX_PARTICIPANTS: 10000,
} as const;

export const SECURITY_CONFIG = {
  JWT_EXPIRY: '24h',
  REFRESH_TOKEN_EXPIRY: '7d',
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
} as const;

export const FILE_UPLOAD_CONFIG = {
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'text/plain', 'text/csv'],
  MAX_FILES_PER_REQUEST: 5,
} as const;

export const SPORTS_LIST = [
  'Tennis',
  'Badminton',
  'Table Tennis',
  'Chess',
  'Cricket',
  'Football',
  'Basketball',
  'Volleyball',
  'Swimming',
  'Athletics',
  'Golf',
  'Squash',
  'Snooker',
  'Carrom',
  'Other',
] as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];
export type TournamentFormat =
  (typeof TOURNAMENT_FORMATS)[keyof typeof TOURNAMENT_FORMATS];
export type TournamentStatus =
  (typeof TOURNAMENT_STATUSES)[keyof typeof TOURNAMENT_STATUSES];
export type MatchStatus = (typeof MATCH_STATUSES)[keyof typeof MATCH_STATUSES];
export type ParticipantStatus =
  (typeof PARTICIPANT_STATUSES)[keyof typeof PARTICIPANT_STATUSES];
export type SubscriptionPlan =
  (typeof SUBSCRIPTION_PLANS)[keyof typeof SUBSCRIPTION_PLANS];
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
export type SportType = (typeof SPORTS_LIST)[number];
