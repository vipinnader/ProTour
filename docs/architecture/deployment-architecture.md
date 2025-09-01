# Deployment Architecture

Deployment strategy optimized for ProTour's Firebase-based serverless architecture with React Native mobile apps, emphasizing reliable Indian market deployment and staging validation.

## Deployment Strategy

**Frontend Deployment:**
- **Platform:** React Native with separate iOS App Store and Google Play Store distributions
- **Build Command:** `nx build mobile --configuration=production`
- **Output Directory:** `dist/apps/mobile/` with platform-specific bundles
- **CDN/Edge:** Native app distribution through official app stores, no CDN required for mobile binaries

**Backend Deployment:**
- **Platform:** Firebase Functions deployed to asia-south1 (Mumbai) region
- **Build Command:** `nx build functions --configuration=production`
- **Deployment Method:** Firebase CLI with automated deployment pipeline

**Database and Storage:**
- **Platform:** Firestore and Firebase Storage in asia-south1 region
- **Backup Strategy:** Automated daily backups with 30-day retention
- **Migration Strategy:** Firestore data migrations through Firebase Functions

## CI/CD Pipeline

```yaml
# .github/workflows/ci-cd-production.yml
name: Production Deployment

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  FIREBASE_PROJECT_ID: protour-prod
  FIREBASE_REGION: asia-south1
  NODE_VERSION: '18'

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: nx run-many --target=lint --all

      - name: Run tests with coverage
        run: nx run-many --target=test --all --coverage
        
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          directory: ./coverage

      - name: Build all applications
        run: nx run-many --target=build --all --configuration=production

      - name: Security vulnerability scan
        run: npm audit --audit-level=high

  deploy-backend:
    needs: test-and-build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Authenticate with Firebase
        run: echo "${{ secrets.FIREBASE_SERVICE_ACCOUNT }}" | base64 -d > service-account.json
        
      - name: Set Firebase project
        run: firebase use ${{ env.FIREBASE_PROJECT_ID }} --token "${{ secrets.FIREBASE_TOKEN }}"

      - name: Deploy Firestore rules and indexes
        run: firebase deploy --only firestore:rules,firestore:indexes --token "${{ secrets.FIREBASE_TOKEN }}"

      - name: Deploy Functions
        run: firebase deploy --only functions --token "${{ secrets.FIREBASE_TOKEN }}"

      - name: Run post-deployment smoke tests
        run: |
          npm install -g newman
          newman run tests/api/tournament-api.postman_collection.json \
            --env-var "base_url=https://asia-south1-${{ env.FIREBASE_PROJECT_ID }}.cloudfunctions.net/api"

  deploy-mobile:
    needs: test-and-build
    runs-on: macos-latest
    environment: production
    strategy:
      matrix:
        platform: [ios, android]
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Setup Java (Android)
        if: matrix.platform == 'android'
        uses: actions/setup-java@v3
        with:
          distribution: 'temurin'
          java-version: '11'

      - name: Setup Android SDK
        if: matrix.platform == 'android'
        uses: android-actions/setup-android@v2

      - name: Setup Xcode (iOS)
        if: matrix.platform == 'ios'
        uses: maxim-lobanov/setup-xcode@v1
        with:
          xcode-version: 'latest-stable'

      - name: Install CocoaPods (iOS)
        if: matrix.platform == 'ios'
        run: |
          cd apps/mobile/ios
          pod install

      - name: Build Android APK
        if: matrix.platform == 'android'
        run: |
          cd apps/mobile/android
          ./gradlew assembleRelease
          
      - name: Sign Android APK
        if: matrix.platform == 'android'
        uses: r0adkll/sign-android-release@v1
        with:
          releaseDirectory: apps/mobile/android/app/build/outputs/apk/release
          signingKeyBase64: ${{ secrets.ANDROID_SIGNING_KEY }}
          alias: ${{ secrets.ANDROID_KEY_ALIAS }}
          keyStorePassword: ${{ secrets.ANDROID_KEYSTORE_PASSWORD }}

      - name: Build iOS IPA
        if: matrix.platform == 'ios'
        run: |
          cd apps/mobile/ios
          xcodebuild -workspace ProTour.xcworkspace \
                     -scheme ProTour \
                     -configuration Release \
                     -destination generic/platform=iOS \
                     -archivePath ProTour.xcarchive \
                     archive
          
      - name: Upload to App Store Connect (iOS)
        if: matrix.platform == 'ios'
        env:
          APP_STORE_CONNECT_API_KEY: ${{ secrets.APP_STORE_CONNECT_API_KEY }}
        run: |
          xcrun altool --upload-app \
                      --type ios \
                      --file "apps/mobile/ios/ProTour.ipa" \
                      --apiKey "$APP_STORE_CONNECT_API_KEY"

      - name: Upload to Google Play Console (Android)
        if: matrix.platform == 'android'
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT }}
          packageName: com.protour.tournament
          releaseFiles: apps/mobile/android/app/build/outputs/apk/release/*.apk
          track: production

  post-deployment-validation:
    needs: [deploy-backend, deploy-mobile]
    runs-on: ubuntu-latest
    steps:
      - name: Health check API endpoints
        run: |
          curl -f "https://asia-south1-${{ env.FIREBASE_PROJECT_ID }}.cloudfunctions.net/api/health" || exit 1
          
      - name: Validate Firestore connectivity
        run: |
          # Run integration tests against production Firestore
          npm run test:integration:production
          
      - name: Send deployment notification
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          channel: '#deployments'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}

  rollback-on-failure:
    needs: [deploy-backend, deploy-mobile]
    runs-on: ubuntu-latest
    if: failure()
    steps:
      - name: Rollback Firebase Functions
        run: |
          firebase functions:config:clone --from=${{ env.FIREBASE_PROJECT_ID }} --except=firebase.json
          firebase deploy --only functions --token "${{ secrets.FIREBASE_TOKEN }}" --force
```

