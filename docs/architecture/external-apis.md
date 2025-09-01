# External APIs

Based on the PRD requirements and component design, ProTour integrates with several external services to enable SMS notifications, push notifications, and file processing capabilities essential for Indian market deployment.

## MSG91 SMS API

- **Purpose:** Primary SMS notification service for tournament updates when push notifications fail or data connectivity is limited
- **Documentation:** https://docs.msg91.com/p/tf9GTextBhKBLViio4P3ug/e/Er7vlG37O_IZfvbGPwRyaw
- **Base URL(s):** https://api.msg91.com/api/v5/
- **Authentication:** API key-based authentication with template-based messaging
- **Rate Limits:** 100 SMS per second, 10,000 per day on starter plan

**Key Endpoints Used:**
- `POST /flow/` - Send template-based SMS for tournament notifications
- `GET /report/{request_id}` - Check SMS delivery status for audit trails
- `POST /validate/mobile` - Validate Indian mobile numbers before sending

**Integration Notes:** 
- Template IDs pre-configured for match notifications, tournament updates, and emergency broadcasts
- Automatic retry logic for failed SMS with exponential backoff
- Cost optimization through message batching and duplicate detection
- Integration with tournament notification preferences for opt-out management

## Twilio SMS API (Fallback)

- **Purpose:** Secondary SMS provider for redundancy and improved delivery rates in rural Indian areas
- **Documentation:** https://www.twilio.com/docs/sms
- **Base URL(s):** https://api.twilio.com/2010-04-01/
- **Authentication:** Account SID and Auth Token with request signing
- **Rate Limits:** 1 message per second per phone number, higher limits available

**Key Endpoints Used:**
- `POST /Accounts/{AccountSid}/Messages.json` - Send SMS messages with status tracking
- `GET /Accounts/{AccountSid}/Messages/{MessageSid}.json` - Message delivery status

**Integration Notes:**
- Automatic failover when MSG91 experiences delivery issues or rate limits
- Geographic routing optimization for better delivery in specific Indian regions
- Cost-per-message tracking for budget management and service optimization

## Firebase Cloud Messaging (FCM)

- **Purpose:** Primary push notification service for real-time tournament updates across iOS and Android
- **Documentation:** https://firebase.google.com/docs/cloud-messaging
- **Base URL(s):** https://fcm.googleapis.com/v1/projects/{project-id}/messages:send
- **Authentication:** Firebase Admin SDK service account authentication
- **Rate Limits:** No explicit limits, auto-scaling with Firebase infrastructure

**Key Endpoints Used:**
- `POST /v1/projects/{project-id}/messages:send` - Send targeted push notifications
- `POST /v1/projects/{project-id}/messages:send` - Send topic-based broadcasts

**Integration Notes:**
- Topic subscriptions for tournament-specific notifications (tournament_{tournamentId})
- Custom data payloads for deep linking to specific matches or bracket views
- Silent notifications for background data sync when app is closed
- Platform-specific notification formatting (iOS badges, Android priority levels)

## Firebase Storage API

- **Purpose:** CSV file upload and processing for player import functionality
- **Documentation:** https://firebase.google.com/docs/storage
- **Base URL(s):** Integrated via Firebase Admin SDK
- **Authentication:** Firebase Admin SDK with custom security rules
- **Rate Limits:** 5,000 operations per second, 50 TB transfer per day

**Key Endpoints Used:**
- Upload operations via Firebase Admin SDK for CSV file processing
- Download operations for tournament export functionality
- Metadata operations for file validation and virus scanning

**Integration Notes:**
- Automatic file cleanup after successful CSV processing to manage storage costs
- Security rules preventing access to other organizers' uploaded files
- File size limits (2MB) and format validation (.csv, .txt only) for security
- Virus scanning integration through Cloud Security Scanner for uploaded files

## Firebase Auth API

- **Purpose:** User authentication, role management, and custom claims for tournament access control
- **Documentation:** https://firebase.google.com/docs/auth/admin
- **Base URL(s):** Integrated via Firebase Admin SDK and client SDKs
- **Authentication:** Firebase project configuration with API keys
- **Rate Limits:** 100 requests per second for admin operations

**Key Endpoints Used:**
- User creation and management via Admin SDK
- Custom claims assignment for organizer/referee/player roles
- Session management and token refresh operations

**Integration Notes:**
- Custom claims updated when organizers create delegation tokens for referees
- Anonymous authentication support for spectator access without account creation
- Email verification required for organizer accounts to prevent spam tournaments
- Integration with tournament access codes for seamless participant onboarding
