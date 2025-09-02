#!/usr/bin/env node

// Simple verification script to check if our TypeScript files have basic syntax errors
// This doesn't do full type checking but catches obvious issues

const fs = require('fs');
const path = require('path');

function checkTypeScriptFiles(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  let issues = [];

  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory() && file.name !== 'node_modules') {
      issues = issues.concat(checkTypeScriptFiles(filePath));
    } else if (file.name.endsWith('.ts')) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Basic syntax checks
        const basicChecks = [
          { regex: /import.*from\s+['"][^'"]*['"](?![;,])/g, message: 'Missing semicolon after import' },
          { regex: /export.*{[^}]*}(?![;,])/g, message: 'Missing semicolon after export' },
          { regex: /interface\s+\w+\s*{[^}]*}(?![;,])/g, message: 'Missing semicolon after interface' },
          { regex: /class\s+\w+[^{]*{[^}]*}(?![;,])/g, message: 'Missing semicolon after class (if needed)' }
        ];

        let lineNumber = 1;
        const lines = content.split('\n');
        
        // Check for obvious syntax issues
        for (const line of lines) {
          if (line.includes('import') && !line.includes('from') && !line.includes('=')) {
            issues.push(`${filePath}:${lineNumber} - Possible malformed import`);
          }
          
          // Check for unmatched braces (simple check)
          const openBraces = (line.match(/{/g) || []).length;
          const closeBraces = (line.match(/}/g) || []).length;
          
          lineNumber++;
        }
        
        // Check overall brace balance
        const totalOpenBraces = (content.match(/{/g) || []).length;
        const totalCloseBraces = (content.match(/}/g) || []).length;
        
        if (totalOpenBraces !== totalCloseBraces) {
          issues.push(`${filePath} - Unmatched braces (${totalOpenBraces} open, ${totalCloseBraces} close)`);
        }
        
      } catch (error) {
        issues.push(`${filePath} - Error reading file: ${error.message}`);
      }
    }
  }
  
  return issues;
}

console.log('🔍 Checking TypeScript files for basic syntax issues...\n');

const srcDir = path.join(__dirname, 'src');
if (!fs.existsSync(srcDir)) {
  console.error('❌ src directory not found!');
  process.exit(1);
}

const issues = checkTypeScriptFiles(srcDir);

if (issues.length === 0) {
  console.log('✅ No obvious syntax issues found!');
  console.log('\n📝 Note: This is a basic check. Full TypeScript compilation may still find type errors.');
  console.log('💡 Install dependencies and run "npm run build" for complete validation.');
} else {
  console.log('⚠️  Potential issues found:');
  issues.forEach(issue => console.log(`   ${issue}`));
}

console.log(`\n📊 Checked ${srcDir}`);
console.log('✨ Verification complete!');