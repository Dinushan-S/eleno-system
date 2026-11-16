# Sri Lanka El Niño Alert System (SLEnS) - Workspace Rules & Project Memory

This repository hosts the **Sri Lanka El Niño Alert & Climate Diagnostic System (SLEnS)**.
These instructions are automatically loaded for every session and conversation in this workspace.

---

## 1. Project Context & Mission
SLEnS is an offline-first, low-bandwidth Progressive Web App (PWA) and Model Context Protocol (MCP) climate diagnostic platform designed to detect and monitor localized El Niño impacts across Sri Lanka and globally.

- **Primary Goal**: Help users (including rural farmers in the Dry Zone with 2G/3G connections) verify whether their location is experiencing El Niño symptoms, compare microclimates across districts, and receive actionable advisories.
- **Scientific Standard**: Evaluates deterministic ocean-atmosphere thermodynamic coupling (~100% predictive certainty) rather than simple empirical probabilities.

---

## 2. Mandatory Core Documents (Always Consult for Context)
Whenever working on this project, ALWAYS reference the established technical and scientific documents in this directory:

1. **[`RESEARCH_NOTES.md`](./RESEARCH_NOTES.md)**:
   - Comprehensive synthesis of physical oceanography, Kelvin waves ($0\text{--}300\text{ m} > +1.5^\circ\text{C}$), the Bjerknes feedback loop, ONI, RONI, SOI, and low-level zonal winds.
   - Deep learning architectures overcoming the Spring Predictability Barrier (ConvLSTM, Geoformer, DualST).
   - Sri Lanka Bimodal Climate Whiplash (FIM IPOC effect, SWM/Yala severe drought, SIM thunderstorms, NEM/Maha flood risks).
   - Village Tank Cascade System (VTCS) vulnerability factors and dry-zone degradation mechanics.
   - Mathematical equations for the Standardized Precipitation Index (SPI via 2-parameter Gamma distribution with MLE and Abramowitz-Stegun approximation) and Rainfall Anomaly Index (RAI).
   - River basin hydrometric flood thresholds (Kelani, Kalu, Nilwala, Gin Ganga).
   - Complete bibliography of 79 citations.

2. **[`CONVERSATION_HISTORY.md`](./CONVERSATION_HISTORY.md)**:
   - Full chronicle and origin record from [Conversation a4c23fe5-c74b-4a5f-9a38-34aacb7009ba](conversation://a4c23fe5-c74b-4a5f-9a38-34aacb7009ba).

3. **[`implementation_plan.md`](./implementation_plan.md)**:
   - Detailed architecture, component breakdowns, MCP tool schemas, and PWA specifications.

4. **[`research/`](./research/)**:
   - `01_Technical_Architectural_Blueprint_Geospatial_Climate.md` (Offline-first geospatial systems, PMTiles, OPFS).
   - `02_Advanced_El_Nino_Monitoring_MCP_Sri_Lanka.md` (Climatological analysis, MCP schemas, Sri Lankan teleconnections).

---

## 3. Architectural Constraints & Rules
- **Stack**: Pure Vanilla HTML5, CSS3, and ES6 JavaScript modules. Zero heavy frontend framework runtimes.
- **Payload Budget**: Keep total static web app payload strictly under **$100\text{ KB}$** (currently $< 85\text{ KB}$).
- **Mapping**: Do NOT load raster map tiles (Google Maps / Mapbox). Use the interactive 25-district vector SVG map in `src/js/map.js` ($< 30\text{ KB}$) or PMTiles byte-range requests.
- **Offline & Storage Quota**: Comply with Apple iOS Safari WebKit **$50\text{ MB}$** origin cap:
  - Cache numerical JSON baselines instead of raster media.
  - Request `navigator.storage.persist()`.
  - Auto-prune telemetry older than 72 hours.
- **MCP Server**: Node.js JSON-RPC 2.0 server in `mcp_server/server.js` exposing `get_enso_diagnostic_state`, `analyze_sri_lanka_location_drought`, and `compare_district_climate_symptoms`.
- **Testing**: Run `node mcp_server/test_mcp.js` and `node test_server.js` before and after modifying climate solvers or assets.

---

## 4. Continuous Research & Findings Ingestion Directive
Whenever new research, climate findings, scientific papers, observational telemetry, or diagnostic methodologies are discussed, discovered, or uploaded in ANY future conversation:
1. **Save to `research/` Folder**: Immediately document the full findings, mathematical models, or technical breakdown as a new markdown document inside the `research/` folder (e.g. `research/<XX_topic_name>.md`).
2. **Update `RESEARCH_NOTES.md`**: Synthesize the key conclusions, formulas, and citations into the master [`RESEARCH_NOTES.md`](./RESEARCH_NOTES.md).
3. **Preserve User Files**: If the user attaches or shares research documents (PDFs, text, datasets), ensure they are permanently archived and cross-referenced in the `research/` directory.
