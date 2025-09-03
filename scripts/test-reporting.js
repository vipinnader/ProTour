#!/usr/bin/env node

/**
 * Test reporting and notification script for ProTour
 * Aggregates test results and sends notifications
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

/**
 * Parse Jest test results
 */
function parseJestResults(resultsPath) {
  if (!fs.existsSync(resultsPath)) {
    return null;
  }

  try {
    const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

    return {
      success: results.success,
      numTotalTests: results.numTotalTests,
      numPassedTests: results.numPassedTests,
      numFailedTests: results.numFailedTests,
      numPendingTests: results.numPendingTests,
      testResults: results.testResults,
      coverageMap: results.coverageMap,
    };
  } catch (error) {
    log(`Error parsing Jest results: ${error.message}`, colors.red);
    return null;
  }
}

/**
 * Parse coverage results
 */
function parseCoverageResults(coveragePath) {
  const coverageSummaryPath = path.join(coveragePath, 'coverage-summary.json');

  if (!fs.existsSync(coverageSummaryPath)) {
    return null;
  }

  try {
    const coverage = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));

    return {
      lines: coverage.total.lines.pct,
      functions: coverage.total.functions.pct,
      branches: coverage.total.branches.pct,
      statements: coverage.total.statements.pct,
    };
  } catch (error) {
    log(`Error parsing coverage results: ${error.message}`, colors.red);
    return null;
  }
}

/**
 * Generate test report summary
 */
function generateTestReport() {
  const report = {
    timestamp: new Date().toISOString(),
    results: {
      mobile: null,
      functions: null,
      shared: null,
    },
    coverage: {
      mobile: null,
      functions: null,
      shared: null,
    },
    overall: {
      success: true,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
    },
  };

  // Collect test results from each package
  const packages = [
    { name: 'mobile', path: 'apps/mobile' },
    { name: 'functions', path: 'functions' },
    { name: 'shared', path: 'packages/shared' },
  ];

  packages.forEach(pkg => {
    // Parse test results
    const resultsPath = path.join(
      process.cwd(),
      pkg.path,
      'test-results',
      'jest-results.json'
    );
    const results = parseJestResults(resultsPath);

    if (results) {
      report.results[pkg.name] = results;
      report.overall.totalTests += results.numTotalTests;
      report.overall.passedTests += results.numPassedTests;
      report.overall.failedTests += results.numFailedTests;

      if (!results.success) {
        report.overall.success = false;
      }
    }

    // Parse coverage results
    const coveragePath = path.join(process.cwd(), pkg.path, 'coverage');
    const coverage = parseCoverageResults(coveragePath);

    if (coverage) {
      report.coverage[pkg.name] = coverage;
    }
  });

  return report;
}

/**
 * Display test report in console
 */
function displayTestReport(report) {
  log('\n📊 ProTour Test Report', colors.blue);
  log('====================', colors.blue);

  // Overall summary
  const statusColor = report.overall.success ? colors.green : colors.red;
  const statusIcon = report.overall.success ? '✅' : '❌';

  log(
    `\n${statusIcon} Overall Status: ${report.overall.success ? 'PASSED' : 'FAILED'}`,
    statusColor
  );
  log(`📈 Total Tests: ${report.overall.totalTests}`, colors.cyan);
  log(`✅ Passed: ${report.overall.passedTests}`, colors.green);
  log(`❌ Failed: ${report.overall.failedTests}`, colors.red);

  // Package-specific results
  Object.entries(report.results).forEach(([pkg, results]) => {
    if (results) {
      log(`\n📦 ${pkg.toUpperCase()}`, colors.blue);
      log(
        `  Tests: ${results.numPassedTests}/${results.numTotalTests} passed`,
        results.success ? colors.green : colors.red
      );

      if (results.numFailedTests > 0) {
        log(`  Failed: ${results.numFailedTests}`, colors.red);
      }
    }
  });

  // Coverage summary
  log('\n📊 Coverage Summary', colors.blue);
  Object.entries(report.coverage).forEach(([pkg, coverage]) => {
    if (coverage) {
      log(`\n📦 ${pkg.toUpperCase()}`, colors.blue);
      log(
        `  Lines: ${coverage.lines}%`,
        coverage.lines >= 80 ? colors.green : colors.yellow
      );
      log(
        `  Functions: ${coverage.functions}%`,
        coverage.functions >= 80 ? colors.green : colors.yellow
      );
      log(
        `  Branches: ${coverage.branches}%`,
        coverage.branches >= 80 ? colors.green : colors.yellow
      );
      log(
        `  Statements: ${coverage.statements}%`,
        coverage.statements >= 80 ? colors.green : colors.yellow
      );
    }
  });

  log(
    `\n🕐 Generated at: ${new Date(report.timestamp).toLocaleString()}`,
    colors.cyan
  );
}

