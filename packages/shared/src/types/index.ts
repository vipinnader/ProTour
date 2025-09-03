// Core data models for ProTour platform - Epic 1-4 Implementation

import { Timestamp } from '@react-native-firebase/firestore';

// Epic 4: Indian Market Connectivity Types
export type NetworkQuality = '2G' | '3G' | '4G' | 'WiFi';
export type PerformanceProfile = 'ultra-conservative' | 'data-saver' | 'balanced' | 'performance';
export type DataPriority = 'critical' | 'high' | 'medium' | 'low' | 'background';

export interface NetworkMetrics {
  quality: NetworkQuality;
  bandwidth: number; // Mbps
  latency: number; // milliseconds
  compressionEnabled: boolean;
  cacheHitRate: number; // 0-1
  offlineCapacityHours: number;
  dataUsageReduction: number; // percentage
}

export interface CompressionSettings {
  images: number; // 0-1 quality
  text: boolean;
  json: boolean;
  batchSize: number;
  compressionRatio: number; // target compression ratio
}

export interface CacheConfig {
  [dataType: string]: {
    ttl: number; // milliseconds
    maxSize: string; // e.g., '50MB'
    priority: 'high' | 'medium' | 'low';
    compression?: boolean;
  };
}

export interface OfflineCapacityInfo {
  hoursAvailable: number;
  cacheSize: number; // bytes
  essentialDataSize: number; // bytes
  availableStorage: number; // bytes
  canExtendTo12Hours: boolean;
  indicatorLevel: 'green' | 'yellow' | 'red';
}

export interface SyncOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entity: string;
  data: any;
  priority: DataPriority;
  timestamp: Timestamp;
  retryCount?: number;
}

export interface DataUsageMetrics {
  dailyUsageMB: number;
  monthlyUsageMB: number;
  remainingDailyMB: number;
  compressionSavings: number; // percentage
  cachingSavings: number; // percentage
  totalSavingsPercent: number;
  projectedMonthlyUsageGB: number;
  recommendations: string[];
}

export interface IndianNetworkConfig {
  performanceProfile: PerformanceProfile;
  dataLimitGB: number;
  preferredISPs: string[];
  tournamentHours: { start: number; end: number };
  languages: string[];
  deviceSpecs: {
    ramGB: number;
    storageGB: number;
    androidVersion: string;
  };
}

// Epic 4: SMS Backup System Types
export interface SMSResult {
  messageId: string;
  status: 'sent' | 'failed' | 'pending';
  cost: number;
  timestamp: Date;
  phoneNumber: string;
  message: string;
  deliveryExpected?: Date;
  error?: string;
}

export interface BatchSMSResult {
  batchId: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  totalCost: number;
  results: SMSResult[];
  timestamp: Date;
}

export interface MatchAlert {
  type: 'match-ready' | 'tournament-delay' | 'bracket-update';
  playerName?: string;
  opponent?: string;
  court?: string;
  delayMinutes?: number;
  reason?: string;
  result?: string;
  tournamentCode?: string;
}

export interface FallbackConditions {
  enabled: boolean;
  timeoutMs?: number;
  urgencyLevels?: ('low' | 'medium' | 'high' | 'emergency')[];
  maxRetriesPerDay?: number;
  costLimitPerDay?: number;
}

export interface DeliveryStatus {
  messageId: string;
  status: 'pending' | 'delivered' | 'failed' | 'expired';
  deliveredAt?: Date;
  failureReason?: string;
  canRetry: boolean;
  retryCount?: number;
}

export interface SMSProvider {
  name: string;
  apiKey: string;
  apiSecret: string;
  senderId: string;
  baseUrl: string;
}

export interface SMSTemplate {
  name: string;
  template: string;
  maxLength: number;
  variables: string[];
}

export interface SMSCostConfig {
  dailyLimit: number; // in rupees
  monthlyLimit: number; // in rupees
  costPerSMS: number; // per SMS in rupees
  emergencyCostMultiplier: number;
  batchDiscountThreshold: number;
  batchDiscountRate: number; // percentage discount
}

// Epic 4: Performance Optimization Types
export interface DeviceSpecs {
  ramGB: number;
  storageGB: number;
  cpuCores: number;
  androidVersion: string;
  screenResolution: { width: number; height: number };
  batteryCapacityMah: number;
  networkCapabilities: string[];
}

