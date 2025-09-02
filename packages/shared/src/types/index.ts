// Common types for ProTour platform

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  sport: string;
  format: 'single-elimination' | 'double-elimination' | 'round-robin' | 'swiss';
  maxParticipants: number;
  registrationDeadline: Date;
  startDate: Date;
  endDate: Date;
  venue?: string;
  entryFee?: number;
  isPublic: boolean;
  organizerId: string;
  organizationId: string;
  status: 'draft' | 'open' | 'active' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

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
    expiresAt?: Date;
  };
  settings: {
    allowPublicTournaments: boolean;
    requireApproval: boolean;
    maxTournaments: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  userId: string;
  tournamentId: string;
  registrationDate: Date;
  status: 'registered' | 'confirmed' | 'checked-in' | 'eliminated' | 'withdrawn';
  seed?: number;
  groupId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  participant1Id: string;
  participant2Id: string;
  winnerId?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduledTime?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  scores: {
    participant1: number[];
    participant2: number[];
  };
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
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