/**
 * Save test report to file
 */
function saveTestReport(report) {
  const reportPath = path.join(process.cwd(), 'test-results');

  if (!fs.existsSync(reportPath)) {
    fs.mkdirSync(reportPath, { recursive: true });
  }

  const reportFile = path.join(reportPath, 'test-report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  log(`📁 Report saved to: ${reportFile}`, colors.cyan);
}

/**
 * Send notification (placeholder for future integration)
 */
function sendNotifications(report) {
  // Placeholder for future notification integrations:
  // - Slack notifications
  // - Email notifications
  // - GitHub status checks
  // - Teams notifications

  if (!report.overall.success) {
    log(
      '🔔 Test failures detected - notifications would be sent in production',
      colors.yellow
    );
  }
}

/**
 * Generate HTML report
 */
function generateHTMLReport(report) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>ProTour Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .success { color: #4caf50; }
        .failure { color: #f44336; }
        .warning { color: #ff9800; }
        .package { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        .coverage { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .metric { text-align: center; padding: 10px; border-radius: 4px; background: #f5f5f5; }
    </style>
</head>
<body>
    <h1>ProTour Test Report</h1>
    <p><strong>Generated:</strong> ${new Date(report.timestamp).toLocaleString()}</p>
    
    <div class="package">
        <h2 class="${report.overall.success ? 'success' : 'failure'}">
            Overall Status: ${report.overall.success ? 'PASSED' : 'FAILED'}
        </h2>
        <p>Total Tests: ${report.overall.totalTests}</p>
        <p class="success">Passed: ${report.overall.passedTests}</p>
        <p class="failure">Failed: ${report.overall.failedTests}</p>
    </div>

    ${Object.entries(report.results)
      .map(([pkg, results]) => {
        if (!results) return '';

        return `
        <div class="package">
            <h3>${pkg.toUpperCase()} Package</h3>
            <p>Tests: ${results.numPassedTests}/${results.numTotalTests} passed</p>
            ${results.numFailedTests > 0 ? `<p class="failure">Failed: ${results.numFailedTests}</p>` : ''}
            
            ${
              report.coverage[pkg]
                ? `
                <h4>Coverage</h4>
                <div class="coverage">
                    <div class="metric">
                        <div>Lines</div>
                        <div class="${report.coverage[pkg].lines >= 80 ? 'success' : 'warning'}">${report.coverage[pkg].lines}%</div>
                    </div>
                    <div class="metric">
                        <div>Functions</div>
                        <div class="${report.coverage[pkg].functions >= 80 ? 'success' : 'warning'}">${report.coverage[pkg].functions}%</div>
                    </div>
                    <div class="metric">
                        <div>Branches</div>
                        <div class="${report.coverage[pkg].branches >= 80 ? 'success' : 'warning'}">${report.coverage[pkg].branches}%</div>
                    </div>
                    <div class="metric">
                        <div>Statements</div>
                        <div class="${report.coverage[pkg].statements >= 80 ? 'success' : 'warning'}">${report.coverage[pkg].statements}%</div>
                    </div>
                </div>
            `
                : ''
            }
        </div>
      `;
      })
      .join('')}
</body>
</html>
  `;

  const reportPath = path.join(process.cwd(), 'test-results');
  const htmlFile = path.join(reportPath, 'test-report.html');
  fs.writeFileSync(htmlFile, html);

  log(`🌐 HTML report saved to: ${htmlFile}`, colors.cyan);
}

/**
 * Main function
 */
function main() {
  log('🧪 Generating ProTour test report...', colors.blue);

  try {
    const report = generateTestReport();

    displayTestReport(report);
    saveTestReport(report);
    generateHTMLReport(report);
    sendNotifications(report);

    if (!report.overall.success) {
      process.exit(1);
    }

    log('\n✅ Test reporting completed successfully!', colors.green);
  } catch (error) {
    log(`\n❌ Test reporting failed: ${error.message}`, colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateTestReport,
  displayTestReport,
  saveTestReport,
  sendNotifications,
};
