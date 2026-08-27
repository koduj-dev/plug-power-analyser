# Synology DSM packaging

A native `.spk` package that wraps the same `backend/dist` + `frontend/dist`
build output used by the Linux/macOS packaging.

**Not verified against real DSM hardware.** It was assembled from standard,
well-documented Synology SPK conventions, but this session had no network
path to a real Synology NAS to test the install end-to-end. Treat the first
install as a trial run and see **Troubleshooting** below if something
doesn't come up.

## Prerequisites (on the NAS)

- DSM 7.x
- The **Node.js v22** package installed from Package Center (this package
  does not bundle a Node.js runtime — it uses the one DSM manages)

## Building the package

From the repository root, on your development machine:

```bash
npm install
npm run build
packaging/synology/build-spk.sh
```

This produces `PlugPowerAnalyser-<version>.spk` at the repo root. It bundles
the built backend/frontend plus the backend's production npm dependencies
(no dev tooling, no native/compiled modules — everything here is pure JS,
so the package works on any DSM architecture, ARM64 included).

## Installing

In DSM: **Package Center** → dropdown next to "Install" (or the ⚙ icon,
depending on DSM version) → **Manual Install** → select the `.spk` file.
DSM will warn that the package is from an unknown publisher (it isn't
signed) — this is expected for a self-built package; proceed anyway.

The app starts automatically after install and on every boot. Data
(the SQLite database, logs) lives in the package's own persistent storage
(`$SYNOPKG_PKGVAR`), which DSM keeps across upgrades and optionally across
uninstalls.

## Accessing it

By default the app listens on port **4400**: `http://<nas-ip>:4400`.

This package does **not** add a Package Center desktop/portal tile with
reverse-proxy routing — that integration is a known gap, not implemented
here (it needs DSM-version-specific UI wizard files that couldn't be
verified without real hardware). Direct-port access always works
regardless of DSM version, so that's what's implemented.

## Uninstalling

Package Center → the package → **Action → Uninstall**. You'll be asked
whether to keep the app's data.

## Troubleshooting

- **"Balíček ... nelze nainstalovat, protože je spuštěný s oprávněními
  root"** (DSM 7 refuses to install because the package would run as root):
  fixed by the `conf/privilege` file (content: `{"defaults": {"run-as":
  "package"}}`, per the [SynoCommunity spksrc
  convention](https://github.com/SynoCommunity/spksrc/blob/master/mk/spksrc.service.mk)),
  which tells DSM to run the daemon as the auto-created, non-root
  `sc-PlugPowerAnalyser` user instead of root. This must be a plain **file**
  at `conf/privilege` — a `conf/privilege/` *directory* (e.g. containing an
  `authorize.conf`) is silently ignored by DSM and produces the exact same
  error, which is what happened in an earlier build of this package. If you
  still hit this, confirm your build has it right: `tar tf your.spk` should
  list `conf/privilege` as a file, not `conf/privilege/something`; rebuild
  with `packaging/synology/build-spk.sh` if not.
- **Package won't install / DSM rejects it immediately**: check DSM's
  Package Center log (Package Center → Log) for the specific error. A
  common cause is `os_min_ver` in `packaging/synology/INFO.template` being
  set too high/low for your DSM build — adjust and rebuild.
- **Installs but the app never comes up**: SSH into the NAS and check
  `/var/packages/PlugPowerAnalyser/var/PlugPowerAnalyser.log` (or wherever
  `$SYNOPKG_PKGVAR` resolves to — `cat /var/packages/PlugPowerAnalyser/target/../var/PlugPowerAnalyser.log`
  is usually right) for the actual Node.js error.
- **"Node.js binary not found"** in that log: the Node.js v22 package isn't
  installed, or DSM installed it under a path this package doesn't check —
  open an issue with `find / -maxdepth 4 -iname node -type f 2>/dev/null`
  output from SSH and adjust `find_node()` in
  `packaging/synology/scripts/start-stop-status`.
- **Manually test the daemon** via SSH, bypassing DSM's package framework
  entirely, to isolate whether the problem is Node.js/the app itself vs.
  DSM's package lifecycle:
  ```bash
  sudo -i
  SYNOPKG_PKGDEST=/var/packages/PlugPowerAnalyser/target \
  SYNOPKG_PKGVAR=/var/packages/PlugPowerAnalyser/var \
    /var/packages/PlugPowerAnalyser/scripts/start-stop-status start
  cat /var/packages/PlugPowerAnalyser/var/PlugPowerAnalyser.log
  ```
- **Permission errors writing the database**: the app only ever writes
  inside `$SYNOPKG_PKGVAR`, which DSM provisions with ownership matching the
  `run-as: package` user declared in `conf/privilege/authorize.conf`. If
  writes still fail, report the exact error from the log.

If you hit and fix something here, it's worth feeding back into
`packaging/synology/` so the next install goes smoothly.
