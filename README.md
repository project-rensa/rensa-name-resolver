# Rensa Name Resolver

Rensa Name Resolver lets `.rns` names resolve directly in MetaMask recipient fields on Robinhood Chain Mainnet. For example, `rensa.rns` currently resolves to `0x2Fe9d43Bd6d78fF6799b53E6Df358E98e048c490` through Rensa's live resolver; the address is not hardcoded in the Snap.

This package is **not yet published or allowlisted**. A user-reported manual test installed the local Snap in MetaMask Flask and confirmed that typing `rensa.rns` in Send displayed the expected address and Rensa attribution on chain 4663. No transfer was sent. Other recipient-field cases still need recorded review evidence.

Source: [project-rensa/rensa-name-resolver](https://github.com/project-rensa/rensa-name-resolver). The source repository includes an MIT license. For issues, use the [repository issue tracker](https://github.com/project-rensa/rensa-name-resolver/issues); do not post private keys or sensitive wallet details.

## Scope

- Network: Robinhood Chain Mainnet, chain ID `4663`, CAIP-2 `eip155:4663`.
- Namespace: one lowercase ASCII label followed by `.rns`; labels follow the registry's 3–255 character rules.
- Canonical registry: `0x08ed77b2ec313c7ad5ce23747b07d483071485f9`.
- Official site: [rensalabs.xyz](https://rensalabs.xyz).
- Forward lookups: `GET https://rensalabs.xyz/api/resolve/{name}`.
- Reverse lookups: `GET https://rensalabs.xyz/api/reverse/{address}`. A reverse result exists only if the API reports a valid primary name.

The Snap returns no result for another chain, another TLD, malformed or uppercase names, subdomains, invalid addresses, non-success API responses, invalid JSON, or a timed-out request. It asks only for chain-scoped name lookup and network access. It does not access private keys or recovery phrases, manage accounts, request account permission, sign, or submit transactions. It stores no wallet data. The Rensa API is a trusted external resolution source; users should still check the resolved recipient address before sending assets.

## Privacy

A forward lookup sends the requested `.rns` name to Rensa's API. A reverse lookup sends the public address being checked. The API operator and network infrastructure can observe those requests; this project does not claim that they are anonymous or that the API keeps no logs. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## Development and checks

Use Node.js 22.13 or later. From this directory:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run manifest:validate
npm run eval
```

For a local test in a separate MetaMask Flask browser profile, start these in two terminals:

```sh
npm run serve:snap
npm run serve:install
```

Open `http://localhost:8000` in that Flask profile, install `local:http://localhost:8080`, select Robinhood Chain Mainnet, and enter `rensa.rns` in MetaMask Send. Check the displayed address and close Send without submitting. The local install page is development tooling; it is not part of the npm package or the production website.

## Release gates

The intended npm identifier is `rensa-name-resolver`, subject to a final availability and ownership check. Before npm publication, confirm package-name control and approved-mark distribution rights, rerun the checks and Snapper, and inspect `npm pack --dry-run`. Remove `private: true` only with explicit publication authorization. MetaMask allowlisting of the requested protected permissions is a separate step after npm publication. Neither step has been authorized here.
