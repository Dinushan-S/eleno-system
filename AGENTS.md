# Sri Lanka El Niño Alert System (SLEnS) - Agent Guidelines & Context

This file is automatically loaded by AI coding agents when working in this project.

See [GEMINI.md](./GEMINI.md) for full workspace rules.

## Core Directives for Agents:
1. **Always reference [RESEARCH_NOTES.md](./RESEARCH_NOTES.md)** for physical oceanography principles, mathematical models (SPI Gamma distribution & RAI), Sri Lanka seasonal whiplash dynamics, and VTCS multipliers.
2. **Continuous Research Tracking**: Whenever new research, scientific papers, observational datasets, or climate findings are discovered or uploaded, immediately create a new detailed markdown note in the `research/` directory and update `RESEARCH_NOTES.md`.
3. **Maintain strict offline-first, low-data principles**: bundle payload under 100 KB, SVG vector maps instead of raster tiles, and WebKit 50 MB storage compliance.
4. **Validate all changes** using `node mcp_server/test_mcp.js` and `node test_server.js`.
