import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lookupName } from '../src/lookup';

const CHAIN = 'eip155:4663';
const ADDRESS = '0x2Fe9d43Bd6d78fF6799b53E6Df358E98e048c490';
const OTHER_ADDRESS = '0x1234567890123456789012345678901234567890';

function forwardPayload(name: string, address = ADDRESS) {
  return {
    name,
    label: name.slice(0, -4),
    namespace: '.rns',
    address,
    owner: ADDRESS,
    tokenId: '123',
    expiry: '1821750076',
    status: 'active',
  };
}

function jsonFetch(value: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const mustNotFetch: typeof fetch = async () => {
  throw new Error('Unexpected network request');
};

for (const name of ['rensa.rns', 'rns.rns', 'eth.rns']) {
  test(`forward lookup resolves ${name} from the API`, async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push(String(input));
      assert.equal(init?.method, 'GET');
      assert.equal(init?.redirect, 'error');
      return jsonFetch(forwardPayload(name))(input, init);
    };
    assert.deepEqual(await lookupName({ chainId: CHAIN, domain: name }, fetcher), {
      resolvedAddresses: [{ resolvedAddress: ADDRESS, protocol: 'Rensa', domainName: name }],
    });
    assert.deepEqual(calls, [`https://rensalabs.xyz/api/resolve/${name}`]);
  });
}

test('unknown .rns name returns no result', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'unknown.rns' }, jsonFetch({ error: { code: 'NAME_NOT_FOUND' } }, 404)), null);
});

for (const name of ['Rensa.rns', 'foo.eth', 'sub.name.rns', '-bad.rns', 'bad-.rns', 'ab.rns', 'école.rns', `${'a'.repeat(256)}.rns`]) {
  test(`invalid forward input ${name.slice(0, 24)} is ignored without a fetch`, async () => {
    assert.equal(await lookupName({ chainId: CHAIN, domain: name }, mustNotFetch), null);
  });
}

for (const status of [400, 404, 500]) {
  test(`forward API HTTP ${status} fails closed`, async () => {
    assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, jsonFetch({ error: 'failure' }, status)), null);
  });
}

test('forward request timeout fails closed', async () => {
  const neverUntilAbort: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, neverUntilAbort, 5), null);
});

test('malformed JSON fails closed', async () => {
  const fetcher: typeof fetch = async () => new Response('{broken', { headers: { 'Content-Type': 'application/json' } });
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, fetcher), null);
});

test('non-JSON content and oversized responses fail closed', async () => {
  const html: typeof fetch = async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } });
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, html), null);
  const oversized: typeof fetch = async () => new Response('x'.repeat(8193), { headers: { 'Content-Type': 'application/json' } });
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, oversized), null);
});

test('invalid or zero returned address is rejected', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, jsonFetch(forwardPayload('rensa.rns', 'not-an-address'))), null);
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, jsonFetch(forwardPayload('rensa.rns', `0x${'0'.repeat(40)}`))), null);
});

test('mismatched forward API name and malformed fields are rejected', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, jsonFetch(forwardPayload('other.rns'))), null);
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns' }, jsonFetch({ ...forwardPayload('rensa.rns'), tokenId: null })), null);
});

test('wrong chain is ignored before network access', async () => {
  assert.equal(await lookupName({ chainId: 'eip155:1', domain: 'rensa.rns' }, mustNotFetch), null);
  assert.equal(await lookupName({ chainId: 'eip155:46630', domain: 'rensa.rns' }, mustNotFetch), null);
});

test('valid primary-name reverse lookup uses the API response', async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push(String(input));
    return jsonFetch({ address: ADDRESS, primaryName: 'rensa.rns' })(input, init);
  };
  assert.deepEqual(await lookupName({ chainId: CHAIN, address: ADDRESS }, fetcher), {
    resolvedDomains: [{ resolvedDomain: 'rensa.rns', protocol: 'Rensa' }],
  });
  assert.deepEqual(calls, [`https://rensalabs.xyz/api/reverse/${ADDRESS}`]);
});

test('PRIMARY_NOT_FOUND does not synthesize a reserved reverse name', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, address: ADDRESS }, jsonFetch({ error: { code: 'PRIMARY_NOT_FOUND' } }, 404)), null);
});

test('malformed and zero reverse addresses are ignored before network access', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, address: 'bad' }, mustNotFetch), null);
  assert.equal(await lookupName({ chainId: CHAIN, address: `0x${'0'.repeat(40)}` }, mustNotFetch), null);
});

test('reverse lookup on another chain is ignored', async () => {
  assert.equal(await lookupName({ chainId: 'eip155:1', address: ADDRESS }, mustNotFetch), null);
});

test('invalid reverse API name and mismatched address are rejected', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, address: ADDRESS }, jsonFetch({ address: ADDRESS, primaryName: 'Rensa.rns' })), null);
  assert.equal(await lookupName({ chainId: CHAIN, address: ADDRESS }, jsonFetch({ address: OTHER_ADDRESS, primaryName: 'rensa.rns' })), null);
});

test('reverse API failures are handled without throwing', async () => {
  assert.equal(await lookupName({ chainId: CHAIN, address: ADDRESS }, jsonFetch({}, 500)), null);
  const failingFetch: typeof fetch = async () => { throw new Error('network down'); };
  assert.equal(await lookupName({ chainId: CHAIN, address: ADDRESS }, failingFetch), null);
});

test('ambiguous or empty lookup requests are ignored', async () => {
  type Request = Parameters<typeof lookupName>[0];
  assert.equal(await lookupName({ chainId: CHAIN } as unknown as Request, mustNotFetch), null);
  assert.equal(await lookupName({ chainId: CHAIN, domain: 'rensa.rns', address: ADDRESS } as unknown as Request, mustNotFetch), null);
});
