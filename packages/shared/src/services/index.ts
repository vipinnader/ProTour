// Data access layer for ProTour - Epic 1-3 Implementation

export * from './AuthService';
export * from './TournamentService';
export * from './PlayerService';
export * from './MatchService';
export * from './BracketService';
export * from './DatabaseService';
export * from './MigrationService';

// Epic 2B: Basic sync services (excluding conflicting advanced services)
export * from './SyncService';
export * from './OfflineDataService';

// Epic 3: Multi-role tournament experience
export * from './NotificationService';
export * from './PlayerTournamentService';
export * from './PlayerScheduleService';
export * from './InteractiveBracketService';
export * from './SpectatorService';
export * from './PlayerProfileService';
export * from './CrossPlatformAccessService';

// Epic 4: Indian Market Production Readiness
export * from './NetworkOptimizationService';
export * from './IndianNetworkAdapter';
export * from './SMSBackupService';
export * from './PerformanceOptimizationService';
export * from './IndianDeviceOptimizer';
export * from './ProductionMonitoringService';
export * from './PilotSupportService';

// Service instances for Epic 2B & 3
export { multiDeviceService } from './MultiDeviceService';
export { enhancedOfflineService } from './EnhancedOfflineService';
export { advancedConflictResolutionService } from './AdvancedConflictResolutionService';
