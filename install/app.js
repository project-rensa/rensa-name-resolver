const SNAP_ID = 'local:http://localhost:8080';
const button = document.getElementById('install');
const status = document.getElementById('status');
let provider;

function show(message) {
  status.textContent = message;
}

async function refresh() {
  if (!provider) return;
  try {
    const snaps = await provider.request({ method: 'wallet_getSnaps' });
    const installed = snaps?.[SNAP_ID];
    show(installed?.enabled
      ? 'Rensa Name Resolver is installed and connected to this page.'
      : 'MetaMask Flask found. The local Rensa resolver is not connected to this page.');
  } catch {
    show('MetaMask Flask found. Install the local Rensa resolver to continue.');
  }
}

async function selectFlask(candidate) {
  if (provider) return;
  provider = candidate;
  button.disabled = false;
  await refresh();
}

window.addEventListener('eip6963:announceProvider', (event) => {
  if (event.detail?.info?.rdns === 'io.metamask.flask') {
    void selectFlask(event.detail.provider);
  }
});
window.dispatchEvent(new Event('eip6963:requestProvider'));

setTimeout(async () => {
  if (provider || !window.ethereum?.request) return;
  try {
    const version = await window.ethereum.request({ method: 'web3_clientVersion' });
    if (typeof version === 'string' && version.toLowerCase().includes('flask')) {
      await selectFlask(window.ethereum);
      return;
    }
  } catch {
    // The injected fallback is optional; EIP-6963 remains the preferred path.
  }
  show('MetaMask Flask was not detected. Open this page in a separate Flask browser profile.');
}, 500);

button.addEventListener('click', async () => {
  if (!provider) return;
  button.disabled = true;
  show('Waiting for your MetaMask Flask installation approval…');
  try {
    await provider.request({ method: 'wallet_requestSnaps', params: { [SNAP_ID]: {} } });
    await refresh();
  } catch {
    show('Installation was cancelled or failed. No wallet transaction was sent.');
  } finally {
    button.disabled = false;
  }
});
