# Plug Power Analyser

> Lightweight self-hosted power monitoring and analytics for smart
> plugs, with real-time telemetry, historical statistics, and
> multi-device aggregation.

## 1. Project Goal

Plug Power Analyser is a lightweight self-hosted application for
continuous monitoring, storage, visualization, and analysis of
electrical power consumption from smart plugs.

The first version supports **Shelly Gen2+** devices exposing the RPC API
`Switch.GetStatus`.

Core requirements:

-   manage multiple smart plugs;
-   initially support Shelly Gen2+ plugs only;
-   poll each plug independently every 1 second;
-   store telemetry locally in an embedded database;
-   push live updates to the web UI via WebSocket;
-   retain second-resolution raw telemetry for 7 days;
-   create longer-term aggregates;
-   provide per-device and combined statistics;
-   operate entirely on the local network without Shelly Cloud;
-   run as a normal service/application on Linux and macOS;
-   optionally be packaged as a native Synology DSM `.spk` package.

The application is intentionally **not** a generic smart-home platform.
Its scope is power monitoring and analytics.

------------------------------------------------------------------------

## 2. Deployment Targets

The core application must be platform-independent and must **not**
depend on Synology-specific APIs.

Supported/planned deployment variants:

### Linux

Primary generic server/desktop target.

The application should be installable as a normal package or
distributable application and runnable as a background service.

Typical use cases:

-   home server;
-   workstation;
-   Raspberry Pi or similar ARM Linux host;
-   dedicated monitoring machine;
-   desktop development/testing.

Where appropriate, provide integration with `systemd`.

### macOS

The application should also be runnable on macOS, including desktop
machines used as an always-on monitoring host.

Where appropriate, provide a `launchd` service definition or equivalent
package integration.

### Synology DSM

Synology support is a **packaging/deployment option**, not an
architectural requirement.

Provide a native `.spk` package that installs the same core application
as a DSM service and exposes its web UI through DSM.

Initial Synology test target:

-   Synology DS418;
-   DSM 7.x;
-   ARM64 / Realtek RTD1296;
-   2 GB RAM;
-   Node.js 22 available as a Synology package.

The application must remain lightweight enough to run comfortably
alongside normal NAS workloads.

### Future targets

The architecture should make additional packaging straightforward, for
example:

-   Docker / OCI image;
-   other NAS platforms;
-   Windows;
-   standalone binaries/bundles where practical.

------------------------------------------------------------------------

## 3. Architecture Principle

Keep the application core independent from deployment packaging.

Conceptually:

``` text
plug-power-analyser/
├── backend/
├── frontend/
├── packaging/
│   ├── linux/
│   ├── macos/
│   └── synology/
├── docs/
├── tests/
├── package.json
├── README.md
└── LICENSE
```

Platform-specific packaging should only be responsible for installation,
service lifecycle, filesystem paths, permissions, and integration with
the host OS.

Monitoring, storage, APIs, analytics, and UI must remain shared.

------------------------------------------------------------------------

## 4. Technology

### Backend

Use **Node.js 22**.

Communication with Shelly devices must use HTTP directly from Node.js.
Do not spawn `curl` processes during normal collection.

Equivalent RPC request:

``` http
GET http://192.168.0.28/rpc/Switch.GetStatus?id=0
```

Support HTTP Digest Authentication for password-protected Shelly
devices.

### Database

Use **SQLite** for the initial implementation.

Reasons:

-   embedded;
-   no external database server;
-   very small resource overhead;
-   simple backup;
-   sufficient throughput for multiple devices sampled at 1 Hz;
-   keeps the application self-contained;
-   portable across Linux, macOS, and Synology DSM.

Enable SQLite **WAL mode**.

### Frontend

Provide a browser-based UI served by the application itself.

The backend exposes:

-   REST API for configuration, history, and analytics;
-   WebSocket for realtime telemetry.

Framework choice is implementation-specific. Avoid unnecessary
complexity and excessive runtime overhead.

