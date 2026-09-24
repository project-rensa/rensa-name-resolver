# Security model

The Snap accepts MetaMask's `onNameLookup` request only for `eip155:4663`. It validates one lowercase ASCII `.rns` label or a 40-hex-character EVM address before constructing a fixed-origin URL. It sends GET requests only to `https://rensalabs.xyz`, rejects redirects, aborts after six seconds, limits JSON responses to 8 KiB, and validates returned fields and addresses before producing a name-lookup result. Errors fail closed with no resolution.

The manifest requests `endowment:name-lookup` and `endowment:network-access` only. The Snap contains no signer, transaction submission, key-management API, account permission, or persistent storage path.

The production Rensa resolver API is the source of truth for this Snap's response. The Snap does **not** independently verify each result against RNSRegistryV2; a compromised, stale, or unavailable API can affect name resolution. MetaMask users should verify the displayed recipient address before authorizing any transfer. The Snap itself cannot prevent a user from sending to an address they approve in MetaMask.

For a security concern, avoid posting private keys, recovery phrases, or sensitive wallet data in a public issue. A confidential security-reporting contact has not been designated; the repository owner should add one before npm publication. Rerun the full test suite and MetaMask Snapper for each release, and review findings without suppressing them.
