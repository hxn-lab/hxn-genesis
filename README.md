# HXN GENESIS 3.0 — Ultimate Planet Creator & Living World Sandbox

**HXN GENESIS 3.0** is a real-time, interactive 3D planetary creation, climate, geology, and evolution sandbox built with TypeScript, Three.js, and Vite. It couples a standalone physical & evolutionary simulation core with a WebGL 3D globe renderer, a first-run interactive 10-step tutorial, progressive **Creator / Advanced** UI modes, and a bilingual (**🇬🇧 English / 🇻🇳 Tiếng Việt**) dark-mode God Mode interface.

Every new world starts strictly **abiotic** (0% life). You can forge a planet from scratch, customize its physical & orbital parameters, sculpt continents and trenches with 12 brush tools, regulate atmospheric gases and tectonic activity, introduce life (or let deep-time abiogenesis spark it naturally), and observe evolution and recovery across billions of years.

---

## Table of Contents

1. [Overview & Implemented Features](#1-overview--implemented-features)
2. [Screenshots & How to Capture Visuals](#2-screenshots--how-to-capture-visuals)
3. [Hardware & Software Requirements](#3-hardware--software-requirements)
4. [Installing Node.js, npm, and Git (Windows, Linux, macOS)](#4-installing-nodejs-npm-and-git-windows-linux-macos)
5. [Downloading the Source Code](#5-downloading-the-source-code)
6. [Opening the Terminal in the Project Directory](#6-opening-the-terminal-in-the-project-directory)
7. [Installing Dependencies & Launching the Application](#7-installing-dependencies--launching-the-application)
8. [Running Tests, Benchmarks & Production Builds](#8-running-tests-benchmarks--production-builds)
9. [User Guide: God Mode, Visualization Layers, Time Controls & Save/Load](#9-user-guide-god-mode-visualization-layers-time-controls--saveload)
10. [Troubleshooting Common Issues](#10-troubleshooting-common-issues)
11. [Project Directory Structure & Module Architecture](#11-project-directory-structure--module-architecture)
12. [Scientific Model Assumptions & Known Limitations](#12-scientific-model-assumptions--known-limitations)
13. [License, Contributing & Contact](#13-license-contributing--contact)

---

## 1. Overview & Implemented Features

### Planet Creation Wizard & Physical Properties (`src/sim/planetPhysics.ts`, `src/sim/terrainGen.ts`)
- **Physical & Orbital Customization**: Customize planet name, deterministic seed, radius (`1500–16000 km`), mass (`0.02–12 M⊕`), rotation period (`4–240 hr`), axial tilt (`0°–60°`), host star spectral class (`M`, `K`, `G`, `F`), orbital semi-major axis (`0.05–5 AU`), and eccentricity (`0–0.6`).
- **Derived Physics & Overrides**: Automatically derives surface gravity ($g = GM/R^2$), bulk density ($\rho$), escape velocity ($v_e$), gravity-scaled adiabatic lapse rate ($\Gamma \propto g$), and stellar insolation ($S/S_0$), with an optional manual gravity override.
- **10 Procedural Terrain Styles**: `EARTH_CONTINENTS`, `ARCHIPELAGO`, `SUPERCONTINENT`, `OCEAN_PLANET`, `DESERT_PLANET`, `ICE_WORLD`, `VOLCANIC_WORLD`, `CRATERED_WORLD`, `ALIEN`, and `CUSTOM`, with configurable roughness, mountain height, continent feature size, crater density, and plateau terracing.
- **Hypsometric Ocean Coverage Solver**: Set any target ocean coverage (`0%–100%`) and the solver computes the spherical area-weighted elevation percentile to position sea level accurately.

### 3D Terrain Sculpting Workshop & Geology (`src/sim/sculpt.ts`, `src/sim/geology.ts`)
- **12 Interactive Spherical Brushes**: `RAISE`, `LOWER`, `SMOOTH`, `FLATTEN`, `MOUNTAIN_RANGE`, `CARVE_BASIN`, `CRATER`, `PAINT_OCEAN`, `PAINT_LAND`, `ADD_ICE`, `REMOVE_ICE`, and `RESTORE` (restores pristine procedural relief), with selectable falloff (`SMOOTH`, `LINEAR`, `CONSTANT`), footprint shape (`CIRCLE`, `RING`, `RIDGE`), and stroke symmetry (`NONE`, `LONGITUDE_MIRROR`, `EQUATOR_MIRROR`).
- **Planetary Interior & Plate Tectonics**: Configure internal radiogenic heat, crustal thickness (`km`), mantle plume activity, and tectonic boundary uplift rate, or trigger a spherical Voronoi **Tectonic Uplift Pulse** that builds mountain belts, rifts trenches, and outgasses $\text{CO}_2$.

### Interactive 3D Planetary Viewport (`src/render/planetRenderer.ts`)
- **Radius-Scaled 3D Globe & Graticule**: Scales the 3D planet root group according to planet radius, renders an optional 3D Latitude/Longitude graticule with equator/prime-meridian highlights and polar rotation axis (`G` key), and provides quick camera presets (`Default`, `North Pole`, `Equator`, `South Pole`).
- **Dynamic Hydrosphere, Cryosphere & Atmosphere**: Specular ocean sphere, polar sea-ice packs, continental glaciers, propagating tsunami rings, Fresnel/Rayleigh atmospheric halo, and dynamic cloud/ash `DataTexture`.
- **12 Real-Time Data Overlays**: `True Color`, `Biosphere Composite`, `Habitability Index`, `Flora Biomass`, `Fauna Density`, `Biodiversity (H')`, `Extinction Stress`, `Surface Temp`, `Crust Elevation`, `Precipitation`, `Cryosphere Ice`, and `Wind Velocity`.

### Coupled Atmosphere, Biosphere & Evolution Core (`src/sim/world.ts`, `src/sim/atmosphere.ts`, `src/sim/evolution.ts`)
- **Gas Composition & Pressure Broadening**: Explicitly tracks surface pressure (`bar`), $\text{O}_2$ (`%`), $\text{CO}_2$ (`ppm`), and Argon (`%`), with $\text{N}_2$ acting as the sole balance gas so editing one gas never silently alters another tracked gas.
- **Abiogenesis, Lineages & Natural Selection**: Supports spontaneous deep-time marine abiogenesis, localized/global seeding (`MICROBES`, `FLORA`, `FAUNA`), heritable quantitative traits, adaptive radiation, and trophic guilds.
- **Unified God Mode & Global Experiments (`src/sim/events.ts`)**: Trigger localized hazards (`Volcano`, `Earthquake`, `Tsunami`, `Storm`, `Drought`, `Flood`, `Meteor`) or global planetary experiments (`Global Cooling`, `Rapid Greenhouse`, `Atmosphere Loss`, `Ocean Loss`, `Ecological Recovery`, `Sterilize`), with full Undo/Redo.

### First-Run Interactive Tutorial, Creator/Advanced Mode & Bilingual UI (`src/ui/tutorial.ts`, `src/i18n/index.ts`)
- **Welcome Screen & 10-Step Guided Tour**: Non-blocking interactive tour with spotlight highlighting, step dots, `Back`, `Next`, `Skip`, and `Finish`, plus a searchable **Help & Shortcuts** modal (`?` or `H`).
- **Progressive Disclosure (`Creator` vs. `Advanced` Mode)**: Switch between a streamlined Creator interface and the full Advanced scientific dashboard (`M` key).
- **Instant Bilingual Interface**: One-click toggle (`🇬🇧 English` / `🇻🇳 Tiếng Việt`) translates every label, tooltip, tutorial step, help topic, preset, and telemetry readout in real time.

---

## 2. Screenshots & How to Capture Visuals

No pre-rendered static screenshots are bundled in the repository to keep the repository lightweight and 100% code-driven. Once you launch the app locally (`npm run dev`), you can capture high-resolution visuals directly:

1. Open `http://127.0.0.1:5173/` in Chrome, Edge, or Firefox.
2. Select a preset (e.g., **Volcanic World** or **Earth-like**) or switch between the **6 Data Visualization Layers** (*Surface Temp*, *Crust Elevation*, *Wind Velocity*, etc.).
3. Trigger a **Volcano** or **Tsunami** on the globe for dramatic 3D displacement and atmospheric ash/wave rings.
4. Capture a screenshot:
   - **Windows**: Press `Win + Shift + S`
   - **Linux**: Press `PrtSc` or `Shift + PrtSc`
   - **macOS**: Press `Cmd + Shift + 4`

---

## 3. Hardware & Software Requirements

### Hardware Requirements
- **CPU**: Dual-core x86_64 or ARM64 processor (Quad-core recommended for high-speed `COARSE_TIME` sub-stepping).
- **RAM**: Minimum 2 GB free memory (the simulation core itself uses $< 10\text{ MB}$ heap for the default `144 × 72` grid).
- **GPU**: Integrated or discrete graphics card supporting **WebGL 2.0**.

### Software Requirements
- **Operating System**: Windows 10/11, Linux (Ubuntu 20.04+, Debian, Fedora, Arch), or macOS 12+.
- **Node.js**: `>= 20.0.0` LTS (verified on Node.js `v26.11.1`).
- **npm**: `>= 10.0.0` (verified on npm `v12.2.0`, bundled with Node.js).
- **Git**: `>= 2.30` (optional if downloading as a ZIP archive).
- **Web Browser**: Chrome 110+, Edge 110+, Firefox 115+, or Safari 16.4+ with hardware acceleration enabled.

---

## 4. Installing Node.js, npm, and Git (Windows, Linux, macOS)

### Windows (10 / 11)
1. **Using Winget (Recommended)**:
   Open PowerShell or Command Prompt and run:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install Git.Git
   ```
2. **Or via Official Installers**:
   - Download the Windows `.msi` installer from [https://nodejs.org/](https://nodejs.org/) (choose LTS v20 or v22+).
   - Download Git for Windows from [https://git-scm.com/download/win](https://git-scm.com/download/win).
3. Restart your terminal and verify:
   ```powershell
   node -v
   npm -v
   git --version
   ```

### Linux (Ubuntu / Debian / Fedora / Arch)
- **Ubuntu / Debian**:
  ```bash
  sudo apt update
  sudo apt install -y curl git
  # Install Node.js via fnm or NodeSource (v22 LTS example):
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
- **Fedora**:
  ```bash
  sudo dnf install -y nodejs npm git
  ```
- **Arch Linux**:
  ```bash
  sudo pacman -S nodejs npm git
  ```
- Verify installation:
  ```bash
  node -v && npm -v && git --version
  ```

### macOS (Intel & Apple Silicon)
1. **Using Homebrew (Recommended)**:
   ```bash
   brew install node git
   ```
2. **Or via Official `.pkg` Installer**:
   Download the macOS installer from [https://nodejs.org/](https://nodejs.org/).
3. Verify installation:
   ```bash
   node -v && npm -v && git --version
   ```

---

## 5. Downloading the Source Code

### Option A: Clone via Git (Recommended)
```bash
git clone <YOUR_GITHUB_REPOSITORY_URL> HXN
```

### Option B: Download ZIP from GitHub
1. Click the green **`<> Code`** button on the GitHub repository page.
2. Select **Download ZIP**.
3. Extract the `.zip` archive to a folder on your computer (for example, `C:\Projects\HXN` on Windows or `~/HXN` on Linux/macOS).

---

## 6. Opening the Terminal in the Project Directory

Navigate into the root directory containing `package.json` and `index.html`:

- **Linux / macOS**:
  ```bash
  cd /path/to/HXN
  pwd && ls -la
  ```
- **Windows (PowerShell / CMD)**:
  ```powershell
  cd C:\path\to\HXN
  dir
  ```

Confirm that `package.json`, `package-lock.json`, `requirements.txt`, and `index.html` are visible in the current directory.

---

## 7. Installing Dependencies & Launching the Application

### About `package.json`, `package-lock.json`, and `requirements.txt`
- **Important**: HXN GENESIS is a **Node.js / TypeScript** application, **not** a Python project.
- [`requirements.txt`](./requirements.txt) and [`requirements-dev.txt`](./requirements-dev.txt) are provided as human-readable system and dependency reference manifests. **Do not** run `pip install -r requirements.txt`.
- [`package.json`](./package.json) and [`package-lock.json`](./package-lock.json) are the canonical manifests used by `npm`.

### Step 1: Install Dependencies
If `package-lock.json` is present (recommended for an exact, reproducible dependency tree):
```bash
npm ci
```
Or use standard `npm install`:
```bash
npm install
```

### Step 2: Launch the Local Development Server
```bash
npm run dev
```
Vite will start the local server in under 1 second and print:
```text
  VITE v6.4.4  ready in ~200 ms

  ➜  Local:   http://127.0.0.1:5173/
```

### Step 3: Open the Interface
Open **`http://127.0.0.1:5173/`** in your web browser.

---

## 8. Running Tests, Benchmarks & Production Builds

All scripts are defined in [`package.json`](./package.json) and verified against the codebase:

### 1. Run Automated Unit & Integration Tests (`vitest`)
```bash
npm test
```
Runs 9 test suites in [`tests/sim.test.ts`](./tests/sim.test.ts) verifying:
- Deterministic seed terrain & climate reproducibility.
- Scientific speed parsing and mode classification up to `1e100x`.
- Numerically safe time accumulation from seconds to `1e100` seconds without `NaN` or `Infinity`.
- Pause, resume, and single-step accuracy.
- Coupled $\text{CO}_2$ and solar luminosity radiative forcing and ice melt response.
- God Mode terrain sculpting, volcanic hazard state mutation, and Undo/Redo stack integrity.
- Save/Load JSON snapshot round-trip serialization.
- Numerical stability under extreme speeds (`1e6x`, `1e9x`, `1e100x`).
- Bilingual i18n dictionary completeness (`en` / `vi`), two-way toggling, and `localStorage` persistence.

### 2. Run Real Simulation Performance Benchmarks (`tsx`)
```bash
npm run bench
```
Executes [`src/sim/benchmark.ts`](./src/sim/benchmark.ts) in Node.js to measure initialization time, `REALTIME` step latency, `COARSE_TIME` (`1e6x`) frame latency, and heap memory usage across `72×36`, `144×72`, and `288×144` spherical grids.

**Sample Verified Benchmark Output (Node.js v26.11.1 on Linux):**
```text
=== HXN GENESIS — REAL SIMULATION PERFORMANCE BENCHMARK ===
Grid 72x36 (2592 cells)   | Init: 38.1 ms | REALTIME Step: 1.71 ms (584 FPS ceiling) | COARSE (1e6x) Frame: 7.88 ms  | Heap Δ: ~3946 KB
Grid 144x72 (10368 cells) | Init: 35.0 ms | REALTIME Step: 5.73 ms (175 FPS ceiling) | COARSE (1e6x) Frame: 26.72 ms | Heap Δ: ~294 KB
Grid 288x144 (41472 cells)| Init: 78.7 ms | REALTIME Step: 21.50 ms (47 FPS ceiling) | COARSE (1e6x) Frame: 83.72 ms | Heap Δ: ~128 KB
```

### 3. Build & Preview Production Bundle
```bash
npm run build
npm run preview
```
- `npm run build` runs `tsc --noEmit` (strict TypeScript type check) followed by `vite build`, outputting optimized static assets to `dist/`.
- `npm run preview` serves the production build locally at `http://127.0.0.1:4173/`.

---

## 9. User Guide: God Mode, Visualization Layers, Time Controls & Save/Load

### Language Switching (`🇬🇧 English` / `🇻🇳 Tiếng Việt`)
- Click the language button in the **top-right corner** of the Top Bar to switch the entire UI between English and Vietnamese immediately without reloading the page. Your preference is saved automatically in `localStorage`.

### Camera & 3D Globe Navigation
- **Orbit / Rotate**: Left-click + drag on the globe or background space.
- **Zoom**: Scroll wheel or two-finger pinch.
- **Select / Apply Tool at Coordinate**: Single click (without dragging) on any location on the 3D planet. A cyan target ring marks the active coordinate.

### Time Controls (Top Bar)
- **Pause / Resume (`⏸` / `▶`)**: Freeze or resume simulation progression.
- **Single Step (`⏭`)**: Advance exactly one 10-minute (`600 s`) physics step while paused.
- **Speed Presets**: Click `1x`, `2x`, `10x`, `100x`, `1,000x`, `1e6x`, `1e9x`, or `1e100x`.
- **Custom Scientific Speed**: Enter any scientific multiplier (e.g., `2.5e4`, `1e12`, `5e40`, `1e100`) and click **Set Speed**.

### Left Panel Tabs
1. **World & Seed**:
   - Choose among **12 reproducible planetary scenarios** (*Earth-like*, *Habitable Young Planet*, *Ice World*, *Desert World*, *Ocean World*, *Volcanic World*, *Rapid Greenhouse*, *Glaciation & Recovery*, *Mass Extinction Testbed*, *Isolated Evolution*, *Low-Oxygen Biospheres*, *Custom*).
   - Enter any custom **Deterministic Seed** and click **Generate**.
   - Select **3D Render Quality Preset** (*High*, *Medium*, *Low*).
   - Adjust **Sea Level Datum Offset** (`-5000 m` to `+5000 m`), **Crust Relief Scale**, and **Cryosphere Ice Target Impulse**.
   - Switch between the **12 Data Visualization Layers** (`True Color`, `Biosphere Composite`, `Habitability Index`, `Flora Biomass`, `Fauna Density`, `Biodiversity (H')`, `Extinction Stress`, `Surface Temp`, `Crust Elevation`, `Precipitation`, `Cryosphere Ice`, `Wind Velocity`).
   - Use **Undo**, **Redo**, **Partial Reset** (climate only), or **Full Reset**.
2. **Atmosphere**:
   - Adjust **Atmospheric $\text{CO}_2$** (`50` to `8000 ppm`), **Atmospheric $\text{O}_2$**, **Photosynthetic $\text{O}_2$ Yield Multiplier**, **Spontaneous Abiogenesis**, **Solar Luminosity** ($0.4\text{–}2.0\,S_0$), **Axial Tilt** ($0^\circ\text{–}60^\circ$), **Manual Thermal Forcing Offset**, **Diurnal Day/Night Cycle**, **Humidity Capacity**, **Global Wind Circulation**, **Precipitation Efficiency**, and **Background Volcanism**.
3. **Life & Hazards**:
   - Adjust **Genetic Mutation Rate**, **Natural Selection Pressure**, **Biotic Reproduction Multiplier**, and **Extinction Susceptibility**.
   - Click **Bloom Global Biosphere** or **Sterilize All Life** (with confirmation safeguard).
   - Select an interactive click tool (`Inspect Only`, `Seed Microbes`, `Seed Flora/Forest`, `Seed Fauna/Animals`, `Raise Crust`, `Excavate Trench`, `Erupt Volcano`, `Fault Earthquake`, `Tsunami Impulse`, `Super Cyclone`, `Regional Drought`, `Mega Flood`, `Meteor Strike`), configure **Brush Radius** and **Intensity** (with live 3D hover radius ring), and click directly on the 3D planet.
4. **🧬 Evo Lab (Evolution Lab & Phylogeny)**:
   - View real-time HTML5 Canvas time-series charts for **Biomass & Fauna**, **Biodiversity ($H'$) & Living Species**, **Surface Temp & Habitability**, or **Atmospheric $\text{O}_2$ & $\text{CO}_2$**.
   - Search and inspect all extant and extinct **Species Lineages**, viewing their binomial name, trophic guild (`MICROBE_CHEMO`, `PRODUCER_FLORA`, `HERBIVORE_GRAZER`, `APEX_PREDATOR`), ancestor lineage, quantitative traits ($T_{\text{opt}}$, $\text{O}_2$ requirement, hazard resilience), evolutionary innovations, population share, and optional single-species extirpation.
5. **Save & Log**:
   - Save named **Checkpoints** to browser `localStorage` and restore them with one click (supporting backward compatibility across v1, v2, and v3 snapshots).
   - Click **Export JSON** to download a full `.json` snapshot file of the planet, or **Import JSON** to restore a saved file.

---

## 10. Troubleshooting Common Issues

### 1. `npm warn install-scripts ... esbuild postinstall blocked`
Some newer npm configurations block postinstall scripts by default. Vite and Vitest still work normally on standard x64 Linux/macOS/Windows environments, or you can run `npm rebuild esbuild` if `esbuild` binary resolution fails on your platform.

### 2. Port `5173` is already in use
If another Vite process is using port `5173`, run Vite on a custom port:
```bash
npx vite --host 127.0.0.1 --port 5180
```

### 3. Blank or black 3D viewport in browser
- Ensure **WebGL 2.0** and hardware acceleration are enabled in your browser settings (`chrome://gpu` in Chrome/Edge or `about:support` in Firefox).
- If running inside a headless VM or remote desktop without GPU passthrough, enable software WebGL rendering in Chrome (`--enable-unsafe-swiftshader`).

### 4. Snapshot JSON Import Fails
Ensure the imported `.json` file was exported from HXN GENESIS with matching grid dimensions (`144 × 72` by default). Corrupted or truncated JSON files will trigger a descriptive error alert without crashing the running simulation.

---

## 11. Project Directory Structure & Module Architecture

```text
HXN-GENESIS/
├── .gitignore                  # Standard Git ignore rules (node_modules, dist, logs)
├── index.html                  # Main application HTML shell with 3.0 Creator/Advanced UI & modals
├── package.json                # npm scripts, Node >=20 engine spec, and dependencies (v3.0.0)
├── package-lock.json           # Locked npm dependency tree for reproducible installs
├── requirements.txt            # Human-readable system & runtime dependency reference (non-pip)
├── requirements-dev.txt        # Human-readable development/test dependency reference (non-pip)
├── tsconfig.json               # TypeScript compiler configuration (ES2022, strict mode)
├── vite.config.ts              # Vite dev server (127.0.0.1:5173) and Vitest configuration
├── README.md                   # Complete installation, architecture, and user documentation
├── src/
│   ├── main.ts                 # UI controller, tutorial/library wiring, charts & event bindings
│   ├── style.css               # Dark-mode Glassmorphism layout, modals, tutorial & Creator mode styles
│   ├── i18n/
│   │   └── index.ts            # Centralized English/Vietnamese translation dictionaries & I18nManager
│   ├── persistence/
│   │   └── worldStore.ts       # WorldLibraryManager, v1–v4 migration & validated JSON import/export
│   ├── render/
│   │   └── planetRenderer.ts   # Three.js 3D globe, radius scaling, graticule/axis, ocean, clouds, halo
│   ├── ui/
│   │   ├── tutorial.ts         # First-run Welcome screen, 10-step guided tour, UI mode & Help catalog
│   │   └── shortcuts.ts        # Keyboard shortcut registry and dispatcher
│   └── sim/                    # Pure TypeScript simulation core (zero DOM or Three.js dependencies)
│       ├── world.ts            # Coupled climate, biosphere, evolution, hydrology, geology & hazards
│       ├── planetPhysics.ts    # Physical/orbital properties, gravity/density/escape/lapse derivation
│       ├── terrainGen.ts       # 10 procedural TerrainStyle generators & hypsometric ocean solver
│       ├── sculpt.ts           # 12 spherical terrain & cryosphere brushes with falloff/shape/symmetry
│       ├── atmosphere.ts       # Gas composition (O2, CO2, Ar, N2 filler) & pressure-broadened forcing
│       ├── geology.ts          # Internal heat, crust thickness & Voronoi plate boundary uplift pulses
│       ├── events.ts           # Global planetary experiments & destructive confirmation rules
│       ├── evolution.ts        # Population-based EvolutionEngine, traits, selection & speciation
│       ├── time.ts             # Numerically safe SafeSimTimeState, SciNumber & 5 time execution modes
│       ├── rng.ts              # Deterministic Mulberry32 PRNG & 3D Perlin / Ridged Multifractal noise
│       ├── presets.ts          # 12 planetary scenarios (Earth-like, Young Planet, Greenhouse, etc.)
│       ├── types.ts            # TypeScript interfaces for simulation state, telemetry & v4 snapshots
│       └── benchmark.ts        # CLI performance benchmark across spherical grid resolutions
└── tests/
    └── sim.test.ts             # Vitest unit & integration test suite (18 comprehensive acceptance tests)
```

---

## 12. Scientific Model Assumptions & Known Limitations

HXN GENESIS implements physically motivated, coupled reduced-complexity models designed to run interactively at 60 FPS in a browser while remaining numerically stable across arbitrary timescales:

1. **2D Vertically Integrated Atmosphere & Ocean**:
   - The simulation operates on a 2D spherical lat-lon surface grid (`144 × 72` cells by default) using vertically integrated column heat and moisture transport rather than a 3D multi-layer primitive-equation General Circulation Model (GCM).
2. **Radiative Transfer Approximation**:
   - $\text{CO}_2$ forcing uses the standard IPCC logarithmic formula $\Delta F = 5.35 \ln(C / 280)\text{ W/m}^2$ coupled with water vapor column feedback and Stefan-Boltzmann outgoing longwave radiation ($\epsilon_{\text{eff}} \sigma T^4$). Band-by-band line-by-line radiative transfer is not computed.
3. **Tsunami & Seismic Propagation**:
   - Submarine earthquakes and tsunami impulses propagate radially on the sphere with depth-dependent coastal shoaling amplification rather than solving full 2D non-linear shallow-water momentum equations at every fine step.
4. **Deep-Time Geomorphology & Analytical Modes (`> 1e6x` to `1e100x`)**:
   - As required by numerical honesty, the engine never claims to execute $10^{100}$ discrete integration steps. In `ANALYTICAL_ADVANCE` and `VISUAL_TIME_WARP` modes, short-lived weather transients decay, $\text{CO}_2$ relaxes toward a volcanic-silicate weathering balance, continental relief undergoes bounded exponential peneplanation balanced by tectonic rejuvenation, and the exact ratio of computed vs. bypassed steps is displayed in the telemetry panel.
5. **Continental Drift (Wilson Cycles)**:
   - Local crust uplift/subsidence, fault displacement, volcanic cone growth, and fluvial/thermal erosion are simulated; full horizontal tectonic plate advection across hundreds of millions of years is not yet modeled.

---

## 13. License, Contributing & Contact

- **Project**: HXN GENESIS — Infinite-Time Planetary Environment Sandbox
- **Status**: Private / Local Sandbox Repository (`"private": true` in `package.json`). No open-source license file is currently declared in the repository root; all rights remain with the repository owner unless a `LICENSE` file is added.
- **Contributing**:
  1. Ensure all existing and new tests pass via `npm test`.
  2. Verify strict TypeScript compilation and production bundling via `npm run build`.
  3. Keep `src/sim/` independent of rendering and DOM APIs, and add both `en` and `vi` keys in `src/i18n/index.ts` for any new UI text.
