import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const { selectReleaseChannel } = require('../scripts/release-channel.cjs');

const manualRelease = (version = '0.0.27') => ({
  version,
  lockVersion: version,
  rootLockVersion: version,
  eventName: 'workflow_dispatch',
  ref: `refs/tags/v${version}`,
});

const publishedRelease = (version = '0.0.27') => ({
  ...manualRelease(version),
  eventName: 'release',
  release: {
    action: 'published',
    tag_name: `v${version}`,
    draft: false,
    prerelease: version.includes('-beta.'),
  },
});

describe('release channel selection', () => {
  it.each([
    ['0.0.27', 'latest'],
    ['0.0.27-beta.0', 'beta'],
  ])('publishes %s to %s for a published release or a manual tag run', (version, npmTag) => {
    expect(selectReleaseChannel(publishedRelease(version))).toEqual({ npmTag, version });
    expect(selectReleaseChannel(manualRelease(version))).toEqual({ npmTag, version });
  });

  it.each(['0.0', 'v0.0.27', '00.0.27', '0.0.27-beta.01', '0.0.27-rc.0', '0.0.27+build.1'])
  ('rejects unsupported version %s', (version) => {
    expect(() => selectReleaseChannel(manualRelease(version))).toThrow('Version must be');
  });

  it.each(['lockVersion', 'rootLockVersion'])('rejects a missing or mismatching %s', (field) => {
    expect(() => selectReleaseChannel({ ...manualRelease(), [field]: undefined }))
      .toThrow('Both package-lock.json versions must match');
    expect(() => selectReleaseChannel({ ...manualRelease(), [field]: '0.0.26' }))
      .toThrow('Both package-lock.json versions must match');
  });

  it.each(['push', 'pull_request'])('rejects the %s event', (eventName) => {
    expect(() => selectReleaseChannel({ ...manualRelease(), eventName }))
      .toThrow('Only release and workflow_dispatch');
  });

  it.each(['refs/heads/main', 'refs/heads/v0.0.27', 'refs/tags/v0.0.26'])
  ('rejects a manual run on %s', (ref) => {
    expect(() => selectReleaseChannel({ ...manualRelease(), ref }))
      .toThrow('Publishing requires the Git ref refs/tags/v0.0.27.');
  });

  it('rejects releases that have not been published or are still drafts', () => {
    const input = publishedRelease();
    for (const release of [undefined, { ...input.release, action: 'created' }, { ...input.release, draft: true }]) {
      expect(() => selectReleaseChannel({ ...input, release }))
        .toThrow('Release must be published and must not be a draft.');
    }
  });

  it('rejects a release whose tag or Git ref does not match the package', () => {
    const input = publishedRelease();
    expect(() => selectReleaseChannel({ ...input, release: { ...input.release, tag_name: 'v0.0.26' } }))
      .toThrow('Release tag must be v0.0.27.');
    expect(() => selectReleaseChannel({ ...input, ref: 'refs/tags/v0.0.26' }))
      .toThrow('Publishing requires the Git ref refs/tags/v0.0.27.');
  });

  it.each(['0.0.27', '0.0.27-beta.0'])('rejects an incorrect prerelease flag for %s', (version) => {
    const input = publishedRelease(version);
    expect(() => selectReleaseChannel({ ...input, release: { ...input.release, prerelease: !input.release.prerelease } }))
      .toThrow('Release prerelease flag must match the package version.');
  });
});

describe('release channel command', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'wled-release-channel-test-'));
    mkdirSync(join(directory, 'scripts'));
    copyFileSync(resolve(__dirname, '../scripts/release-channel.cjs'), join(directory, 'scripts/release-channel.cjs'));
    writeFileSync(join(directory, 'output'), '');
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  const run = (version: string, eventName: string, ref: string, action = 'published') => {
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version }));
    writeFileSync(join(directory, 'package-lock.json'), JSON.stringify({ version, packages: { '': { version } } }));
    writeFileSync(join(directory, 'event.json'), JSON.stringify({
      action,
      release: { tag_name: `v${version}`, prerelease: version.includes('-beta.'), draft: false },
    }));
    return spawnSync(process.execPath, [join(directory, 'scripts/release-channel.cjs')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_EVENT_NAME: eventName,
        GITHUB_REF: ref,
        GITHUB_EVENT_PATH: join(directory, 'event.json'),
        GITHUB_OUTPUT: join(directory, 'output'),
      },
    });
  };

  it('returns beta outputs from a published release payload', () => {
    const result = run('0.0.27-beta.0', 'release', 'refs/tags/v0.0.27-beta.0');
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(readFileSync(join(directory, 'output'), 'utf8')).toBe('npm_tag=beta\nversion=0.0.27-beta.0\n');
  });

  it('returns latest outputs from a manual stable tag run', () => {
    const result = run('0.0.27', 'workflow_dispatch', 'refs/tags/v0.0.27');
    expect(result.status).toBe(0);
    expect(readFileSync(join(directory, 'output'), 'utf8')).toBe('npm_tag=latest\nversion=0.0.27\n');
  });

  it('fails without writing outputs when the release event is not published', () => {
    const result = run('0.0.27-beta.0', 'release', 'refs/tags/v0.0.27-beta.0', 'created');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Release must be published');
    expect(readFileSync(join(directory, 'output'), 'utf8')).toBe('');
  });
});