------------------------------------------------------------------------

## 5. Device Management

The UI must allow adding, editing, disabling, and deleting Shelly plugs.

Device configuration:

-   name;
-   IP address or hostname;
-   RPC switch ID, default `0`;
-   username;
-   password;
-   polling interval, default `1000 ms`;
-   enabled/disabled;
-   optional description;
-   optional group.

Example:

``` text
Name: AI PC
Host: 192.168.0.28
Switch ID: 0
Poll interval: 1000 ms
Group: Computers
```

When adding a device, perform a connection/authentication test using:

``` text
Switch.GetStatus?id=0
```

Credentials must not be returned through normal API responses, exposed
after storage, or written to logs.

------------------------------------------------------------------------

## 6. Collector Architecture

Each device has an independent collector.

A slow, offline, or misconfigured Shelly must not delay sampling of
other devices.

``` text
AI PC       ── 1 s ──► Shelly
Server      ── 1 s ──► Shelly
TV          ── 1 s ──► Shelly
Workshop    ── 1 s ──► Shelly
```

Do not implement all devices through one sequential polling loop.

The collector must avoid overlapping requests to the same device if a
request takes longer than its polling interval.

Record at least:

-   timestamp;
-   device ID;
-   output state;
-   active power;
-   voltage;
-   current;
-   frequency;
-   total consumed energy;
-   total returned energy;
-   device temperature.

Example Shelly response:

``` json
{
  "id": 0,
  "source": "init",
  "output": true,
  "apower": 81.6,
  "voltage": 238.7,
  "freq": 49.9,
  "current": 0.479,
  "aenergy": {
    "total": 70.930
  },
  "ret_aenergy": {
    "total": 0.000
  },
  "temperature": {
    "tC": 41.7
  }
}
```

------------------------------------------------------------------------

## 7. Database Model

### `devices`

Suggested fields:

``` text
id
name
host
switch_id
username
password
poll_interval_ms
group_name
description
enabled
created_at
updated_at
```

### `samples`

Second-resolution raw telemetry:

``` text
timestamp
device_id

power_w
voltage_v
current_a
frequency_hz
temperature_c

energy_total_wh
returned_energy_total_wh

output
```

Index at least:

``` text
(device_id, timestamp)
```

### `aggregates_5m`

``` text
period_start
device_id

energy_wh

power_avg
power_min
power_max

voltage_avg
voltage_min
voltage_max

current_avg
current_min
current_max

temperature_avg
temperature_min
temperature_max

sample_count
```

### `aggregates_daily`

``` text
date
device_id

energy_wh

power_avg
power_min
power_max

voltage_avg
voltage_min
voltage_max

current_avg
current_min
current_max

temperature_avg
temperature_min
temperature_max

active_seconds
sample_count
```

------------------------------------------------------------------------

## 8. Retention and Downsampling

Default retention:

``` text
1-second RAW telemetry
        │
        ├── retain 7 days
        │
        ▼
5-minute aggregates
        │
        ├── retain at least 1 year
        │
        ▼
daily aggregates
        │
        └── retain indefinitely
```

Retention periods should eventually be configurable.

Weekly, monthly, and yearly aggregates do not need dedicated permanent
tables initially. They can be calculated efficiently from daily
aggregates.

Seven days of raw data is intentional: it allows retrospective
inspection of exact second-resolution behavior several days after an
event or experiment.

------------------------------------------------------------------------

## 9. Energy Calculation

Use Shelly's cumulative energy counter as the primary source of energy
consumption:

``` text
aenergy.total
```

Energy for an interval:

``` text
energy = total_at_end - total_at_start
```

Do **not** use numerical integration of `apower` as the authoritative
energy measurement while the Shelly cumulative counter is available.

This provides resilience against collector outages. If the host misses
several minutes of samples, energy consumed during the gap can still be
derived from the cumulative counter.

The collector/aggregation layer must correctly handle:

