#!/usr/bin/env node

// Simple test to verify TypeScript configuration
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing TypeScript configuration...\n');

// Check root tsconfig.json
const rootTsConfig = path.join(__dirname, 'tsconfig.json');
if (fs.existsSync(rootTsConfig)) {
  try {
    const config = JSON.parse(fs.readFileSync(rootTsConfig, 'utf8'));
    console.log('✅ Root tsconfig.json is valid JSON');

    // Check composite settings
    if (
      config.compilerOptions?.composite === true &&
      config.compilerOptions?.noEmit === false
    ) {
      console.log('✅ Composite project settings are correct');
    } else {
      console.log('⚠️  Composite project settings may need adjustment');
    }

    // Check references
    if (config.references && Array.isArray(config.references)) {
      console.log(`✅ Found ${config.references.length} project references`);

      // Verify referenced projects exist
      for (const ref of config.references) {
        const refPath = path.join(__dirname, ref.path, 'tsconfig.json');
        if (fs.existsSync(refPath)) {
          console.log(`  ✅ ${ref.path}/tsconfig.json exists`);
        } else {
          console.log(`  ❌ ${ref.path}/tsconfig.json missing`);
        }
      }
    }
  } catch (error) {
    console.log('❌ Root tsconfig.json has JSON syntax errors:', error.message);
  }
} else {
  console.log('❌ Root tsconfig.json not found');
}

// Check shared package tsconfig.json
const sharedTsConfig = path.join(__dirname, 'packages/shared/tsconfig.json');
if (fs.existsSync(sharedTsConfig)) {
  try {
    const config = JSON.parse(fs.readFileSync(sharedTsConfig, 'utf8'));
    console.log('✅ Shared package tsconfig.json is valid JSON');

    if (config.compilerOptions?.composite === true) {
      console.log('✅ Shared package is properly configured as composite');
    }
  } catch (error) {
    console.log(
      '❌ Shared package tsconfig.json has JSON syntax errors:',
      error.message
    );
  }
} else {
  console.log('❌ Shared package tsconfig.json not found');
}

console.log('\n🎉 TypeScript configuration test complete!');
console.log(
  '💡 To test compilation: npx tsc --build (after installing dependencies)'
);
