// Security module exports - Core modules (no external dependencies)
export * from './encryption';
export * from './auditLogging';
export * from './privacy';
export * from './auth-standalone';
export * from './validation-standalone';

// Advanced modules (require external dependencies)
// To use these, install the required dependencies:
// npm install express jsonwebtoken bcrypt validator cors multer sharp isomorphic-dompurify
// Then uncomment the exports below:

// export * from './authentication';
// export * from './authorization'; 
// export * from './headers';
// export * from './validation';
// export * from './monitoring';
// export * from './sessionManager';
// export * from './rbac';
// export * from './incidentResponse';
// export * from './fileUpload';
// export * from './testing';