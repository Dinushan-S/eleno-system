/**
 * Sri Lanka El Niño Alert System (SLEnS) - Main Application Coordinator
 * - Offline-first execution via IndexedDB & Service Worker
 * - Dual Mode: Sri Lanka District Deep-Dive & Global Search
 * - Mathematical SPI / RAI & Bimodal Monsoon Diagnostic
 * - Interactive Vector Map & Low-Data Data-Saver Mode
 */

import { db } from './db.js';
import { ClimateSolver } from './spi.js';
import { WeatherClient } from './weather.js';
import { SriLankaVectorMap } from './map.js';

class SLEnSApp {
  constructor() {
    this.districts = [];
    this.ensoBaseline = null;
    this.activeDistrict = null;
    this.comparisonDistrict = null;
    this.currentLanguage = 'en';
    this.map = null;
    this.deferredPrompt = null;
  }

  async init() {
    console.log('[SLEnS] Initializing application...');
    this.setupNetworkStatusListener();
    this.setupPWAInstall();

    // 1. Initialize local IndexedDB
    await db.init();

    // 2. Load district datasets & ENSO baseline
    await this.loadInitialDatasets();

    // 3. Mount Vector SVG Map
    this.initMap();

    // 4. Render Global Macro ENSO Bar
    this.renderGlobalEnsoStatus();

    // 5. Setup UI Event Listeners
    this.bindEvents();

    // 6. Select default high-vulnerability district (Vavuniya - Dry Zone VTCS)
    const defaultDistrict = this.districts.find((d) => d.id === 'vavuniya') || this.districts[0];
    this.selectDistrict(defaultDistrict.id);

    // 7. Calculate and apply island-wide heatmap colors
    this.refreshAllDistrictHeatmaps();
  }

  /**
   * Load datasets from local cache or JSON bundle
   */
  async loadInitialDatasets() {
    try {
      // Load districts
      let cachedDistricts = await db.getAllDistricts();
      const isLegacy = cachedDistricts && cachedDistricts.some((d) => !d.svg_path || d.svg_path.length < 100);
      if (!cachedDistricts || cachedDistricts.length === 0 || isLegacy) {
        const res = await fetch('./src/data/districts_sri_lanka.json');
        const data = await res.json();
        this.districts = data.districts;
        await db.saveDistricts(this.districts);
      } else {
        this.districts = cachedDistricts;
      }

      // Load ENSO baseline
      const ensoRes = await fetch('./src/data/enso_baseline.json');
      this.ensoBaseline = await ensoRes.json();
      await db.saveEnsoState(this.ensoBaseline.current_enso_state);

      this.populateDistrictDropdowns();
    } catch (err) {
      console.error('[SLEnS] Failed to load datasets:', err);
    }
  }

