'use strict';

/** Select the npm channel only after all release metadata agrees. */
function selectReleaseChannel({ version, lockVersion, rootLockVersion, eventName, ref, release }) {
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;
  if (typeof version !== 'string' || !versionPattern.test(version)) {
    throw new Error('Version must be x.y.z or x.y.z-beta.N without leading zeroes.');
  }
  if (lockVersion !== version || rootLockVersion !== version) {
    throw new Error('Both package-lock.json versions must match package.json.');
  }

  const isBeta = version.includes('-beta.');
  const tag = `v${version}`;
  if (eventName === 'release') {
    if (!release || release.action !== 'published' || release.draft !== false) {
      throw new Error('Release must be published and must not be a draft.');
    }
    if (release.tag_name !== tag) {
      throw new Error(`Release tag must be ${tag}.`);
    }
    if (release.prerelease !== isBeta) {
      throw new Error('Release prerelease flag must match the package version.');
    }
  } else if (eventName !== 'workflow_dispatch') {
    throw new Error('Only release and workflow_dispatch events can publish.');
  }
  if (ref !== `refs/tags/${tag}`) {
    throw new Error(`Publishing requires the Git ref refs/tags/${tag}.`);
  }

  return { npmTag: isBeta ? 'beta' : 'latest', version };
}

module.exports = { selectReleaseChannel };

if (require.main === module) {
  try {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.resolve(__dirname, '..');
    const readJson = (filename) => JSON.parse(fs.readFileSync(filename, 'utf8'));
    const packageJson = readJson(path.join(root, 'package.json'));
    const lock = readJson(path.join(root, 'package-lock.json'));
    const eventName = process.env.GITHUB_EVENT_NAME;
    let release;
    if (eventName === 'release') {
      if (!process.env.GITHUB_EVENT_PATH) {
        throw new Error('GITHUB_EVENT_PATH is required for a release event.');
      }
      const event = readJson(process.env.GITHUB_EVENT_PATH);
      release = { ...event.release, action: event.action };
    }
    const result = selectReleaseChannel({
      version: packageJson.version,
      lockVersion: lock.version,
      rootLockVersion: lock.packages?.['']?.version,
      eventName,
      ref: process.env.GITHUB_REF,
      release,
    });
    if (!process.env.GITHUB_OUTPUT) {
      throw new Error('GITHUB_OUTPUT is required to return the release channel.');
    }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `npm_tag=${result.npmTag}\nversion=${result.version}\n`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