-   Shelly reboot;
-   energy counter reset;
-   firmware update;
-   counter decreasing unexpectedly;
-   device replacement;
-   missing samples;
-   network outage.

A reset must never generate negative consumption.

Store sufficient metadata/events to explain discontinuities.

------------------------------------------------------------------------

## 10. Main Dashboard

Display all configured plugs as individual cards.

Each card should show:

-   device name;
-   online/offline/degraded/auth state;
-   current power (W);
-   voltage (V);
-   current (A);
-   frequency (Hz);
-   temperature (°C);
-   relay/output state;
-   today's energy;
-   cumulative energy;
-   daily minimum power;
-   daily maximum power;
-   rolling 24-hour minimum power;
-   rolling 24-hour maximum power;
-   graph of power during the last hour;
-   gauge comparing current power with the maximum power observed during
    the previous 24 hours.

Conceptual card:

``` text
┌──────────────────────────────┐
│ AI PC                        │
│ ONLINE                       │
│                              │
│            81.6 W            │
│                              │
│ 238.7 V       0.479 A        │
│ 49.9 Hz       41.7 °C        │
│                              │
│ Today          2.81 kWh      │
│ Total          0.071 kWh     │
│                              │
│ Today min        42 W        │
│ Today max       536 W        │
│ 24h min          38 W        │
│ 24h max         536 W        │
│                              │
│ ███░░░░░░░  15 % of peak    │
│                              │
│ [ power graph — last hour ]  │
└──────────────────────────────┘
```

------------------------------------------------------------------------

## 11. Realtime Updates

Sampling and UI updates are separate concerns.

``` text
Shelly
   │
   │ HTTP RPC / 1 Hz
   ▼
Collector
   │
   ├────► SQLite
   │
   └────► WebSocket broadcaster
                   │
                   ▼
                Browser
```

The collector always runs regardless of whether any UI is open.

After a successful sample, publish the current state through WebSocket.

Example:

``` json
{
  "type": "device.status",
  "deviceId": 1,
  "timestamp": 1787858220,
  "power": 81.6,
  "voltage": 238.7,
  "current": 0.479,
  "frequency": 49.9,
  "temperature": 41.7,
  "energyTotal": 70.93,
  "output": true
}
```

The browser must not poll the REST API once per second for live
telemetry.

------------------------------------------------------------------------

## 12. 24-Hour Peak Gauge

Default gauge:

``` text
current power / maximum power observed during previous 24 hours
```

Example:

``` text
24h maximum = 500 W
current      = 75 W

gauge = 15 %
```

The UI must explicitly label this as relative to the **24h observed
peak**, not as a percentage of the Shelly plug's electrical rating.

A future mode may compare against a configured expected maximum for the
connected appliance.

------------------------------------------------------------------------

## 13. Device Detail

The device detail page should provide both live state and historical
analytics.

### Current State

-   W;
-   V;
-   A;
-   Hz;
-   °C;
-   output;
-   total energy;
-   last successful update.

### Energy

Quick periods:

-   last hour;
-   today;
-   yesterday;
-   last 7 days;
-   current week;
-   previous week;
-   current month;
-   previous month;
-   current year;
-   all time.

Allow custom date/time range selection.

### Power Statistics

For the selected interval:

-   average;
-   minimum;
-   maximum;
-   median;
-   P95;
-   P99.

### Voltage Statistics

-   average;
-   minimum;
-   maximum.

### Current Statistics

-   average;
-   minimum;
-   maximum.

### Temperature Statistics

-   average;
-   minimum;
-   maximum.

------------------------------------------------------------------------

## 14. Historical Charts

Support at least:

-   power over time;
-   energy consumption over time;
-   voltage over time;
-   current over time;
-   temperature over time.

Select data resolution automatically based on the requested interval:

``` text
short interval / <= 7 days   -> raw samples where practical
medium interval              -> 5-minute aggregates
long interval                -> daily aggregates
```

Avoid sending millions of raw samples to the browser unnecessarily.

------------------------------------------------------------------------

