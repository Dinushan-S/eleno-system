# Technical Architectural Blueprint: Offline-First Geospatial Knowledge Platform and Climate Diagnostic System

## 1. System Architecture & High-Level Operational Framework
Deploying an offline-first geospatial knowledge site for climate early warning and analytical intelligence addresses a critical operational imperative: delivering actionable, high-precision science to low-bandwidth, disconnect-prone field environments. Extreme hydro-climatological events driven by large-scale atmospheric teleconnections require continuous risk assessment, yet the regions most vulnerable to these disruptions often lack reliable network infrastructure.

This technical architecture bridges high-complexity climate teleconnections—such as the El Niño-Southern Oscillation (ENSO)—with edge-native web technologies. By decoupling analytical computation and geospatial rendering from network availability, field workers and local decision-makers receive immediate, high-precision risk profiles without reliance on continuous cloud connectivity.

The core architectural paradigm relies on a decoupled integration between:
1. **Model Context Protocol (MCP)** server environment (standardizing spatial calculations and diagnostic evaluations via JSON-RPC 2.0).
2. **Client-side edge storage runtimes** (Origin Private File System [OPFS] and IndexedDB).
3. **MapLibre GL JS / Vector SVG rendering engine**.

Traditional mapping architectures depend heavily on dynamic tile servers generating millions of individual web requests, an approach that rapidly degrades under spotty connectivity and fails entirely offline. This platform shifts heavy computational lookups and spatial data packaging directly to edge assets. Static baseline datasets, station climatologies, and single-file vector tile archives are stored locally.

On low-spec mobile hardware (e.g., quad-core ARM Cortex-A53 devices with 2 GB RAM), client-side spatial point-in-polygon queries against GeoJSON administrative boundaries stored in IndexedDB execute with a memory footprint under **$20\text{ MB}$** and latency under **$15\text{ ms}$**, completely bypassing network overhead.

### Dual-Mode Workflow (Online Synchronization vs. Offline Edge Execution)

| Operational Stage | Online Execution Pathway | Offline Execution Pathway | Network Payload / Bandwidth Impact |
| :--- | :--- | :--- | :--- |
| **1. Global ENSO Evaluation** | Fetches live Oceanic Niño Index (ONI) and Relative ONI (RONI) diagnostics via MCP Server Server-Sent Events (SSE) stream. | Reads last synchronized ocean diagnostic payload from local IndexedDB storage. | **Online**: $< 2\text{ KB}$ JSON payload.<br>**Offline**: $0\text{ KB}$. |
| **2. Location Detection** | Browser GPS coordinates converted via server geocoding API. | Browser GPS coordinates mapped via client-side IndexedDB point-in-polygon spatial query against GeoJSON boundaries. | **Online**: Minimal HTTP API request.<br>**Offline**: $0\text{ KB}$ (Executed locally in $<15\text{ ms}$). |
| **3. Anomaly Calculation** | Invokes `analyze_sri_lanka_location_drought` MCP Tool on remote server. | Computes Standardized Precipitation Index (SPI) locally against station Gamma distribution parameters stored in IndexedDB. | **Online**: $< 1\text{ KB}$ JSON payload.<br>**Offline**: $0\text{ KB}$. |
| **4. Map Basemap Rendering** | Fetches vector tile byte ranges via targeted HTTP Range Requests (`bytes=2048-4096`). | Reads single-file `.pmtiles` archive directly from browser Origin Private File System (OPFS) storage or renders vector SVG. | **Online**: Targeted range requests ($< 50\text{ KB}$ per view).<br>**Offline**: $0\text{ KB}$. |
| **5. Cross-District Analysis** | Invokes `compare_district_climate_symptoms` MCP Tool on remote server. | Compares selected district records locally using client JavaScript analytical engine against cached baselines. | **Online**: $< 3\text{ KB}$ JSON payload.<br>**Offline**: $0\text{ KB}$. |

---

## 2. Climate Diagnostic & Quantitative Analytics Engine
Climatological forecasting transitions from empirical statistical correlation into high-certainty deterministic warning signals when physical oceanography and coupled ocean-atmosphere mechanics satisfy critical instability thresholds.

The thermodynamic mechanism driving El Niño events is rooted in the accumulation of positive subsurface ocean heat content anomalies within the equatorial Pacific ($0\text{--}300\text{ m}$). Under normal conditions, trade winds maintain a steep thermocline slope across the Pacific Ocean, pooling warm surface water in the west and supporting cool coastal upwelling in the east. When deep subsurface heat content reaches extreme positive anomalies ($> +1.5^\circ\text{C}$), downwelling equatorial Kelvin waves propagate eastward along the thermocline. As these high-energy waves flatten the thermocline and surface in the central and eastern Pacific, anomalous sea surface temperature (SST) warming becomes physically inevitable.

This oceanic warming initiates the **Bjerknes feedback loop**, a positive ocean-atmosphere coupling sequence:
1. Elevated SSTs in the central and eastern Pacific weaken the equatorial zonal temperature gradient across the ocean basin.
2. The diminished surface temperature gradient slackens the easterly trade winds, generating low-level westerly wind anomalies at $850\text{ hPa}$ ($< -2.0\text{ m/s}$).
3. Weaker trade winds further reduce oceanic upwelling and deepen the eastern Pacific thermocline.
4. Deepening thermocline conditions accelerate surface warming, completing and reinforcing the self-sustaining thermodynamic cycle.

