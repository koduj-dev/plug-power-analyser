# Synology DSM packaging (planned)

Synology `.spk` packaging is a deployment option for Plug Power Analyser, not
an architectural requirement — the core application has no Synology-specific
dependencies and runs fine on DSM today via the generic Linux Node.js runtime
(Synology's Node.js 22 package + `npm run build` + `npm start`, or the
`packaging/linux` systemd approach if the DSM model supports running systemd
units).

A native `.spk` package (DSM Package Center integration, DSM-managed service
lifecycle, DSM web UI reverse-proxy entry) is planned but not yet built for
the MVP. Initial target when implemented:

- Synology DS418, DSM 7.x, ARM64 / Realtek RTD1296, 2 GB RAM
- Node.js 22 via the official Synology Node.js package

Contributions implementing the `.spk` package (`INFO`, `spk` build scripts,
DSM service wrapper) are welcome — see the root README for how the backend
and frontend are built, since the `.spk` package should just wrap the same
`backend/dist` + `frontend/dist` build output used by the Linux/macOS
packaging.