export interface OptimizationConfig {
  deviceProfile: 'budget' | 'mid-range' | 'premium';
  memoryOptimization: {
    enabled: boolean;
    maxHeapSize: number; // MB
    gcFrequency: 'normal' | 'aggressive';
    cacheSize: number; // MB
  };
  renderingOptimization: {
    reducedAnimations: boolean;
    simplifiedUI: boolean;
    hardwareAcceleration: boolean;
    maxFPS: number;
  };
  networkOptimization: {
    enableCompression: boolean;
    batchRequests: boolean;
    cacheAggressively: boolean;
    reduceImageQuality: number; // 0-1
  };
  batteryOptimization: {
    enabled: boolean;
    backgroundTaskLimits: boolean;
    screenBrightnessOptimization: boolean;
    networkOptimization: boolean;
  };
}

export interface MediaFile {
  id: string;
  name: string;
  type: string;
  size: number; // bytes
  url: string;
  metadata?: any;
}

export interface CompressedMedia {
  originalFile: MediaFile;
  compressedSize: number; // bytes
  compressionPercent: number;
  compressionRatio: number; // 0-1
  quality: number; // 0-1
  timestamp: Date;
}

export interface MemoryUsageReport {
  currentUsage: number; // bytes
  maxUsage: number; // bytes
  utilizationPercent: number;
  recommendations: string[];
  criticalLevel: boolean;
  timestamp: Date;
}

export interface BatteryUsageEstimate {
  estimatedHourlyDrain: number; // percentage
  eightHourProjection: number; // percentage
  optimizationLevel: 'low' | 'medium' | 'high';
  recommendations: string[];
  targetAchieved: boolean;
  timestamp: Date;
}

export interface PerformanceMetrics {
  memory: MemoryUsageReport;
  battery: BatteryUsageEstimate;
  network: NetworkMetrics;
  dataUsage: number; // MB
  startupTime: number; // milliseconds
  renderPerformance: number; // FPS
  deviceSpecs?: DeviceSpecs;
  optimizationLevel: 'low' | 'medium' | 'high';
  timestamp: Date;
}

export interface DataUsageControl {
  trackingEnabled: boolean;
  dailyLimit: number; // bytes
  currentUsage: number; // bytes
  userControls: {
    enableImageCompression: boolean;
    enableDataSaver: boolean;
    enableWiFiOnly: boolean;
    enableBackgroundDataLimit: boolean;
  };
  alerts: {
    at75Percent: boolean;
    at90Percent: boolean;
    atLimit: boolean;
  };
}

export interface DeviceCapabilities {
  maxMemory: number; // MB
  maxStorage: number; // GB
  maxCPUCores: number;
  supportedFeatures: string[];
  limitations: string[];
}

// Indian Device Optimization Types
export type IndianDeviceProfile = 'budget' | 'mid-range' | 'premium';

export interface BudgetDeviceConfig {
  ramGB: number;
  storageGB: number;
  optimizationLevel: 'minimal' | 'moderate' | 'aggressive' | 'ultra-aggressive';
  imageQuality: number;
  animationsDisabled?: boolean;
  animationsReduced?: boolean;
  animationsEnabled?: boolean;
  backgroundTasksMinimal?: boolean;
  backgroundTasksLimited?: boolean;
  backgroundTasksNormal?: boolean;
}

export interface DataUsageOptimization {
  dailyLimitMB: number;
  compressionLevel: 'minimal' | 'moderate' | 'high' | 'maximum';
  imageQuality: number; // 0-1
  videoDisabled: boolean;
  backgroundSyncLimited: boolean;
  wifiOnlyForLargeData: boolean;
  dataUsageAlerts: {
    at50Percent: boolean;
    at75Percent: boolean;
    at90Percent: boolean;
  };
}

export interface BatteryLifeOptimization {
  targetHours: number;
  maxBatteryDrain: number; // percentage
  optimizationLevel: 'minimal' | 'moderate' | 'aggressive';
  backgroundTaskLimits: boolean;
  screenOptimization: boolean;
  networkOptimization: boolean;
  realTimeMonitoring: boolean;
}

export interface StorageOptimization {
  cacheLimit: number; // MB
  temporaryFileCleanup: boolean;
  imageCompressionStorage: boolean;
  offlineDataLimit: number; // MB
  autoCleanupEnabled: boolean;
  lowStorageMode: boolean;
}

// Epic 4: Production Monitoring Types
export interface MonitoringSession {
  sessionId: string;
  tournamentId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed';
  metrics: {
    responseTime: { current: number; average: number; max: number; alerts: number };
    syncLatency: { current: number; average: number; max: number; alerts: number };
    offlineCapacity: { current: number; minimum: number; alerts: number };
    smsDeliveryRate: { current: number; average: number; alerts: number };
    batteryDrain: { current: number; projected8Hour: number; alerts: number };
    errorCount: { total: number; critical: number; warnings: number };
    activeUsers: { current: number; peak: number; concurrent: number };
  };
  alerts: any[];
  incidents: any[];
}