### Standardized Diagnostic Indices

| Metric / Index | Observation Region | Operational Threshold | Scientific Significance |
| :--- | :--- | :--- | :--- |
| **Oceanic Niño Index (ONI)** | Niño 3.4 ($5^\circ\text{N}\text{--}5^\circ\text{S}, 170^\circ\text{W}\text{--}120^\circ\text{W}$) | $\ge +0.5^\circ\text{C}$ for 5 consecutive overlapping 3-month seasons | Standard operational threshold for historical event classification and monitoring 3-month running mean SST departures. |
| **Relative Oceanic Niño Index (RONI)** | Niño 3.4 minus Tropical-Mean ($20^\circ\text{N}\text{--}20^\circ\text{S}$) SST Anomaly | $\ge +0.5^\circ\text{C}$ (NOAA) / $\ge +0.8^\circ\text{C}$ (BoM) | Subtracts background global tropical ocean warming to isolate true internal atmospheric convection gradients. |
| **Southern Oscillation Index (SOI)** | Surface air pressure difference: Tahiti minus Darwin | $\le -7.0$ to $-8.0$ sustained | Measures atmospheric pressure response and trade wind breakdown accompanying oceanic warming. |
| **Subsurface Heat Anomalies** | Central/Eastern Equatorial Pacific ($0\text{--}300\text{ m}$) | Volumetric heat content anomaly $> +1.5^\circ\text{C}$ | Physical thermal energy reservoir guaranteeing deterministic event evolution along the thermocline. |
| **Low-Level Zonal Wind Anomaly** | Equatorial Pacific ($850\text{ hPa}$) | Westerly anomaly $< -2.0\text{ m/s}$ | Confirms trade wind slackening required to maintain the positive Bjerknes feedback loop. |

### Mathematical Solver: Standardized Precipitation Index (SPI)
Fitting monthly precipitation records $x$ to a two-parameter Gamma probability density function:
$$g(x) = \frac{1}{\beta^\alpha \Gamma(\alpha)} x^{\alpha - 1} e^{-\frac{x}{\beta}} \quad \text{for } x > 0$$

Where $\alpha > 0$ is the shape parameter, $\beta > 0$ is the scale parameter, and $\Gamma(\alpha) = \int_0^\infty y^{\alpha-1} e^{-y} dy$.
Parameters $\alpha$ and $\beta$ are derived via maximum likelihood estimation over minimum 30-year station baselines. Accounting for non-precipitating periods ($x = 0$ with probability $q = P(x = 0)$):
$$H(x) = q + (1 - q) G(x)$$
Transformed into a standard normal variable $Z$ ($\mu=0, \sigma=1$):
$$\text{SPI} = Z = \text{Standard Normal Transformation of } H(x)$$

- **Moderate Drought**: $\text{SPI} = -1.00 \text{ to } -1.49$
- **Severe Drought**: $\text{SPI} = -1.50 \text{ to } -1.99$
- **Extreme Drought**: $\text{SPI} \le -2.00$

### Sri Lanka Seasonal Hydro-Climatology
1. **First Inter-Monsoon (FIM: March–April)**: Following an El Niño peak, up to 87% of monitoring stations exhibit severe precipitation deficits due to the Indo-Western Pacific Ocean Capacitor (IPOC) effect.
2. **Southwest Monsoon (SWM: May–September)**: Dynamics depend on post-El Niño decay velocity. Fast-Decaying (FD) events transition rapidly to La Niña, enhancing SWM rainfall over southwestern wet zone catchments. Slow-Decaying (SD) events maintain persistent Indian Ocean warming and WNP anticyclonic circulation, causing severe warm, dry summer droughts across inland agricultural zones.
3. **Second Inter-Monsoon (SIM: October–November)**: Widespread convective thunderstorm activity and cyclonic disturbances; represents the most reliable island-wide rainfall period, pre-filling major irrigation tanks.
4. **Northeast Monsoon (NEM: December–February)**: Provides primary water resources for northern and eastern dry zones. El Niño modulation causes either severe seasonal rainfall suppression or localized flood events.

---

## 3. Model Context Protocol (MCP) Tool Schemas
- `get_enso_diagnostic_state`: Evaluates Pacific SST anomalies, subsurface heat, and coupling status.
- `analyze_sri_lanka_location_drought`: Computes localized SPI against station baselines.
- `compare_district_climate_symptoms`: Cross-district comparative matrix across active ENSO phases.

---

## 4. Offline Vector Mapping Architecture & Web Storage Strategy
- **PMTiles Specification**: Replaces dynamic tile servers with a single-file archive container.
- **Origin Private File System (OPFS)**: Dedicated direct filesystem access for byte-range reading without thread blocking.
- **IndexedDB**: Relational and geospatial storage for GeoJSON boundaries and station Gamma parameters.
- **Service Worker Engine**: Cache-First for static assets; Network-First with Cache Fallback for live telemetry.
