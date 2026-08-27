# Plug Power Analyser

Lightweight self-hosted power monitoring and analytics for Shelly Gen2+
smart plugs: independent 1-second polling per device, local SQLite storage
with 7-day raw retention, live telemetry over WebSocket, and a browser
dashboard with per-device and historical statistics.

See [`docs/plug-power-analyser-spec.md`](docs/plug-power-analyser-spec.md)
for the full project specification. This README covers day-to-day
development and deployment of the current (MVP) implementation.

## Requirements

- Node.js **>= 22.5.0** (uses the built-in, still-experimental `node:sqlite` module)

## Development

```bash
npm install
npm run dev
```

This runs the Fastify backend (`backend/`, default port `4400`) and the Vite
dev server (`frontend/`, with `/api` and `/ws` proxied to the backend)
concurrently with hot reload. Open the URL Vite prints (typically
`http://localhost:5173`).

Environment variables (see [`.env.example`](.env.example)) configure the
backend — copy it to `.env` if you want persistent local overrides.

## Building

```bash
npm run build
```

Compiles the backend to `backend/dist` and builds the static frontend to
`frontend/dist`.

## Running in production

```bash
npm start
```

Serves the built frontend directly from the Fastify backend on a single
port — no separate frontend server needed in production.

## Testing

```bash
npm test
```

Runs the backend test suite (`tests/backend/`) with Node's built-in test
runner, covering HTTP Digest Authentication, energy-counter reset/discontinuity
detection, the per-device collector's scheduling and failure handling,
device CRUD routes, retention cleanup, and migrations.

## Project layout

```text
backend/     Fastify + node:sqlite backend (collector, REST API, WebSocket)
frontend/    React + TypeScript dashboard, built with Vite
packaging/   Linux (systemd) and macOS (launchd) service packaging;
             Synology .spk packaging is planned, see packaging/synology/
tests/       Backend test suite (node:test)
docs/        Project specification
```

## Deploying

### Linux (systemd)

```bash
npm run build
sudo packaging/linux/install.sh
```

Installs to `/opt/plug-power-analyser`, creates a dedicated system user,
stores the database under `/var/lib/plug-power-analyser`, and enables/starts
`plug-power-analyser.service`. See `packaging/linux/uninstall.sh` to remove.

### macOS (launchd)

```bash
npm run build
packaging/macos/install.sh
```

Installs a per-user LaunchAgent (`~/Library/LaunchAgents`, no sudo needed to
run) that starts on login and stays running. See
`packaging/macos/uninstall.sh` to remove.

### Synology DSM

Not yet packaged as a native `.spk` — see
[`packaging/synology/README.md`](packaging/synology/README.md). In the
meantime, the app runs on DSM like any other Linux Node.js 22 service (build
+ `npm start`, or adapt the systemd approach if your DSM model supports it).

## Security notes

- Device passwords are never returned by the API or written to logs (redacted
  in structured logging; stripped from all device DTOs).
- There is no application-level login in this MVP. Bind `PPA_HOST` to a LAN
  interface only, or put a reverse proxy with authentication in front of it,
  if the host is reachable beyond a trusted local network.

## License

MIT — see [`LICENSE`](LICENSE).
