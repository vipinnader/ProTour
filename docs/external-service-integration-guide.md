# External Service Integration Guide

This document provides step-by-step procedures for setting up all external services required for ProTour, addressing the integration gaps identified in the PO Master Checklist validation.

---

## 🔥 Firebase Setup (CRITICAL - Required for Epic 1)

### Step 1: Firebase Project Creation

**Prerequisites:** Google account with Firebase access

**Procedure:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Create a project" or "Add project"
3. Enter project name: `protour-prod` (production) and `protour-staging` (staging)
4. **Important:** Choose "India" as the default GCP resource location for Indian market optimization
5. Enable Google Analytics (recommended for user behavior insights)
6. Wait for project creation to complete

### Step 2: Firebase Authentication Setup

**Authentication Providers:**
```bash
# Enable Email/Password authentication
1. Go to Firebase Console → Authentication → Sign-in method
2. Click "Email/Password" and enable it
3. Enable "Email link (passwordless sign-in)" for future password reset functionality
4. Configure authorized domains (add your app domains)
```

**Configuration for Development:**
```typescript
// firebase-config.ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "protour-staging.firebaseapp.com", 
  projectId: "protour-staging",
  storageBucket: "protour-staging.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
}
```

### Step 3: Firestore Database Setup

**Database Creation:**
1. Firebase Console → Firestore Database → "Create database"
2. **Choose "Start in test mode"** (we'll configure security rules later)
3. Select location: `asia-south1` (Mumbai) for Indian market
4. Wait for database creation

**Initial Security Rules:**
```javascript
// firestore.rules - TEMPORARY (replace with proper rules)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Temporary: Allow authenticated users full access
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Production Security Rules (implement in Epic 1):**
```javascript
// firestore.rules - PRODUCTION
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Tournament access based on organizer ownership
    match /tournaments/{tournamentId} {
      allow read: if true; // Public tournaments readable
      allow write: if request.auth.uid == resource.data.organizerId;
    }
    
    // Players can only be modified by tournament organizer
    match /tournaments/{tournamentId}/players/{playerId} {
      allow read: if true;
      allow write: if request.auth.uid == get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId;
    }
    
    // Matches follow same pattern as players
    match /tournaments/{tournamentId}/matches/{matchId} {
      allow read: if true;
      allow write: if request.auth.uid == get(/databases/$(database)/documents/tournaments/$(tournamentId)).data.organizerId;
    }
  }
}
```

### Step 4: Firebase Cloud Functions Setup

**Functions Initialization:**
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize functions in your project
cd /path/to/protour
firebase init functions

# Choose TypeScript, ESLint, install dependencies
```

**Basic Function Structure:**
```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

// Tournament bracket generation function
export const generateBracket = functions.firestore
  .document('tournaments/{tournamentId}')
  .onUpdate(async (change, context) => {
    const tournament = change.after.data();
    
    if (tournament.status === 'ready-for-bracket') {
      // Implement bracket generation logic
      const bracket = generateTournamentBracket(tournament);
      
      // Update tournament with bracket
      await change.after.ref.update({
        bracket: bracket,
        status: 'bracket-generated'
      });
    }
  });
```

### Step 5: Firebase Storage Setup

**Storage Configuration:**
1. Firebase Console → Storage → Get started
2. Choose "Start in test mode"
3. Select location: `asia-south1` (Mumbai)

**Storage Rules for CSV Uploads:**
```javascript
// storage.rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Only tournament organizers can upload CSV files
    match /tournaments/{tournamentId}/csv/{fileName} {
      allow read, write: if request.auth != null 
        && request.auth.uid == getUserRole(tournamentId, 'organizer');
    }
  }
}
```

---

## 📱 Mobile App Store Setup

### Apple App Store Connect

**Prerequisites:**
- Apple Developer Program membership ($99/year)
- Valid Apple ID

