# Error Handling Strategy

Unified error handling across ProTour's fullstack architecture to ensure graceful degradation during tournament operations and clear error communication for different user roles.

## Error Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Backend API
    participant DB as Firestore
    participant NS as NotificationService
    participant L as Logger

    Note over U,L: Tournament Score Entry Error Flow
    
    U->>FE: Enter match score
    FE->>FE: Validate input locally
    
    alt Invalid input
        FE->>U: Show validation error
    else Valid input
        FE->>API: POST /matches/{id}/score
        API->>API: Authenticate & authorize
        
        alt Auth failure
            API->>FE: 401/403 with error details
            FE->>U: Show "Permission denied" message
        else Auth success
            API->>DB: Update match score
            
            alt Database error
                DB->>API: Firestore error
                API->>L: Log error with context
                API->>FE: 500 with sanitized error
                FE->>FE: Queue for offline retry
                FE->>U: Show "Saved locally, will sync"
            else Database success
                DB->>API: Success response
                API->>NS: Trigger notifications
                API->>FE: 200 with updated data
                FE->>U: Show success feedback
                
                alt Notification failure
                    NS->>L: Log notification error
                    Note over NS: Continue operation despite notification failure
                end
            end
        end
    end
```

## Error Response Format

### Standard API Error Structure
```typescript
interface ApiError {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // Human-readable error message
    details?: Record<string, any>;  // Additional error context
    timestamp: string;      // ISO timestamp
    requestId: string;      // Unique request identifier for tracking
    retryable?: boolean;    // Whether client should retry
    offlineSupported?: boolean;  // Whether operation can be queued offline
  };
}
```