## Environment Configuration

| Environment | Frontend URL | Backend URL | Purpose | Deployment Trigger |
|-------------|--------------|-------------|---------|------------------|
| Development | `localhost:8081` | `localhost:5001/protour-dev/us-central1/api` | Local development and testing | Manual developer setup |
| Staging | TestFlight/Play Internal | `https://asia-south1-protour-staging.cloudfunctions.net/api` | Pre-production validation and QA testing | Push to `develop` branch |
| Production | App Store/Play Store | `https://asia-south1-protour-prod.cloudfunctions.net/api` | Live tournament operations | Push to `main` branch with approval |

## Deployment Security and Monitoring

**Security Measures:**
- **Firebase Security Rules:** Comprehensive Firestore and Storage security rules validated in CI/CD
- **API Authentication:** All production endpoints require Firebase Auth JWT tokens
- **Secrets Management:** GitHub Secrets for all sensitive configuration, no secrets in code
- **Network Security:** Firebase Functions deployed with VPC connector for secure external API access
- **SSL/TLS:** All endpoints use HTTPS with automatic certificate management

**Monitoring and Alerting:**
- **Firebase Crashlytics:** Real-time crash reporting for mobile apps with automatic grouping
- **Cloud Monitoring:** Function performance metrics with automated alerting for response time degradation
- **Error Tracking:** Structured logging with automated error categorization and notification
- **Health Checks:** Automated endpoint monitoring with Slack notifications for outages

**Rollback Procedures:**
- **Functions Rollback:** Firebase Functions maintain previous version for instant rollback capability
- **Mobile App Rollback:** Emergency app store removal procedures and previous version restoration
- **Database Rollback:** Point-in-time Firestore backup restoration with data consistency validation
- **Configuration Rollback:** Infrastructure as code enables rapid configuration reversion

## Indian Market Deployment Optimizations

**Performance Optimizations:**
- **Regional Deployment:** All services deployed to asia-south1 (Mumbai) for optimal Indian latency
- **CDN Integration:** Firebase Hosting with Indian edge locations for static assets
- **Mobile Optimization:** APK optimization for slower Android devices common in Indian market
- **Bandwidth Optimization:** Compressed API responses and optimized mobile bundle sizes

**Compliance and Localization:**
- **Data Residency:** All user data stored in Indian Firebase region for regulatory compliance
- **SMS Integration:** Production SMS services configured for Indian mobile networks
- **Payment Gateway Readiness:** Infrastructure prepared for future Razorpay/PayU integration
- **Language Support:** i18n infrastructure for future Hindi/regional language support