**Step-by-Step Setup:**
1. **Join Apple Developer Program:**
   - Go to [developer.apple.com](https://developer.apple.com/programs/)
   - Enroll as Individual or Organization
   - Pay annual fee and wait for approval

2. **Create App Store Connect App:**
   ```bash
   # App Information
   App Name: ProTour - Tournament Manager
   Bundle ID: com.protour.tournament-manager
   Primary Language: English (India)
   SKU: protour-tournament-2024
   ```

3. **App Store Information:**
   ```
   Category: Sports
   Sub-Category: Other Sports
   Content Rating: 4+ (suitable for all ages)
   Copyright: © 2024 ProTour Team
   ```

4. **Prepare App Store Assets:**
   ```
   App Icon: 1024x1024px PNG
   Screenshots: 
   - iPhone: 6.7", 6.5", 5.5" displays
   - iPad: 12.9" and 11" displays
   Keywords: tournament, badminton, tennis, sports, bracket, manager
   ```

**iOS Build Configuration:**
```xml
<!-- ios/ProTour/Info.plist -->
<key>CFBundleIdentifier</key>
<string>com.protour.tournament-manager</string>
<key>CFBundleDisplayName</key>
<string>ProTour</string>
<key>CFBundleVersion</key>
<string>1.0.0</string>
```

### Google Play Console

**Prerequisites:**
- Google Developer Account ($25 one-time fee)

**Setup Process:**
1. **Create Developer Account:**
   - Go to [play.google.com/console](https://play.google.com/console)
   - Pay $25 registration fee
   - Complete identity verification

2. **Create New App:**
   ```
   App Name: ProTour - Tournament Manager
   Package Name: com.protour.tournamentmanager
   Default Language: English (India)
   App Type: App
   ```

3. **Play Console Configuration:**
   ```
   Category: Sports
   Content Rating: Everyone
   Target Audience: Ages 13+
   Country: India (primary market)
   ```

4. **Required Assets:**
   ```
   High-res icon: 512x512px PNG
   Feature graphic: 1024x500px JPG/PNG
   Screenshots: Phone, 7-inch tablet, 10-inch tablet
   ```

**Android Build Configuration:**
```gradle
// android/app/build.gradle
android {
    compileSdkVersion 33
    defaultConfig {
        applicationId "com.protour.tournamentmanager"
        minSdkVersion 21  // Android 5.0+ for broader compatibility
        targetSdkVersion 33
        versionCode 1
        versionName "1.0.0"
    }
}
```

---

## 📱 Push Notifications (Firebase Cloud Messaging)

### Firebase Cloud Messaging Setup

**FCM Configuration:**
1. Firebase Console → Project Settings → Cloud Messaging
2. Generate new private key for service account
3. Download `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)

**React Native Configuration:**
```bash
# Install React Native Firebase
npm install @react-native-firebase/app @react-native-firebase/messaging

# iOS specific setup
cd ios && pod install
```

**Push Notification Service:**
```typescript
// services/NotificationService.ts
import messaging from '@react-native-firebase/messaging';

class NotificationService {
  async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    return authStatus === messaging.AuthorizationStatus.AUTHORIZED;
  }
  
  async getToken(): Promise<string> {
    return await messaging().getToken();
  }
  
  async sendMatchNotification(playerId: string, matchInfo: any) {
    // Implementation for match notifications
    const message = {
      token: await this.getPlayerToken(playerId),
      notification: {
        title: 'Match Ready!',
        body: `Your match vs ${matchInfo.opponent} is about to start`
      },
      data: {
        tournamentId: matchInfo.tournamentId,
        matchId: matchInfo.matchId
      }
    };
    
    return await admin.messaging().send(message);
  }
}
```

---

## 📞 SMS Integration (Indian Market)

### Option 1: Twilio (Recommended)

**Account Setup:**
1. Go to [twilio.com](https://twilio.com) and create account
2. Verify phone number and add credit ($20 minimum)
3. Get Account SID and Auth Token from console

**India-Specific Configuration:**
```typescript
// services/SMSService.ts
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

class SMSService {
  async sendMatchAlert(phoneNumber: string, tournamentName: string, opponent: string) {
    try {
      const message = await client.messages.create({
        body: `ProTour Alert: Your match vs ${opponent} in ${tournamentName} is starting soon. Check the app for details.`,
        from: '+1234567890', // Your Twilio number
        to: phoneNumber // Must be in +91XXXXXXXXXX format for India
      });
      
      return message.sid;
    } catch (error) {
      console.error('SMS failed:', error);
      throw error;
    }
  }
  
  async sendTournamentUpdate(phoneNumbers: string[], message: string) {
    const promises = phoneNumbers.map(phone => 
      client.messages.create({
        body: `ProTour: ${message}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phone
      })
    );
    
    return Promise.allSettled(promises);
  }
}
```

**Cost Estimation (India):**
- SMS cost: ~₹0.50-1.00 per SMS
- Monthly tournament (50 players, 20 SMS each): ₹500-1000

### Option 2: MSG91 (India-Focused Alternative)

**MSG91 Setup:**
```typescript
// Alternative SMS service for better India rates
import axios from 'axios';

class MSG91Service {
  private apiKey = process.env.MSG91_API_KEY;
  private senderId = 'PROTOUR'; // 6-character sender ID
  
  async sendSMS(phoneNumber: string, message: string) {
    const response = await axios.post('https://api.msg91.com/api/sendhttp.php', {
      authkey: this.apiKey,
      mobiles: phoneNumber.replace('+91', ''), // Remove country code
      message: message,
      sender: this.senderId,
      route: 4, // Transactional route
      country: 91 // India country code
    });
    
    return response.data;
  }
}
```

---

## 💳 Payment Gateway Integration (Post-MVP)

### Razorpay Setup (Primary Choice for India)

**Account Creation:**
1. Go to [razorpay.com](https://razorpay.com) and sign up
2. Complete KYC verification (required in India)
3. Get API keys from dashboard

**Integration Preparation:**
```typescript
// services/PaymentService.ts (for future implementation)
import Razorpay from 'razorpay';

class PaymentService {
  private razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
  
  async createTournamentOrder(tournamentId: string, amount: number) {
    const order = await this.razorpay.orders.create({
      amount: amount * 100, // Amount in paise
      currency: 'INR',
      receipt: `tournament_${tournamentId}_${Date.now()}`,
      notes: {
        tournament_id: tournamentId
      }
    });
    
    return order;
  }
}
```

**Pricing Structure (India):**
- Transaction fee: 2% + ₹2 per transaction
- Settlement: T+2 days to bank account
- No setup fee or monthly charges

---

## 📊 Analytics & Monitoring

### Firebase Analytics Setup

**Configuration:**
```typescript
// services/AnalyticsService.ts
import analytics from '@react-native-firebase/analytics';

class AnalyticsService {
  async trackTournamentCreation(tournamentType: string) {
    await analytics().logEvent('tournament_created', {
      tournament_type: tournamentType,
      timestamp: Date.now()
    });
  }
  
  async trackMatchCompletion(tournamentId: string, matchDuration: number) {
    await analytics().logEvent('match_completed', {
      tournament_id: tournamentId,
      duration_minutes: matchDuration,
      timestamp: Date.now()
    });
  }
}
```

### Crashlytics Setup

**Installation:**
```bash
npm install @react-native-firebase/crashlytics
```

**Configuration:**
```typescript
// App.tsx
import crashlytics from '@react-native-firebase/crashlytics';

// Enable crash reporting
crashlytics().log('ProTour app started');

// Set user attributes for better crash debugging
crashlytics().setUserId(user.id);
crashlytics().setAttributes({
  role: user.role,
  tournaments_created: user.tournamentCount.toString()
});
```

---

## 🔐 Security Services

### SSL Certificate Setup

**For Web Dashboard (Future):**
1. Use Let's Encrypt for free SSL certificates
2. Configure auto-renewal with certbot
3. Implement HTTP to HTTPS redirects

**Firebase Hosting (Automatic SSL):**
```bash
# Initialize hosting
firebase init hosting

# Deploy with automatic SSL
firebase deploy --only hosting
```

### Environment Variables Management

**Development Environment:**
```bash
# .env.development
FIREBASE_API_KEY=your_dev_api_key
FIREBASE_PROJECT_ID=protour-staging
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
SMS_FALLBACK_ENABLED=true
ANALYTICS_ENABLED=false
```

**Production Environment:**
```bash
# .env.production
FIREBASE_API_KEY=your_prod_api_key
FIREBASE_PROJECT_ID=protour-prod
TWILIO_ACCOUNT_SID=your_prod_twilio_sid
TWILIO_AUTH_TOKEN=your_prod_twilio_token
SMS_FALLBACK_ENABLED=true
ANALYTICS_ENABLED=true
CRASHLYTICS_ENABLED=true
```

---

## 🚀 CI/CD Integration Setup

### GitHub Secrets Configuration

**Required Secrets:**
```bash
# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY  # JSON key for service account
FIREBASE_PROJECT_ID

# App Store
APPLE_API_KEY_ID
APPLE_ISSUER_ID  
APPLE_API_PRIVATE_KEY

# Google Play
GOOGLE_PLAY_SERVICE_ACCOUNT  # JSON key
PLAY_STORE_JSON_KEY

# External Services
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
```

### Deployment Scripts

**Automated Deployment:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy Firebase Functions
        run: |
          npm ci
          firebase use production
          firebase deploy --only functions
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}

  deploy-mobile:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and deploy to TestFlight
        run: |
          cd ios
          xcodebuild -workspace ProTour.xcworkspace -scheme ProTour archive
          # Upload to TestFlight using fastlane
        env:
          APPLE_API_KEY: ${{ secrets.APPLE_API_KEY }}
```

---

## 📋 Integration Checklist

### Pre-Development Setup (Epic 0)
- [ ] Firebase project created and configured
- [ ] Authentication providers enabled
- [ ] Firestore database created with initial security rules
- [ ] Cloud Functions initialized
- [ ] Firebase Storage configured
- [ ] Push notifications configured
- [ ] App Store Connect app created
- [ ] Google Play Console app created
- [ ] SMS service account created and tested
- [ ] Analytics and Crashlytics enabled
- [ ] Environment variables configured
- [ ] CI/CD secrets added to GitHub

### Development Phase Integration
- [ ] Firebase emulators running locally
- [ ] Test SMS messages sending successfully
- [ ] Push notifications working on test devices
- [ ] Analytics events tracking correctly
- [ ] Crash reporting capturing test crashes
- [ ] All services accessible from development environment

### Pre-Production Validation
- [ ] Production Firebase security rules tested
- [ ] SMS service working with Indian phone numbers
- [ ] Push notifications delivered reliably
- [ ] App store builds generating successfully
- [ ] Analytics showing meaningful data
- [ ] Monitoring and alerting configured

### Cost Monitoring Setup
- [ ] Firebase billing alerts configured
- [ ] SMS usage monitoring set up
- [ ] App store fees tracked
- [ ] Monthly service cost projections documented

---

## 💰 Cost Estimates (Monthly, 100 Active Users)

| Service | Cost (INR) | Notes |
|---------|------------|--------|
| Firebase (Spark Plan) | ₹0 | Free tier adequate for MVP |
| Firebase (Blaze Plan) | ₹1000-2000 | When scaling beyond free limits |
| Twilio SMS | ₹1000-2000 | ~20 SMS per user per month |
| Apple Developer | ₹825 | ₹9900/year ÷ 12 months |
| Google Play | ₹21 | ₹2500 one-time ÷ 120 months |
| **Total MVP** | **₹2846-4846** | **Per month for 100 users** |

**Scaling Estimates (1000 Active Users):**
- Firebase: ₹5000-10000
- SMS: ₹10000-20000  
- Total: ₹15846-30846 per month

---

This comprehensive integration guide ensures all external services are properly configured before development begins, addressing the critical gaps identified in the PO validation.