## 15. Analytical Statistics

The system should make it easy to answer questions such as:

-   Which weekday has the highest consumption?
-   At what time of day is average power highest?
-   How much energy did the AI PC consume this month?
-   What was the largest recorded power peak?
-   How long was the connected device actually active?
-   During which hours does the machine usually work hardest?
-   Is consumption increasing compared with the previous week/month?

### Hour-of-Day Analysis

Example:

``` text
00:00–01:00    41 W avg
01:00–02:00    39 W avg
...
13:00–14:00   286 W avg
14:00–15:00   341 W avg
15:00–16:00   302 W avg
```

This should support observations such as:

> The highest average workload occurs around 14:00--15:00.

### Day-of-Week Analysis

Example:

``` text
Monday       2.1 kWh
Tuesday      4.8 kWh
Wednesday    3.7 kWh
Thursday     2.9 kWh
Friday       3.2 kWh
```

Provide both:

-   total consumption;
-   average per occurrence of that weekday.

This avoids bias when a selected interval contains five Tuesdays but
only four Mondays.

### Day × Hour Heatmap

Provide a heatmap with:

-   X axis: hour of day;
-   Y axis: day of week;
-   value: average power or energy consumption.

This should immediately expose patterns such as:

``` text
Tuesday 13:00–15:00 -> consistently high consumption
```

------------------------------------------------------------------------

## 16. Multi-Device Analytics

Allow selecting multiple plugs and viewing them together.

Example:

``` text
☑ AI PC
☑ Main monitor
☑ Secondary monitor
☐ TV
```

Live result:

``` text
AI PC             430 W
Main monitor       72 W
Secondary monitor  48 W
───────────────────────
Combined          550 W
```

Combined views should support:

-   current power;
-   energy;
-   charts;
-   daily statistics;
-   weekly/monthly statistics;
-   selected time ranges.

For combined min/max power, calculate the **simultaneous aggregate power
at each timestamp/time bucket**.

Do not report:

``` text
max(device A) + max(device B)
```

unless those maxima actually occurred simultaneously.

------------------------------------------------------------------------

## 17. Device State and Errors

Expose at least:

``` text
ONLINE
DEGRADED
OFFLINE
AUTH ERROR
```

Track:

-   last successful sample;
-   last attempt;
-   consecutive failures;
-   last error;
-   optionally response latency.

A single failed request must not immediately mark a device offline.

Collector failures must never crash the global monitoring service.

------------------------------------------------------------------------

## 18. REST API

Suggested endpoints:

``` text
GET    /api/devices
POST   /api/devices

GET    /api/devices/:id
PUT    /api/devices/:id
DELETE /api/devices/:id

GET    /api/devices/:id/current
GET    /api/devices/:id/history
GET    /api/devices/:id/statistics

GET    /api/devices/:id/energy/daily
GET    /api/devices/:id/energy/monthly

GET    /api/statistics/hour-of-day
GET    /api/statistics/day-of-week
GET    /api/statistics/heatmap

GET    /api/statistics?devices=1,2,3
```

The exact API design may change, but keep it suitable for external
lightweight clients.

------------------------------------------------------------------------

## 19. Desktop Integration

A future Linux desktop integration, such as a GNOME Shell indicator,
should consume the application's REST/WebSocket API rather than
communicate directly with individual plugs.

Example:

``` text
⚡ AI PC  427 W
```

Expanded:

``` text
Current       427 W
Today        3.42 kWh
Month       68.17 kWh
Temperature  46.2 °C

24h peak      612 W
Current       69.8 %
```

The same API can later support other desktop integrations.

------------------------------------------------------------------------

## 20. Experiment Support --- Future Feature

Future versions may allow creating experiment markers/sessions.

Example model:

``` text
experiment_id
name
started_at
finished_at
device_ids
metadata
```

Example result:

``` text
Experiment #42

Duration:        17m 42s
Energy:           0.184 kWh
Average power:   624 W
Peak power:      811 W
```

