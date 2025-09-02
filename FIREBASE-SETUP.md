# Firebase Setup Guide

This guide walks you through setting up Firebase for the ProTour application across development, staging, and production environments.

## Overview

ProTour uses Firebase for:
- **Authentication** - User login and role-based access control
- **Firestore** - Real-time tournament and match data
- **Cloud Functions** - Backend logic and API endpoints
- **Storage** - File uploads (CSV imports, images)
- **Hosting** - Web dashboard (future)

## Quick Setup

### 1. Automatic Setup (Recommended)
```bash
node scripts/firebase-init.js
```

This script will:
- Install Firebase CLI if needed
- Create Firebase projects for dev/staging/prod
- Enable required services
- Deploy security rules
- Set up emulators

### 2. Manual Setup (Advanced)

If you prefer manual setup or the script fails, follow these steps:

#### Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

#### Create Projects
```bash
firebase projects:create protour-dev --display-name "ProTour Development"
firebase projects:create protour-staging --display-name "ProTour Staging"
firebase projects:create protour-prod --display-name "ProTour Production"
```

#### Configure Projects
```bash
firebase use protour-dev
firebase init firestore
firebase init functions
firebase init storage
firebase init hosting
```

## Environment Configuration

### 1. Firebase Configuration Files

The following files are automatically configured:
- `firebase.json` - Firebase project configuration
- `.firebaserc` - Project aliases
- `firestore.rules` - Database security rules
- `firestore.indexes.json` - Database indexes
- `storage.rules` - File upload security rules

### 2. Environment Variables

Copy and configure environment files:

**Mobile App (`apps/mobile/.env`)**
```bash
cp apps/mobile/.env.example apps/mobile/.env
```

**Cloud Functions (`functions/.env`)**
```bash
cp functions/.env.example functions/.env
```

Update these files with your Firebase project configuration.

### 3. Service Account Keys

For production deployments, generate service account keys:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project → Settings → Service Accounts
3. Click "Generate new private key"
4. Store the key securely (DO NOT commit to git)
5. Set environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/service-account-key.json"
   ```

## Security Rules

### Firestore Rules (`firestore.rules`)

The security rules implement:
- **Role-based access control** (admin, organizer, player)
- **Tournament ownership** verification
- **Match score** update permissions
- **Registration** access controls
- **Audit logging** protection

Key principles:
- Users can only access tournaments they're associated with
- Match scores can only be updated by tournament organizers/referees
- Public tournaments are readable by authenticated users
- Admin users have elevated permissions via custom claims

### Storage Rules (`storage.rules`)

File upload rules include:
- **CSV imports** - Only tournament organizers
- **Tournament images** - Organizers only, public read for public tournaments
- **User profiles** - Users can upload their own profile images
- **File size limits** - 10MB for CSV, 5MB for tournament images, 2MB for profiles
- **File type restrictions** - Only CSV and image files allowed

## Development Workflow

### 1. Local Development with Emulators

Start the Firebase emulators:
```bash
npm run firebase:emulator:start
```

This starts:
- **Auth Emulator** - localhost:9099
- **Firestore Emulator** - localhost:8080  
- **Functions Emulator** - localhost:5001
- **Storage Emulator** - localhost:9199
- **Emulator UI** - localhost:4000

### 2. Seed Test Data

Populate emulators with test data:
```bash
npm run firebase:emulator:seed
```

This creates:
- Test user accounts (admin, organizer, players)
- Sample tournament data
- Match and registration records
- App settings

### 3. Test Accounts

After seeding, you can use these accounts:
- **Admin**: admin@protour.app / admin123
- **Organizer**: organizer@protour.app / organizer123
- **Player 1**: player1@protour.app / player123
- **Player 2**: player2@protour.app / player123

## Deployment

### Development
```bash
firebase use protour-dev
firebase deploy
```

### Staging
```bash
firebase use protour-staging
firebase deploy
```

### Production
```bash
firebase use protour-prod
firebase deploy --only functions,firestore:rules,storage
```

⚠️ **Important**: Always test in development and staging before deploying to production.

## Project Structure

```
ProTour/
├── firebase.json              # Firebase configuration
├── .firebaserc               # Project aliases
├── firestore.rules           # Database security rules
├── firestore.indexes.json    # Database indexes
├── storage.rules             # Storage security rules
├── functions/                # Cloud Functions
│   ├── src/index.ts         # Function definitions
│   └── package.json         # Function dependencies
├── apps/mobile/src/config/   
│   └── firebase.ts          # Mobile Firebase config
└── scripts/
    ├── firebase-init.js     # Setup automation
    └── seed-emulator.js     # Test data seeding
```

## Troubleshooting

### Common Issues

**Firebase CLI not found**
```bash
npm install -g firebase-tools
```

**Permission denied errors**
```bash
firebase login --reauth
```

**Emulator connection issues**
- Check that ports 4000, 5001, 8080, 9099, 9199 are available
- Try restarting emulators: `firebase emulators:start --import=./emulator-data`

**Firestore rules deployment fails**
- Validate rules syntax: `firebase firestore:rules:get`
- Check for index requirements: `firebase firestore:indexes`

**Functions deployment timeout**
- Increase timeout: `firebase functions:config:set runtime.timeout=540`
- Check function logs: `firebase functions:log`

### Debug Commands

```bash
# Check Firebase CLI version
firebase --version

# List available projects
firebase projects:list

# Check current project
firebase use

# Validate Firestore rules
firebase firestore:rules:get

# Check function logs
firebase functions:log

# Export emulator data
firebase emulators:export ./emulator-backup
```

## Monitoring & Maintenance

### Performance Monitoring
- Enable Firebase Performance Monitoring in console
- Add performance tracing to critical user flows
- Monitor function execution times and cold starts

### Security Monitoring
- Review Firestore security rules regularly
- Monitor authentication logs for suspicious activity
- Set up alerts for function errors

### Cost Monitoring
- Set up billing alerts in Firebase Console
- Monitor Firestore read/write operations
- Review Cloud Function invocations

## Best Practices

### Security
- Never commit service account keys to version control
- Use environment variables for sensitive configuration
- Regularly review and update security rules
- Enable Firebase App Check for production

### Performance
- Use Firestore offline persistence
- Implement proper pagination for large datasets
- Cache frequently accessed data
- Optimize Cloud Function cold starts

### Maintenance
- Regular security rule audits
- Monitor and optimize Firestore indexes
- Keep Firebase SDKs updated
- Backup production data regularly

## Support

For Firebase-specific issues:
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Support](https://support.google.com/firebase)
- [Firebase Community](https://firebase.googleblog.com/)

For ProTour-specific issues:
- Check project documentation in `docs/`
- Review security rules in `firestore.rules`
- Test with emulators before deploying