# Build Ways Duel Club

## Local run

```powershell
npm run dev
```

Open `http://127.0.0.1:5174/`. The same Node process serves the static game and
the WebSocket endpoint at `/socket`.

## Multiplayer

- A host creates a room for two or four players.
- Guests join with the five-character room code.
- The host selects the weapon and table size.
- The server owns the chamber order and validates every item and shot.
- A reconnect token returns a player to the same seat after a temporary drop.
- A disconnected active player is moved automatically after 15 seconds so a
  match cannot remain blocked forever.

## Production

The deployment bundle contains `server.mjs` and the systemd unit in `ops/`.
Caddy serves static assets and proxies `/socket` and `/health` to port `8787`.