This enables correlation of application/database benchmark results with
actual machine energy consumption.

Possible future metadata:

-   experiment name;
-   Git commit;
-   benchmark parameters;
-   workload;
-   notes;
-   external experiment ID.

------------------------------------------------------------------------

## 21. MVP Scope

First working version:

1.  Node.js 22 backend.
2.  SQLite database with WAL mode.
3.  Browser-based web UI.
4.  Device CRUD.
5.  Shelly Gen2+ `Switch.GetStatus`.
6.  HTTP Digest Authentication.
7.  Independent 1-second collector per device.
8.  Raw telemetry storage.
9.  **7-day raw retention.**
10. WebSocket live updates.
11. Device status/error tracking.
12. Main dashboard.
13. Current W/V/A/Hz/°C.
14. Relay/output state.
15. Today's min/max.
16. Rolling 24h min/max.
17. Cumulative energy.
18. Today's energy.
19. Last-hour power graph.
20. 24h-peak gauge.
21. Basic device detail.
22. Generic Linux deployment/package.
23. macOS deployment/package.
24. Synology `.spk` as an additional packaging target.

The core MVP must be usable without Synology.

------------------------------------------------------------------------

## 22. Phase 2

Add:

-   5-minute aggregation;
-   daily aggregation;
-   automatic downsampling;
-   weekly/monthly/yearly statistics;
-   hour-of-day analysis;
-   day-of-week analysis;
-   day × hour heatmap;
-   multi-device charts;
-   combined device statistics;
-   custom date ranges;
-   CSV/JSON export;
-   richer device detail;
-   configurable retention.

------------------------------------------------------------------------

## 23. Future Possibilities

Potential later features:

-   MQTT ingestion instead of/in addition to HTTP polling;
-   automatic Shelly discovery;
-   configurable alerts;
-   electricity prices and cost calculations;
-   cost per device/day/month;
-   experiment sessions;
-   GNOME Shell extension/widget;
-   Prometheus endpoint;
-   Grafana-compatible API;
-   Shelly EM / Pro EM support;
-   other power-meter vendors;
-   Home Assistant integration;
-   notifications;
-   Shelly-side custom scripts;
-   virtual device groups;
-   compare periods (this week vs previous week, etc.);
-   Docker / OCI image;
-   Windows packaging.

------------------------------------------------------------------------

## 24. Important Implementation Details

### Sampling Scheduling

Do not use a naive global:

``` javascript
setInterval(pollAllDevices, 1000)
```

Each device needs independent scheduling.

Avoid concurrent overlapping requests to the same device.

### Time

Store timestamps in UTC.

Perform day/week/month grouping according to a configured application
timezone.

This matters around midnight and DST transitions.

### Energy Counter

Treat `aenergy.total` as a monotonically increasing counter only within
a continuous counter epoch.

Detect resets and discontinuities.

### SQLite Writes

Use transactions/batching where useful, but do not delay realtime
WebSocket updates unnecessarily.

### API History Resolution

Choose raw/5m/daily data based on range. Do not return seven days ×
86,400 points per device to a browser chart unless explicitly requested.

### Security

-   never expose stored passwords through API responses;
-   avoid logging credentials;
-   sanitize device names and user-provided metadata;
-   protect the application UI/API appropriately for the deployment
    environment.

### Packaging

Do not mix host-specific installation logic into the monitoring core.

Linux, macOS, and Synology packages should wrap the same application.

------------------------------------------------------------------------

## 25. Design Principle

> **Collect, retain, visualize, and analyze electrical power telemetry
> from smart plugs.**

Plug Power Analyser should be useful both as:

-   a simple household/device energy dashboard;
-   a detailed short-term telemetry source for technical experiments.

It should remain lightweight, local-first, and easy to deploy on
anything from a desktop Linux/macOS machine to an older Synology NAS.

------------------------------------------------------------------------

## License

MIT

## GIT

Remote: https://github.com/koduj-dev/plug-power-analyser
