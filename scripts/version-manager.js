#!/usr/bin/env node

/**
 * Version management and release automation script for ProTour
 * Handles version bumping, changelog generation, and release notes
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
  magenta: '\x1b[35m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

class VersionManager {
  constructor() {
    this.rootPath = path.join(__dirname, '..');
    this.packagePath = path.join(this.rootPath, 'package.json');
    this.mobilePackagePath = path.join(
      this.rootPath,
      'apps/mobile/package.json'
    );
    this.functionsPackagePath = path.join(
      this.rootPath,
      'functions/package.json'
    );
    this.sharedPackagePath = path.join(
      this.rootPath,
      'packages/shared/package.json'
    );
    this.changelogPath = path.join(this.rootPath, 'CHANGELOG.md');
  }

  /**
   * Get current version from root package.json
   */
  getCurrentVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(this.packagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      throw new Error(`Failed to read current version: ${error.message}`);
    }
  }

  /**
   * Calculate next version based on bump type
   */
  calculateNextVersion(currentVersion, bumpType) {
    const [major, minor, patch] = currentVersion.split('.').map(Number);

    switch (bumpType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
        return `${major}.${minor}.${patch + 1}`;
      case 'prerelease':
        const prereleaseMatch = currentVersion.match(
          /(\d+\.\d+\.\d+)-(\w+)\.(\d+)/
        );
        if (prereleaseMatch) {
          const [, base, tag, num] = prereleaseMatch;
          return `${base}-${tag}.${Number(num) + 1}`;
        } else {
          return `${major}.${minor}.${patch + 1}-beta.0`;
        }
      default:
        throw new Error(`Invalid bump type: ${bumpType}`);
    }
  }

  /**
   * Update version in package.json files
   */
  updatePackageVersions(newVersion) {
    const packagePaths = [
      this.packagePath,
      this.mobilePackagePath,
      this.functionsPackagePath,
      this.sharedPackagePath,
    ];

    packagePaths.forEach(packagePath => {
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
        packageJson.version = newVersion;
        fs.writeFileSync(
          packagePath,
          JSON.stringify(packageJson, null, 2) + '\n'
        );
        log(
          `✅ Updated ${path.relative(this.rootPath, packagePath)} to v${newVersion}`,
          colors.green
        );
      }
    });
  }

  /**
   * Update iOS version in Info.plist and project.pbxproj
   */
  updateiOSVersion(newVersion) {
    const infoPlistPath = path.join(
      this.rootPath,
      'apps/mobile/ios/ProTour/Info.plist'
    );
    const projectPath = path.join(
      this.rootPath,
      'apps/mobile/ios/ProTour.xcodeproj/project.pbxproj'
    );

    if (fs.existsSync(infoPlistPath)) {
      let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
      infoPlist = infoPlist.replace(
        /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]*<\/string>/,
        `<key>CFBundleShortVersionString</key>\n\t<string>${newVersion}</string>`
      );
      fs.writeFileSync(infoPlistPath, infoPlist);
      log(`✅ Updated iOS Info.plist to v${newVersion}`, colors.green);
    }

    if (fs.existsSync(projectPath)) {
      let project = fs.readFileSync(projectPath, 'utf8');
      project = project.replace(
        /MARKETING_VERSION = [^;]+;/g,
        `MARKETING_VERSION = ${newVersion};`
      );
      fs.writeFileSync(projectPath, project);
      log(`✅ Updated iOS project.pbxproj to v${newVersion}`, colors.green);
    }
  }

  /**
   * Update Android version in build.gradle
   */
  updateAndroidVersion(newVersion) {
    const buildGradlePath = path.join(
      this.rootPath,
      'apps/mobile/android/app/build.gradle'
    );

    if (fs.existsSync(buildGradlePath)) {
      let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

      // Update versionName
      buildGradle = buildGradle.replace(
        /versionName\s+["'][^"']*["']/,
        `versionName "${newVersion}"`
      );

      // Increment versionCode
      const versionCodeMatch = buildGradle.match(/versionCode\s+(\d+)/);
      if (versionCodeMatch) {
        const currentCode = parseInt(versionCodeMatch[1]);
        buildGradle = buildGradle.replace(
          /versionCode\s+\d+/,
          `versionCode ${currentCode + 1}`
        );
      }

      fs.writeFileSync(buildGradlePath, buildGradle);
      log(`✅ Updated Android build.gradle to v${newVersion}`, colors.green);
    }
  }

  /**
   * Get git commits since last tag
   */
  getCommitsSinceLastTag() {
    try {
      const lastTag = execSync(
        'git describe --tags --abbrev=0 2>/dev/null || echo ""',
        { encoding: 'utf8' }
      ).trim();

      const range = lastTag ? `${lastTag}..HEAD` : 'HEAD';
      const commits = execSync(`git log ${range} --oneline --no-merges`, {
        encoding: 'utf8',
      }).trim();

      return commits ? commits.split('\n') : [];
    } catch (error) {
      log(
        `Warning: Could not get git commits: ${error.message}`,
        colors.yellow
      );
      return [];
    }
  }

  /**
   * Generate release notes from commits
   */
  generateReleaseNotes(version, commits) {
    const features = [];
    const fixes = [];
    const breaking = [];
    const other = [];

    commits.forEach(commit => {
      const message = commit.replace(/^[a-f0-9]+\s+/, '');
      const lowerMessage = message.toLowerCase();

      if (lowerMessage.includes('breaking') || lowerMessage.includes('!:')) {
        breaking.push(message);
      } else if (
        lowerMessage.startsWith('feat') ||
        lowerMessage.includes('add')
      ) {
        features.push(message);
      } else if (
        lowerMessage.startsWith('fix') ||
        lowerMessage.includes('fix')
      ) {
        fixes.push(message);
      } else {
        other.push(message);
      }
    });

    let releaseNotes = `# Release v${version}\n\n`;
    releaseNotes += `_Released: ${new Date().toISOString().split('T')[0]}_\n\n`;

    if (breaking.length > 0) {
      releaseNotes += '## 💥 Breaking Changes\n\n';
      breaking.forEach(commit => (releaseNotes += `- ${commit}\n`));
      releaseNotes += '\n';
    }

    if (features.length > 0) {
      releaseNotes += '## ✨ New Features\n\n';
      features.forEach(commit => (releaseNotes += `- ${commit}\n`));
      releaseNotes += '\n';
    }

    if (fixes.length > 0) {
      releaseNotes += '## 🐛 Bug Fixes\n\n';
      fixes.forEach(commit => (releaseNotes += `- ${commit}\n`));
      releaseNotes += '\n';
    }

    if (other.length > 0) {
      releaseNotes += '## 🔧 Other Changes\n\n';
      other.forEach(commit => (releaseNotes += `- ${commit}\n`));
      releaseNotes += '\n';
    }

    return releaseNotes;
  }

  /**
   * Update CHANGELOG.md
   */
  updateChangelog(version, releaseNotes) {
    let changelog = '';

    if (fs.existsSync(this.changelogPath)) {
      changelog = fs.readFileSync(this.changelogPath, 'utf8');
    } else {
      changelog =
        '# Changelog\n\nAll notable changes to ProTour will be documented in this file.\n\n';
    }

    // Insert new release notes at the top
    const lines = changelog.split('\n');
    const headerEnd = lines.findIndex(line => line.startsWith('# ')) + 2;

    lines.splice(headerEnd, 0, releaseNotes);

    fs.writeFileSync(this.changelogPath, lines.join('\n'));
    log(`✅ Updated CHANGELOG.md with v${version} release notes`, colors.green);
  }

  /**
   * Create git tag
   */
  createGitTag(version, releaseNotes) {
    try {
      const tagMessage = `Release v${version}\n\n${releaseNotes}`;
      execSync(`git tag -a v${version} -m "${tagMessage}"`, {
        stdio: 'inherit',
      });
      log(`✅ Created git tag v${version}`, colors.green);
    } catch (error) {
      log(`❌ Failed to create git tag: ${error.message}`, colors.red);
    }
  }

  /**
   * Commit version changes
   */
  commitVersionChanges(version) {
    try {
      execSync('git add .', { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to v${version}"`, {
        stdio: 'inherit',
      });
      log(`✅ Committed version changes for v${version}`, colors.green);
    } catch (error) {
      log(`❌ Failed to commit version changes: ${error.message}`, colors.red);
    }
  }

  /**
   * Main version bump function
   */
  async bump(bumpType, options = {}) {
    const {
      skipGit = false,
      skipTag = false,
      dryRun = false,
      prerelease = false,
    } = options;

    log('🚀 Starting version bump process...', colors.cyan);
    log('====================================', colors.cyan);

    const currentVersion = this.getCurrentVersion();
    log(`Current version: ${currentVersion}`, colors.blue);

    const newVersion = this.calculateNextVersion(currentVersion, bumpType);
    log(`New version: ${newVersion}`, colors.green);

    if (dryRun) {
      log('🔍 DRY RUN - No changes will be made', colors.yellow);
      return { currentVersion, newVersion };
    }

    // Update all package.json files
    this.updatePackageVersions(newVersion);

    // Update mobile platform versions
    this.updateiOSVersion(newVersion);
    this.updateAndroidVersion(newVersion);

    if (!skipGit) {
      // Get commits and generate release notes
      const commits = this.getCommitsSinceLastTag();
      const releaseNotes = this.generateReleaseNotes(newVersion, commits);

      // Update changelog
      this.updateChangelog(newVersion, releaseNotes);

      // Commit changes
      this.commitVersionChanges(newVersion);

      if (!skipTag) {
        // Create git tag
        this.createGitTag(newVersion, releaseNotes);
      }
    }

    log(`\n🎉 Successfully bumped version to v${newVersion}!`, colors.green);

    if (!skipGit && !skipTag) {
      log(`\n📝 Don't forget to push the tag:`, colors.cyan);
      log(`   git push origin v${newVersion}`, colors.cyan);
    }

    return { currentVersion, newVersion };
  }

  /**
   * Show current version info
   */
  showStatus() {
    log('📊 Version Status', colors.blue);
    log('================', colors.blue);

    const currentVersion = this.getCurrentVersion();
    log(`Current version: ${currentVersion}`, colors.green);

    try {
      const lastTag = execSync(
        'git describe --tags --abbrev=0 2>/dev/null || echo "No tags"',
        { encoding: 'utf8' }
      ).trim();
      log(`Last git tag: ${lastTag}`, colors.cyan);
    } catch (error) {
      log('Last git tag: No tags found', colors.yellow);
    }

    const commits = this.getCommitsSinceLastTag();
    log(`Commits since last tag: ${commits.length}`, colors.blue);

    if (commits.length > 0) {
      log('\nRecent commits:', colors.blue);
      commits.slice(0, 5).forEach(commit => {
        log(`  - ${commit}`, colors.cyan);
      });
      if (commits.length > 5) {
        log(`  ... and ${commits.length - 5} more`, colors.cyan);
      }
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  const manager = new VersionManager();

  try {
    switch (command) {
      case 'bump':
        if (!arg || !['major', 'minor', 'patch', 'prerelease'].includes(arg)) {
          log('❌ Invalid bump type', colors.red);
          log(
            'Usage: npm run version:bump <major|minor|patch|prerelease>',
            colors.cyan
          );
          process.exit(1);
        }

        const options = {
          dryRun: process.argv.includes('--dry-run'),
          skipGit: process.argv.includes('--skip-git'),
          skipTag: process.argv.includes('--skip-tag'),
        };

        await manager.bump(arg, options);
        break;

      case 'status':
        manager.showStatus();
        break;

      case 'current':
        log(manager.getCurrentVersion());
        break;

      default:
        log('ProTour Version Manager', colors.cyan);
        log('======================', colors.cyan);
        log('');
        log('Commands:', colors.blue);
        log(
          '  bump <type>    Bump version (major, minor, patch, prerelease)',
          colors.cyan
        );
        log('  status         Show current version status', colors.cyan);
        log('  current        Show current version number', colors.cyan);
        log('');
        log('Options:', colors.blue);
        log(
          '  --dry-run      Show what would be changed without making changes',
          colors.cyan
        );
        log('  --skip-git     Skip git operations (commit, tag)', colors.cyan);
        log('  --skip-tag     Skip creating git tag', colors.cyan);
        log('');
        log('Examples:', colors.blue);
        log('  npm run version:bump patch', colors.cyan);
        log('  npm run version:bump minor --dry-run', colors.cyan);
        log('  npm run version:bump major --skip-tag', colors.cyan);
        break;
    }
  } catch (error) {
    log(`❌ Error: ${error.message}`, colors.red);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { VersionManager };
