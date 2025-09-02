# ProTour Shared Package Setup

## Dependency Installation Issues

The security modules require external dependencies that are currently not installed due to npm permission conflicts. Here's how to resolve this:

### Option 1: Fix npm permissions (Recommended)
```bash
# Fix npm cache permissions
sudo chown -R $(whoami) ~/.npm

# Clear npm cache
npm cache clean --force

# Install dependencies
npm install --legacy-peer-deps
```

### Option 2: Use standalone security modules (Current approach)
The package currently exports standalone security modules that don't require external dependencies:

- `encryption.ts` - Data encryption utilities
- `auditLogging.ts` - Audit logging framework  
- `privacy.ts` - GDPR compliance framework
- `auth-standalone.ts` - Basic authentication utilities
- `validation-standalone.ts` - Input validation without external deps

### Option 3: Install dependencies manually
```bash
# Core security dependencies
npm install jsonwebtoken bcrypt validator isomorphic-dompurify

# Web framework dependencies  
npm install express cors multer

# Image processing
npm install sharp

# Type definitions
npm install --save-dev @types/express @types/cors @types/multer @types/bcrypt @types/jsonwebtoken @types/validator
```

## Current Package Structure

```
src/
├── security/           # Security modules
│   ├── index.ts       # Main security exports
│   ├── encryption.ts  # Data encryption (✓ No deps)
│   ├── auditLogging.ts # Audit logging (✓ No deps)
│   ├── privacy.ts     # GDPR compliance (✓ No deps)
│   ├── auth-standalone.ts # Basic auth (✓ No deps)
│   ├── validation-standalone.ts # Input validation (✓ No deps)
│   └── [advanced-modules] # Require external deps
├── types/             # TypeScript type definitions
├── utils/             # Utility functions  
├── constants/         # Application constants
└── index.ts          # Main package export
```

## Usage

### Core Security (Available Now)
```typescript
import { 
  EncryptionManager, 
  AuditLogger, 
  PrivacyManager,
  BasicAuthManager,
  BasicInputValidator 
} from '@protour/shared';

// Use encryption
const encryption = new EncryptionManager();
const encrypted = encryption.encrypt('sensitive data');

// Use validation
const validator = new BasicInputValidator();
const result = validator.validate(data, rules);
```

### Advanced Security (After installing dependencies)
Uncomment the exports in `src/security/index.ts` after installing dependencies to access:

- JWT authentication with refresh tokens
- Role-based access control (RBAC)
- Security headers and CORS
- File upload security
- Vulnerability scanning
- Incident response
- Security testing framework

## Testing Compilation

After resolving dependencies:

```bash
# Test compilation
npm run build

# Run tests  
npm test

# Type checking
npm run type-check

# Linting
npm run lint
```