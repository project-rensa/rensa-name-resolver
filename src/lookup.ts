import type { OnNameLookupHandler } from '@metamask/snaps-sdk';

const CHAIN_ID = 'eip155:4663';
const API_ORIGIN = 'https://rensalabs.xyz';
const PROTOCOL = 'Rensa';
const TIMEOUT_MS = 6_000;
const MAX_RESPONSE_BYTES = 8_192;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

type LookupRequest = Parameters<OnNameLookupHandler>[0];
type LookupResult = Awaited<ReturnType<OnNameLookupHandler>>;

/**
 * Narrow an unknown JSON value to a plain record.
 * @param value - Untrusted JSON value.
 * @returns Whether the value is a record.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Enforce the registry's single-label, lowercase ASCII .rns format.
 * @param value - Requested domain.
 * @returns Whether the domain is a valid .rns name.
 */
function isRnsName(value: unknown): value is string {
  if (typeof value !== 'string' || !value.endsWith('.rns')) return false;
  const label = value.slice(0, -4);
  return label.length >= 3 && label.length <= 255 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label);
}

/**
 * Check the syntax of a 20-byte hexadecimal EVM address.
 * @param value - Candidate address.
 * @returns Whether the address has valid hexadecimal syntax.
 */
function isEvmAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

/**
 * Exclude the zero address from a resolution result or reverse query.
 * @param value - Candidate address.
 * @returns Whether the address is usable for name resolution.
 */
function isUsableAddress(value: unknown): value is string {
  return isEvmAddress(value) && value.toLowerCase() !== ZERO_ADDRESS;
}

/**
 * Read only bounded JSON responses from the fixed resolver API.
 * @param response - API response.
 * @returns Parsed JSON or null for a rejected response.
 */
async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get('content-type')?.toLowerCase().includes('application/json')) return null;
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) return null;

  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) return null;
    return JSON.parse(text) as unknown;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return JSON.parse(text) as unknown;
}

/**
 * Fetch one validated API path with an abort timeout and no redirects.
 * @param path - Validated path below the fixed Rensa origin.
 * @param fetcher - Network fetch implementation.
 * @param timeoutMs - Request timeout in milliseconds.
 * @returns Parsed JSON or null when the request fails.
 */
async function getApiJson(path: string, fetcher: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`${API_ORIGIN}${path}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await readJson(response);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Require a forward API record to match the requested Rensa name.
 * @param value - Untrusted API response.
 * @param requestedName - Validated name submitted to the API.
 * @returns Whether the response contains a matching resolved address.
 */
function isForwardResponse(value: unknown, requestedName: string): value is Record<string, unknown> & { address: string } {
  if (!isRecord(value)) return false;
  return value.name === requestedName
    && value.label === requestedName.slice(0, -4)
    && value.namespace === '.rns'
    && isUsableAddress(value.address)
    && isUsableAddress(value.owner)
    && typeof value.tokenId === 'string'
    && /^[0-9]+$/.test(value.tokenId)
    && typeof value.expiry === 'string'
    && /^[0-9]+$/.test(value.expiry)
    && (value.status === 'active' || value.status === 'grace');
}

/**
 * Require a reverse API record to match the requested address.
 * @param value - Untrusted API response.
 * @param requestedAddress - Validated address submitted to the API.
 * @returns Whether the response contains a matching primary name.
 */
function isReverseResponse(value: unknown, requestedAddress: string): value is { primaryName: string } {
  return isRecord(value)
    && isEvmAddress(value.address)
    && value.address.toLowerCase() === requestedAddress.toLowerCase()
    && isRnsName(value.primaryName);
}

/**
 * Resolve a MetaMask name lookup only on Robinhood Chain Mainnet.
 * @param request - MetaMask name-lookup request.
 * @param fetcher - Network fetch implementation.
 * @param timeoutMs - Request timeout in milliseconds.
 * @returns A validated forward or reverse result, or null.
 */
export async function lookupName(request: LookupRequest, fetcher: typeof fetch, timeoutMs = TIMEOUT_MS): Promise<LookupResult> {
  if (request.chainId !== CHAIN_ID) return null;
  const { domain, address } = request;
  if (domain && address) return null;

  if (domain) {
    if (!isRnsName(domain)) return null;
    const data = await getApiJson(`/api/resolve/${encodeURIComponent(domain)}`, fetcher, timeoutMs);
    if (!isForwardResponse(data, domain)) return null;
    return {
      resolvedAddresses: [{ resolvedAddress: data.address, protocol: PROTOCOL, domainName: domain }],
    };
  }

  if (address) {
    if (!isUsableAddress(address)) return null;
    const data = await getApiJson(`/api/reverse/${encodeURIComponent(address)}`, fetcher, timeoutMs);
    if (!isReverseResponse(data, address)) return null;
    return { resolvedDomains: [{ resolvedDomain: data.primaryName, protocol: PROTOCOL }] };
  }

  return null;
}
