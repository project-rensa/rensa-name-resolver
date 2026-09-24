import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const projectRoot = process.cwd();
const manifest = JSON.parse(readFileSync(join(projectRoot, 'snap.manifest.json'), 'utf8')) as {
  version: string;
  proposedName: string;
  source: { location: { npm: { packageName: string; iconPath: string } } };
  initialPermissions: Record<string, unknown>;
};
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as {
  name: string;
  version: string;
  files: string[];
};
const snapSource = ['src/index.ts', 'src/lookup.ts']
  .map((path) => readFileSync(join(projectRoot, path), 'utf8'))
  .join('\n');
const installSource = readFileSync(join(projectRoot, 'install/app.js'), 'utf8');

test('manifest requests only chain-scoped name lookup and network access', () => {
  assert.deepEqual(Object.keys(manifest.initialPermissions).sort(), ['endowment:name-lookup', 'endowment:network-access']);
  assert.deepEqual(manifest.initialPermissions['endowment:name-lookup'], {
    chains: ['eip155:4663'],
    matchers: { tlds: ['rns'] },
  });
  assert.deepEqual(manifest.initialPermissions['endowment:network-access'], {});
});

test('Snap source contains no signer, keyring, contract write, or transaction path', () => {
  assert.doesNotMatch(snapSource, /private.?key|seed.?phrase|keyring|sign(?:Transaction|TypedData)|writeContract|sendTransaction|eth_sendTransaction|wallet_invokeSnap/i);
  assert.doesNotMatch(snapSource, /snap\.request|ethereum\.request/);
});

test('installation page requests only Snap status and installation', () => {
  const methods = [...installSource.matchAll(/method:\s*'([^']+)'/g)].map((match) => match[1]).sort();
  assert.deepEqual(methods, ['wallet_getSnaps', 'wallet_requestSnaps', 'web3_clientVersion']);
  assert.doesNotMatch(installSource, /eth_sendTransaction|eth_requestAccounts|wallet_invokeSnap|personal_sign|eth_sign/i);
});

test('package, manifest, and branded SVG have consistent release identity', () => {
  assert.equal(packageJson.name, 'rensa-name-resolver');
  assert.equal(packageJson.version, manifest.version);
  assert.equal(manifest.proposedName, 'Rensa Name Resolver');
  assert.equal(manifest.source.location.npm.packageName, packageJson.name);
  assert.equal(manifest.source.location.npm.iconPath, 'images/icon.svg');
  assert.ok(packageJson.files.includes('images/icon.svg'));
  const icon = readFileSync(join(projectRoot, manifest.source.location.npm.iconPath), 'utf8');
  assert.match(icon, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(icon, /<path[^>]+fill="#11110F"/);
  assert.doesNotMatch(icon, /<script|<foreignObject|<image|(?:href|src)\s*=\s*["']https?:\/\//i, 'SVG must contain no scripts or external resources');
});

test('Snap source uses only the fixed HTTPS Rensa API origin', () => {
  assert.match(snapSource, /const API_ORIGIN = 'https:\/\/rensalabs\.xyz'/);
  assert.match(snapSource, /redirect: 'error'/);
  assert.doesNotMatch(snapSource, /new URL\(|https?:\/\/(?!rensalabs\.xyz)/);
});
