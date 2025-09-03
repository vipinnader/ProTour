#!/usr/bin/env node

// Validation script for TypeScript configuration
const fs = require('fs');
const path = require('path');

console.log(
  '🔧 Validating TypeScript configuration for composite project issues...\n'
);

const rootTsConfig = path.join(__dirname, 'tsconfig.json');
const config = JSON.parse(fs.readFileSync(rootTsConfig, 'utf8'));

// Check for the specific issues that were causing problems
const issues = [];

// Issue 1: Check if this is a solution file (references only) or composite project
const hasReferences = config.references && config.references.length > 0;
const hasSourceFiles =
  (config.files && config.files.length > 0) ||
  (config.include && config.include.length > 0);

console.log(`📁 Has references: ${hasReferences}`);
console.log(`📄 Has source files: ${hasSourceFiles}`);

if (hasReferences && !hasSourceFiles) {
  console.log('✅ Configuration type: Solution file (references only)');

  // For solution files, these options should not be present or should be false
  if (config.compilerOptions?.composite === true) {
    issues.push('Solution files should not have composite: true');
  }

  if (config.compilerOptions?.declaration === true) {
    issues.push('Solution files should not have declaration: true');
  }

  if (config.compilerOptions?.noEmit === false) {
    issues.push(
      'Solution files should not have noEmit: false (or should omit noEmit)'
    );
  }
} else if (hasSourceFiles) {
  console.log('✅ Configuration type: Composite project');

  // For composite projects with source files
  if (config.compilerOptions?.composite !== true) {
    issues.push(
      'Composite projects with source files must have composite: true'
    );
  }

  if (config.compilerOptions?.declaration !== true) {
    issues.push('Composite projects must have declaration: true');
  }

  if (config.compilerOptions?.noEmit !== false) {
    issues.push('Composite projects must have noEmit: false');
  }
}

// Check referenced projects
if (hasReferences) {
  for (const ref of config.references) {
    const refConfigPath = path.join(__dirname, ref.path, 'tsconfig.json');
    if (fs.existsSync(refConfigPath)) {
      const refConfig = JSON.parse(fs.readFileSync(refConfigPath, 'utf8'));
      if (refConfig.compilerOptions?.composite !== true) {
        issues.push(
          `Referenced project ${ref.path} should have composite: true`
        );
      }
    }
  }
}

// Report results
if (issues.length === 0) {
  console.log(
    '\n✅ No TypeScript composite project configuration issues found!'
  );
  console.log('🎉 The configuration should work without errors.');
} else {
  console.log('\n⚠️  Found configuration issues:');
  issues.forEach((issue, index) => {
    console.log(`   ${index + 1}. ${issue}`);
  });
}

console.log('\n📋 Current configuration summary:');
console.log(
  `   - Root project: ${hasSourceFiles ? 'Composite project' : 'Solution file'}`
);
console.log(`   - References: ${config.references?.length || 0} project(s)`);
console.log(
  `   - Composite: ${config.compilerOptions?.composite || 'not set'}`
);
console.log(
  `   - Declaration: ${config.compilerOptions?.declaration || 'not set'}`
);
console.log(`   - NoEmit: ${config.compilerOptions?.noEmit ?? 'not set'}`);