  /**
   * Populate district selectors
   */
  populateDistrictDropdowns() {
    const mainSelect = document.getElementById('district-select');
    const compSelect = document.getElementById('compare-district-select');

    if (!mainSelect) return;
    mainSelect.innerHTML = '';
    compSelect.innerHTML = '<option value="">-- Choose Comparison Area --</option>';

    for (const d of this.districts) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name} (${d.zone} Zone)`;
      mainSelect.appendChild(opt);

      const compOpt = document.createElement('option');
      compOpt.value = d.id;
      compOpt.textContent = `${d.name} (${d.zone} Zone)`;
      compSelect.appendChild(compOpt);
    }
  }

  /**
   * Initialize Vector SVG Map
   */
  initMap() {
    this.map = new SriLankaVectorMap({
      containerId: 'map-container',
      onSelectDistrict: (district) => {
        this.selectDistrict(district.id);
      }
    });
    this.map.render(this.districts);
  }

  /**
   * Select a district and perform real-time or cached diagnostic
   */
  async selectDistrict(districtId) {
    const district = this.districts.find((d) => d.id === districtId);
    if (!district) return;
    this.activeDistrict = district;

    // Update dropdown value
    const selectElem = document.getElementById('district-select');
    if (selectElem) selectElem.value = districtId;

    // Fetch weather telemetry (network or cached offline)
    const weather = await WeatherClient.fetchWeatherForCoordinate(district.lat, district.lon, district.id);

    // Current month (1-12)
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const baselineRain = district.monthly_rainfall[currentMonth - 1];
    const baselineTemp = district.monthly_temp[currentMonth - 1];

    // Compute localized symptoms via scientific solver
    const diag = ClimateSolver.diagnoseDistrictSymptoms({
      observedRainfall: weather.estimatedMonthlyMm,
      baselineRainfall: baselineRain,
      observedTemp: weather.temperature,
      baselineTemp: baselineTemp,
      month: currentMonth,
      zone: district.zone,
      vtcsRiskMultiplier: district.vtcs_risk_multiplier,
      nino34Anomaly: this.ensoBaseline.current_enso_state.nino34_sst_anomaly,
      isSriLanka: true
    });

    this.renderDistrictDiagnostic(district, weather, diag);

    // Update comparison if active
    if (this.comparisonDistrict) {
      this.runComparison();
    }
  }

  /**
   * Render diagnostic results to the DOM
   */
  renderDistrictDiagnostic(district, weather, diag) {
    // District Title & Badges
    document.getElementById('diag-district-name').textContent = `${district.name} / ${district.name_si} / ${district.name_ta}`;
    document.getElementById('diag-zone-badge').textContent = `${district.zone} Zone`;
    document.getElementById('diag-basin-info').textContent = `River Basin / Hydrology: ${district.river_basin}`;

    // Symptom Score & Tier
    const scoreElem = document.getElementById('symptom-score');
    scoreElem.textContent = `${diag.symptomScore}%`;
    scoreElem.style.color = diag.alertColor;

    const tierElem = document.getElementById('symptom-tier-badge');
    tierElem.textContent = diag.riskTier;
    tierElem.style.backgroundColor = diag.alertColor;
    tierElem.style.color = '#ffffff';

    document.getElementById('primary-symptom-desc').textContent = diag.primarySymptom;

    // Detailed metrics
    document.getElementById('metric-spi').textContent = diag.spi.toFixed(2);
    document.getElementById('metric-rai').textContent = diag.rai.toFixed(2);
    document.getElementById('metric-rain-anomaly').textContent = `${diag.rainPctDiff > 0 ? '+' : ''}${diag.rainPctDiff}%`;
    document.getElementById('metric-temp-anomaly').textContent = `${diag.tempAnomaly > 0 ? '+' : ''}${diag.tempAnomaly}°C`;
    document.getElementById('metric-current-temp').textContent = `${weather.temperature}°C`;
    document.getElementById('metric-recent-rain').textContent = `${weather.recentRainfallMm} mm (past 14d)`;

    // Village Tank Cascade System (VTCS)
    const vtcsElem = document.getElementById('vtcs-status');
    vtcsElem.textContent = `${diag.vtcsVulnerability} (Multiplier: ${district.vtcs_risk_multiplier}x)`;
    vtcsElem.style.color = district.vtcs_risk_multiplier > 1.3 ? '#ef4444' : '#10b981';

    // WIBI Insurance Strike Status
    const wibiElem = document.getElementById('wibi-status');
    if (diag.wibiTriggered) {
      wibiElem.innerHTML = `<span style="color:#ef4444; font-weight:700;">⚠️ STRIKE TRIGGERED (SPI ≤ -1.50)</span> - Automated crop microinsurance payout review active.`;
    } else {
      wibiElem.innerHTML = `<span style="color:#10b981;">Normal</span> - Above parametric insurance payout threshold.`;
    }

    // Recommended Agronomic Action
    const adviceElem = document.getElementById('agronomic-advice');
    if (diag.symptomScore >= 60) {
      adviceElem.textContent = this.ensoBaseline.crop_advisories.drought_severe.advice;
    } else if (diag.season.code === 'NEM' && district.zone === 'Dry' && diag.rainPctDiff > 30) {
      adviceElem.textContent = this.ensoBaseline.crop_advisories.flood_warning.advice;
    } else {
      adviceElem.textContent = this.ensoBaseline.crop_advisories.normal.advice;
    }

    // Synchronize Data-Saver Text View
    this.updateDataSaverView(district, weather, diag);
  }

  /**
   * Run cross-district comparison (e.g. Vavuniya vs Nuwara Eliya)
   */
  async runComparison() {
    const compBox = document.getElementById('comparison-results');
    if (!this.comparisonDistrict || !this.activeDistrict) {
      compBox.style.display = 'none';
      return;
    }

    compBox.style.display = 'block';
    const cWeather = await WeatherClient.fetchWeatherForCoordinate(
      this.comparisonDistrict.lat,
      this.comparisonDistrict.lon,
      this.comparisonDistrict.id
    );

    const now = new Date();
    const month = now.getMonth() + 1;
    const cBaselineRain = this.comparisonDistrict.monthly_rainfall[month - 1];
    const cBaselineTemp = this.comparisonDistrict.monthly_temp[month - 1];

    const cDiag = ClimateSolver.diagnoseDistrictSymptoms({
      observedRainfall: cWeather.estimatedMonthlyMm,
      baselineRainfall: cBaselineRain,
      observedTemp: cWeather.temperature,
      baselineTemp: cBaselineTemp,
      month,
      zone: this.comparisonDistrict.zone,
      vtcsRiskMultiplier: this.comparisonDistrict.vtcs_risk_multiplier,
      nino34Anomaly: this.ensoBaseline.current_enso_state.nino34_sst_anomaly,
      isSriLanka: true
    });

    // Populate comparison cards
    document.getElementById('comp-name-a').textContent = `${this.activeDistrict.name} (${this.activeDistrict.zone})`;
    document.getElementById('comp-name-b').textContent = `${this.comparisonDistrict.name} (${this.comparisonDistrict.zone})`;

    document.getElementById('comp-score-a').textContent = `${document.getElementById('symptom-score').textContent}`;
    document.getElementById('comp-score-b').textContent = `${cDiag.symptomScore}%`;

    document.getElementById('comp-spi-a').textContent = `SPI: ${document.getElementById('metric-spi').textContent}`;
    document.getElementById('comp-spi-b').textContent = `SPI: ${cDiag.spi.toFixed(2)}`;

    document.getElementById('comp-summary').textContent =
      `Differential Diagnostic: ${this.activeDistrict.name} shows ${document.getElementById('symptom-score').textContent} El Niño symptom intensity, whereas ${this.comparisonDistrict.name} exhibits ${cDiag.symptomScore}% intensity due to regional climatic zonality.`;
  }

  /**
   * Calculate island-wide heatmaps
   */
  refreshAllDistrictHeatmaps() {
    const diagMap = new Map();
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    for (const d of this.districts) {
      const baselineRain = d.monthly_rainfall[currentMonth - 1];
      const baselineTemp = d.monthly_temp[currentMonth - 1];
      // In fast/low-data mode, calculate with baseline approximations
      const diag = ClimateSolver.diagnoseDistrictSymptoms({
        observedRainfall: baselineRain * (d.zone === 'Dry' ? 0.6 : 0.9), // Expected El Niño deficit
        baselineRainfall: baselineRain,
        observedTemp: baselineTemp + 1.2,
        baselineTemp: baselineTemp,
        month: currentMonth,
        zone: d.zone,
        vtcsRiskMultiplier: d.vtcs_risk_multiplier,
        nino34Anomaly: this.ensoBaseline.current_enso_state.nino34_sst_anomaly,
        isSriLanka: true
      });
      diagMap.set(d.id, diag);
    }

    if (this.map) {
      this.map.updateDistrictHeatmap(diagMap);
    }
  }

  /**
   * Render Macro ENSO Global Banner
   */
  renderGlobalEnsoStatus() {
    const state = this.ensoBaseline.current_enso_state;
    document.getElementById('macro-oni').textContent = `+${state.oni_value}°C`;
    document.getElementById('macro-roni').textContent = `+${state.roni_value}°C`;
    document.getElementById('macro-kelvin').textContent = `+${state.subsurface_heat_anomaly}°C`;
    document.getElementById('macro-soi').textContent = `${state.soi_value}`;
    document.getElementById('macro-certainty').textContent = `${state.predictive_certainty_pct}%`;
    document.getElementById('macro-status-text').textContent = `${state.phase} | ${state.locking_status}`;
  }

  /**
   * Update Data-Saver text view
   */
  updateDataSaverView(district, weather, diag) {
    const textOutput = document.getElementById('data-saver-text');
    if (!textOutput) return;

    textOutput.textContent = `
========================================
SRI LANKA EL NIÑO ALERT SYSTEM (SLEnS)
LOW-BANDWIDTH DATA SAVER REPORT
========================================
[LOCATION]: ${district.name} (${district.zone} Zone, ${district.province} Province)
[GPS]: ${district.lat}°N, ${district.lon}°E | River: ${district.river_basin}
----------------------------------------
[GLOBAL ENSO STATE]: ${this.ensoBaseline.current_enso_state.phase} (Niño 3.4: +${this.ensoBaseline.current_enso_state.nino34_sst_anomaly}°C)
[PREDICTIVE CERTAINTY]: ${this.ensoBaseline.current_enso_state.predictive_certainty_pct}% (Coupled Thermodynamic Locking)
----------------------------------------
[LOCAL SYMPTOM SCORE]: ${diag.symptomScore}% [TIER: ${diag.riskTier}]
[METEOROLOGICAL INDICES]:
- Standardized Precipitation Index (SPI): ${diag.spi.toFixed(2)}
- Rainfall Anomaly Index (RAI): ${diag.rai.toFixed(2)}
- Rainfall Departure: ${diag.rainPctDiff > 0 ? '+' : ''}${diag.rainPctDiff}%
- Temperature Anomaly: +${diag.tempAnomaly}°C (Current: ${weather.temperature}°C)
----------------------------------------
[HYDROLOGICAL BUFFER - VTCS]: ${diag.vtcsVulnerability}
[PARAMETRIC INSURANCE (WIBI)]: ${diag.wibiTriggered ? 'TRIGGERED (SPI <= -1.50)' : 'NOMINAL'}
[AGRONOMIC ADVISORY]:
${document.getElementById('agronomic-advice').textContent}
========================================
    `.trim();
  }

  /**
   * Setup UI Event Listeners
   */
  bindEvents() {
    // District Select Dropdown
    document.getElementById('district-select').addEventListener('change', (e) => {
      this.selectDistrict(e.target.value);
    });

    // Comparison Select Dropdown
    document.getElementById('compare-district-select').addEventListener('change', (e) => {
      const targetId = e.target.value;
      this.comparisonDistrict = this.districts.find((d) => d.id === targetId) || null;
      this.runComparison();
    });

    // GPS Auto-Detect Button
    document.getElementById('btn-gps').addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }
      const btn = document.getElementById('btn-gps');
      btn.textContent = 'Locating...';
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const resolved = await db.resolveDistrictByGPS(lat, lon);
          btn.innerHTML = '📍 Auto-Detect My Area';
          if (resolved) {
            this.selectDistrict(resolved.id);
          } else {
            // International coordinate detected!
            this.handleInternationalCoordinate(lat, lon);
          }
        },
        (error) => {
          btn.innerHTML = '📍 Auto-Detect My Area';
          alert(`GPS Location error: ${error.message}. Please select your district manually.`);
        }
      );
    });

    // Global City Search
    const searchBtn = document.getElementById('btn-global-search');
    const searchInput = document.getElementById('global-city-input');
    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        try {
          searchBtn.textContent = 'Searching...';
          const cities = await WeatherClient.searchGlobalCity(query);
          searchBtn.textContent = 'Search';
          if (cities.length === 0) {
            alert('No matching global location found.');
            return;
          }
          const city = cities[0];
          this.handleInternationalCoordinate(city.lat, city.lon, `${city.name}, ${city.country}`);
        } catch (err) {
          searchBtn.textContent = 'Search';
          alert(err.message);
        }
      });
    }

    // Data-Saver Toggle
    const dataSaverBtn = document.getElementById('btn-data-saver');
    if (dataSaverBtn) {
      dataSaverBtn.addEventListener('click', () => {
        document.body.classList.toggle('data-saver-active');
        const isActive = document.body.classList.contains('data-saver-active');
        dataSaverBtn.textContent = isActive ? '📶 Standard Mode' : '⚡ Data Saver (Text)';
      });
    }
  }

  /**
   * Handle International coordinates
   */
  async handleInternationalCoordinate(lat, lon, label = null) {
    const locName = label || `Global Coordinate (${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)`;
    document.getElementById('diag-district-name').textContent = locName;
    document.getElementById('diag-zone-badge').textContent = 'International Location';
    document.getElementById('diag-basin-info').textContent = 'Global Climatology (ERA5 Reanalysis)';

    const weather = await WeatherClient.fetchWeatherForCoordinate(lat, lon);
    const diag = ClimateSolver.diagnoseDistrictSymptoms({
      observedRainfall: weather.estimatedMonthlyMm,
      baselineRainfall: 100, // Normalized global mean
      observedTemp: weather.temperature,
      baselineTemp: 25.0,
      month: new Date().getMonth() + 1,
      zone: 'Global',
      vtcsRiskMultiplier: 1.0,
      nino34Anomaly: this.ensoBaseline.current_enso_state.nino34_sst_anomaly,
      isSriLanka: false
    });

    this.renderDistrictDiagnostic({ name: locName, name_si: '', name_ta: '', zone: 'Global', province: 'Global', river_basin: 'International' }, weather, diag);
  }

  /**
   * Monitor online / offline connectivity
   */
  setupNetworkStatusListener() {
    const badge = document.getElementById('network-badge');
    const updateBadge = () => {
      const isOnline = navigator.onLine;
      if (badge) {
        badge.className = `status-badge ${isOnline ? 'status-online' : 'status-offline'}`;
        badge.innerHTML = isOnline ? '● Online (Live Sync)' : '○ Offline (Edge Cache Active)';
      }
    };
    window.addEventListener('online', updateBadge);
    window.addEventListener('offline', updateBadge);
    updateBadge();
  }

  /**
   * Setup PWA Install Button
   */
  setupPWAInstall() {
    const installBtn = document.getElementById('btn-install-pwa');
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      if (installBtn) installBtn.style.display = 'inline-flex';
    });

    if (installBtn) {
      installBtn.addEventListener('click', async () => {
        if (!this.deferredPrompt) return;
        this.deferredPrompt.prompt();
        const choice = await this.deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          console.log('[PWA] User accepted installation prompt');
        }
        this.deferredPrompt = null;
        installBtn.style.display = 'none';
      });
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new SLEnSApp();
  app.init();
});