export interface AlertCriteria {
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalationLevel?: EscalationLevel;
  channels?: string[];
  cooldownMinutes?: number;
}

export interface PerformanceReport {
  reportId: string;
  timeRange: { start: Date; end: Date };
  summary: {
    totalTournaments: number;
    totalUsers: number;
    totalIncidents: number;
    systemUptime: number;
    averageResponseTime: number;
  };
  metrics: {
    performance: any;
    reliability: any;
    userExperience: any;
    indianMarket: any;
  };
  incidents: any[];
  recommendations: string[];
  trends: any;
  generatedAt: Date;
}

export interface Incident {
  id?: string;
  type?: string;
  tournamentId?: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedUsers?: number;
  reportedBy?: string;
  timestamp: Date;
}

export interface IncidentResponse {
  incidentId: string;
  responseId: string;
  actions: any[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo: string;
  startedAt: Date;
  estimatedResolutionTime: Date;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  components: {
    database: string;
    api: string;
    notifications: string;
    sms: string;
    storage: string;
    network: string;
  };
  metrics: {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
    activeConnections: number;
    errorRate: number;
  };
  activeIncidents: any[];
  recentAlerts: any[];
}

export interface TournamentMetrics {
  responseTime: { target: number; critical: number };
  syncLatency: { target: number; critical: number };
  offlineCapacity: { target: number; critical: number };
  smsDeliveryRate: { target: number; critical: number };
  batteryDrain: { target: number; critical: number };
  memoryUsage?: { target: number; critical: number };
  networkLatency?: { target: number; critical: number };
  errorRate?: { target: number; critical: number };
}

export interface MonitoringConfig {
  enabled: boolean;
  interval: number; // seconds
  alertThresholds: any;
  retentionDays: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  escalationLevel: EscalationLevel;
  notificationChannels: string[];
  cooldownMinutes: number;
  enabled: boolean;
  createdAt: Date;
}

export type EscalationLevel = 'low' | 'medium' | 'high';

// Epic 4: Pilot Support Types
export interface PilotSession {
  sessionId: string;
  tournamentId: string;
  tournamentName: string;
  organizerId: string;
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed';
  supportLevel: 'basic' | 'enhanced' | 'premium';
  features: {
    directDevSupport: boolean;
    enhancedLogging: boolean;
    realTimeFeedback: boolean;
    rapidBugReporting: boolean;
    successMetricsTracking: boolean;
    postTournamentDebrief: boolean;
  };
  supportTeam: string[];
  issues: SupportTicket[];
  feedback: FeedbackData[];
  metrics: any;
  diagnostics: SystemDiagnostics;
}

export interface TournamentContext {
  tournamentId: string;
  userId: string;
  userRole: 'organizer' | 'player' | 'spectator';
  workflow: string;
  step: string;
  rating?: number;
  comment?: string;
  issues?: string[];
  suggestions?: string[];
  usabilityScore?: number;
  performanceRating?: number;
  deviceType?: string;
  networkQuality?: string;
  appVersion?: string;
  sessionDuration?: number;
}

export interface PilotIssue {
  tournamentId: string;
  userId: string;
  title: string;
  description: string;
  reproductionSteps?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  attachments?: {
    screenshots?: string[];
    videos?: string[];
    logs?: string[];
  };
}

export interface SupportTicket {
  ticketId: string;
  tournamentId: string;
  reportedBy: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  createdAt: Date;
  updatedAt: Date;
  assignedTo?: string;
  attachments: any[];
  systemInfo?: any;
  diagnostics?: any;
  reproductionSteps: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  workaround?: string;
  resolution?: {
    summary: string;
    steps: string[];
    resolvedBy: string;
    resolvedAt: Date;
  };
  tags: string[];
}

export interface SuccessMetrics {
  tournamentId: string;
  organizerId: string;
  playerCount: number;
  completionRate: number;
  averageRating: number;
  technicalIssues: number;
  supportRequests: number;
}

export interface PilotReport {
  reportId: string;
  tournamentId: string;
  pilotSessionId: string;
  tournamentName: string;
  organizerId: string;
  duration: {
    start: Date;
    end: Date;
    totalHours: number;
  };
  successMetrics: PilotSuccessMetrics;
  feedback: {
    totalResponses: number;
    averageRating: number;
    satisfactionScore: number;
    keyInsights: string[];
    improvementAreas: string[];
  };
  issues: {
    totalReported: number;
    resolved: number;
    pending: number;
    criticalIssues: SupportTicket[];
    averageResolutionTime: number;
  };
  recommendations: string[];
  nextSteps: string[];
  generatedAt: Date;
}

export interface FeedbackData {
  id: string;
  tournamentId: string;
  userId: string;
  userRole: 'organizer' | 'player' | 'spectator';
  workflow: string;
  step: string;
  timestamp: Date;
  rating?: number;
  comment?: string;
  issues: string[];
  suggestions: string[];
  usabilityScore?: number;
  performanceRating?: number;
  context?: {
    deviceType?: string;
    networkQuality?: string;
    appVersion?: string;
    sessionDuration?: number;
  };
}

export interface SystemDiagnostics {
  loggingLevel: 'basic' | 'detailed' | 'debug';
  performanceTracking: boolean;
  errorReporting: 'basic' | 'enhanced' | 'debug';
  userInteractionTracking: boolean;
  networkMonitoring: boolean;
  deviceMetrics: boolean;
}

export interface SupportChannel {
  id: string;
  name: string;
  type: 'chat' | 'ticket' | 'call' | 'email';
  priority: 'low' | 'medium' | 'high';
  responseTime: string;
  availability: string;
}

export type IssueCategory = 'bug' | 'performance' | 'usability' | 'data' | 'network' | 'general';

export interface PilotSuccessMetrics {
  adminTimeReduction: number; // percentage
  playerSatisfactionNPS: number; // -100 to +100
  organizerEfficiencyGain: number; // percentage
  technicalIssueCount: number;
  tournamentCompletionRate: number; // percentage
  userAdoptionRate?: number; // percentage
  performanceMetrics?: any;
  feedbackScores?: any;
  supportResponseTime?: number; // minutes
}

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
export type TournamentStage =
  | 'setup'
  | 'match-scheduling'
  | 'active-play'
  | 'completed';

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
  type:
    | 'match-ready'
    | 'match-completed'
    | 'bracket-updated'
    | 'tournament-update';
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
  type:
    | 'match-start'
    | 'point-scored'
    | 'set-completed'
    | 'match-end'
    | 'timeout'
    | 'injury';
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

// Advanced Conflict Resolution Types - Epic 2B
export interface ConflictResolution {
  id: string;
  type: 'data' | 'structural' | 'permission';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  localValue: any;
  remoteValue: any;
  suggestedResolution: 'local' | 'remote' | 'merge' | 'manual';
  metadata: ConflictMetadata;
  createdAt: Timestamp;
}

export interface ConflictMetadata {
  entityType: 'tournament' | 'match' | 'player' | 'score';
  entityId: string;
  fieldPath: string;
  lastModifiedBy: {
    local: string;
    remote: string;
  };
  timestamps: {
    local: Timestamp;
    remote: Timestamp;
  };
}

export interface ConflictAnalysis {
  impact: 'low' | 'medium' | 'high';
  consequences: string[];
  recommendations: ConflictResolutionOption[];
}

export interface ConflictResolutionOption {
  id: string;
  strategy: 'local' | 'remote' | 'merge' | 'manual';
  description: string;
  pros: string[];
  cons: string[];
  confidence: number; // 0-1
}

// Enhanced Offline Service Types
export interface TournamentCache {
  id: string;
  data: Tournament;
  lastSyncAt: Timestamp;
  pendingOperations: OfflineOperation[];
}

export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'tournament' | 'match' | 'player' | 'score';
  entityId: string;
  data: any;
  timestamp: Timestamp;
  retryCount: number;
}

export interface OfflineOperationLimits {
  maxPendingOperations: number;
  maxCacheSize: number;
  syncInterval: number;
  retryLimit: number;
}

// Device Management Types
export interface DeviceInfo {
  id: string;
  name: string;
  type: 'mobile' | 'tablet' | 'desktop';
  platform: 'ios' | 'android' | 'web';
  userId: string;
  permissions: DevicePermission[];
  status: 'active' | 'inactive' | 'restricted';
  lastActiveAt: Timestamp;
  metadata: {
    appVersion: string;
    osVersion: string;
    syncCapabilities: string[];
  };
}

export interface DevicePermission {
  resource: 'tournaments' | 'matches' | 'players' | 'scores';
  actions: ('read' | 'write' | 'delete')[];
  granted: boolean;
  grantedAt: Timestamp;
  grantedBy: string;
}
