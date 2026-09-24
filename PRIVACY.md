# Privacy

Rensa Name Resolver handles the name or public address that MetaMask asks it to resolve. For a forward lookup it sends the requested `.rns` name to `https://rensalabs.xyz/api/resolve/{name}`. For a reverse lookup it sends the requested public EVM address to `https://rensalabs.xyz/api/reverse/{address}`. The Snap makes no request for invalid names, invalid addresses, or chains other than `eip155:4663`.

The Snap does not request account access, private keys, recovery phrases, signatures, transaction submission, or persistent storage. It does not send a wallet account list. The API operator and normal network infrastructure may observe lookup requests and connection metadata; their retention practices are not asserted by this document. Do not treat a name lookup as anonymous or as independent onchain verification.
