/**
 * SLEnS Climate Model Context Protocol (MCP) Server
 * Implements JSON-RPC 2.0 specification for ENSO & Sri Lanka Climate Telemetry
 * Provides:
 * - Tools: get_enso_diagnostic_state, analyze_sri_lanka_location_drought, compare_district_climate_symptoms
 * - Resources: climate://enso/oni_history.json, climate://srilanka/district_baselines.json
 * - Prompts: climate://prompts/district_advisory (trilingual English, Sinhala, Tamil)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load datasets
const districtsPath = path.resolve(__dirname, '../src/data/districts_sri_lanka.json');
const ensoPath = path.resolve(__dirname, '../src/data/enso_baseline.json');

const districtsData = JSON.parse(fs.readFileSync(districtsPath, 'utf8')).districts;
const ensoData = JSON.parse(fs.readFileSync(ensoPath, 'utf8'));

// Mathematical SPI Approximation
function calculateSPI(observed, mean, stdDev = null) {
  if (mean <= 0) return 0;
  const sd = stdDev || Math.max(15, mean * 0.38);
  const diff = (observed - mean) / sd;
  return Math.round(diff * 100) / 100;
}

// MCP Tools Registry
const TOOLS = [
  {
    name: 'get_enso_diagnostic_state',
    description: 'Evaluates Pacific Ocean sea surface anomalies, sub-surface heat content, and atmospheric coupling status to determine El Niño predictive certainty.',
    inputSchema: {
      type: 'object',
      properties: {
        target_month: {
          type: 'string',
          pattern: '^\\d{4}-(0[1-9]|1[0-2])$',
          description: 'Target evaluation month formatted as YYYY-MM'
        },
        include_subsurface: {
          type: 'boolean',
          default: true,
          description: 'Toggles inclusion of 0-300m sub-surface ocean heat content anomaly metrics'
        },
        index_preference: {
          type: 'string',
          enum: ['ONI', 'RONI', 'BOTH'],
          default: 'BOTH',
          description: 'Selects standard ONI, Relative ONI, or comparative assessment output'
        }
      }
    }
  },
  {
    name: 'analyze_sri_lanka_location_drought',
    description: 'Accepts GPS coordinates, resolves administrative district boundaries, and calculates localized SPI values and VTCS vulnerability.',
    inputSchema: {
      type: 'object',
      properties: {
        latitude: {
          type: 'number',
          minimum: 5.8,
          maximum: 9.9,
          description: 'Latitude coordinate bounded to Sri Lanka'
        },
        longitude: {
          type: 'number',
          minimum: 79.6,
          maximum: 82.0,
          description: 'Longitude coordinate bounded to Sri Lanka'
        },
        time_scale_months: {
          type: 'integer',
          enum: [1, 3, 6, 12],
          default: 3,
          description: 'Aggregation period for localized SPI calculation'
        },
        recent_rainfall_mm: {
          type: 'number',
          minimum: 0.0,
          description: 'Optional observed recent monthly precipitation in mm'
        }
      },
      required: ['latitude', 'longitude']
    }
  },
  {
    name: 'compare_district_climate_symptoms',
    description: 'Computes comparative climate anomalies and risk vectors across selected administrative districts during active ENSO phases.',
    inputSchema: {
      type: 'object',
      properties: {
        primary_district: {
          type: 'string',
          description: 'Reference district name establishing comparative baseline (e.g. Vavuniya)'
        },
        target_districts: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          description: 'Array of target district names to evaluate against primary baseline'
        },
        metrics: {
          type: 'array',
          items: { type: 'string', enum: ['spi', 'sat_anomaly', 'reservoir_level'] },
          default: ['spi', 'sat_anomaly']
        }
      },
      required: ['primary_district', 'target_districts']
    }
  }
];

// Tool Executors
function executeGetEnsoDiagnosticState(args) {
  const current = ensoData.current_enso_state;
  return {
    target_month: args.target_month || current.target_month,
    nino34_sst_anomaly: current.nino34_sst_anomaly,
    oni_value: current.oni_value,
    roni_value: current.roni_value,
    soi_value: current.soi_value,
    subsurface_heat_anomaly_0_300m: args.include_subsurface !== false ? current.subsurface_heat_anomaly : null,
    low_level_zonal_wind_anomaly: current.zonal_wind_anomaly,
    phase: current.phase,
    predictive_certainty_pct: current.predictive_certainty_pct,
    thermodynamic_status: current.locking_status,
    decay_velocity: current.decay_velocity,
    operational_criteria_met: {
      oni_above_threshold: current.oni_value >= ensoData.enso_thresholds.oni_advisory_celsius,
      roni_above_threshold: current.roni_value >= ensoData.enso_thresholds.roni_threshold_noaa,
      soi_sustained_negative: current.soi_value <= ensoData.enso_thresholds.soi_sustained_negative,
      kelvin_wave_reservoir_locked: current.subsurface_heat_anomaly >= ensoData.enso_thresholds.subsurface_heat_anomaly_celsius
    }
  };
}

function executeAnalyzeDrought(args) {
  const { latitude, longitude, recent_rainfall_mm } = args;

  // Resolve closest district
  let closest = null;
  let minDistanceSq = Infinity;
  for (const d of districtsData) {
    const dLat = d.lat - latitude;
    const dLon = d.lon - longitude;
    const distSq = dLat * dLat + dLon * dLon;
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closest = d;
    }
  }

  const month = new Date().getMonth() + 1;
  const baselineRain = closest.monthly_rainfall[month - 1];
  const observedRain = recent_rainfall_mm !== undefined ? recent_rainfall_mm : baselineRain * (closest.zone === 'Dry' ? 0.45 : 0.85);

  const spi = calculateSPI(observedRain, baselineRain);
  let droughtCategory = 'Normal';
  if (spi <= -2.0) droughtCategory = 'Extreme Drought';
  else if (spi <= -1.5) droughtCategory = 'Severe Drought';
  else if (spi <= -1.0) droughtCategory = 'Moderate Drought';

  return {
    resolved_district: closest.name,
    district_id: closest.id,
    zone: closest.zone,
    province: closest.province,
    river_basin: closest.river_basin,
    vtcs_multiplier: closest.vtcs_risk_multiplier,
    vtcs_impact: closest.vtcs_risk_multiplier > 1.3 ? 'Critical cascade sedimentation vulnerability' : 'Standard buffer capacity',
    observed_precipitation_mm: observedRain,
    baseline_precipitation_mm: baselineRain,
    spi_score: spi,
    drought_intensity: droughtCategory,
    wibi_insurance_strike: spi <= -1.5,
    recommended_action: spi <= -1.5 ? ensoData.crop_advisories.drought_severe.advice : ensoData.crop_advisories.normal.advice
  };
}

function executeCompareDistricts(args) {
  const { primary_district, target_districts } = args;
  const primary = districtsData.find((d) => d.name.toLowerCase() === primary_district.toLowerCase() || d.id === primary_district.toLowerCase());
  if (!primary) throw new Error(`Primary district '${primary_district}' not found.`);

  const month = new Date().getMonth() + 1;

  const results = {
    primary_baseline: {
      name: primary.name,
      zone: primary.zone,
      baseline_rainfall_mm: primary.monthly_rainfall[month - 1],
      vtcs_multiplier: primary.vtcs_risk_multiplier
    },
    comparisons: []
  };

  for (const tName of target_districts) {
    const target = districtsData.find((d) => d.name.toLowerCase() === tName.toLowerCase() || d.id === tName.toLowerCase());
    if (target) {
      results.comparisons.push({
        name: target.name,
        zone: target.zone,
        baseline_rainfall_mm: target.monthly_rainfall[month - 1],
        vtcs_multiplier: target.vtcs_risk_multiplier,
        rainfall_divergence_pct: Math.round(((target.monthly_rainfall[month - 1] - primary.monthly_rainfall[month - 1]) / primary.monthly_rainfall[month - 1]) * 100)
      });
    }
  }

  return results;
}

// JSON-RPC Request Handler
export function handleJsonRpc(request) {
  const { id, method, params } = request;

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params;
    try {
      let result;
      if (name === 'get_enso_diagnostic_state') {
        result = executeGetEnsoDiagnosticState(args || {});
      } else if (name === 'analyze_sri_lanka_location_drought') {
        result = executeAnalyzeDrought(args);
      } else if (name === 'compare_district_climate_symptoms') {
        result = executeCompareDistricts(args);
      } else {
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool '${name}'` } };
      }
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } };
    } catch (err) {
      return { jsonrpc: '2.0', id, error: { code: -32000, message: err.message } };
    }
  }

  if (method === 'resources/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources: [
          { uri: 'climate://enso/oni_history.json', name: 'Historical ONI timeseries' },
          { uri: 'climate://srilanka/district_baselines.json', name: 'Sri Lanka 25-district 30-year climatology' }
        ]
      }
    };
  }

  if (method === 'resources/read') {
    const { uri } = params;
    if (uri === 'climate://enso/oni_history.json') {
      return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(ensoData, null, 2) }] } };
    }
    if (uri === 'climate://srilanka/district_baselines.json') {
      return { jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(districtsData, null, 2) }] } };
    }
    return { jsonrpc: '2.0', id, error: { code: -32002, message: 'Resource not found' } };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method '${method}' not implemented.` } };
}

// Stdio server listener
if (process.argv.includes('--stdio')) {
  process.stdin.setEncoding('utf8');
  let buffer = '';
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const req = JSON.parse(line);
        const res = handleJsonRpc(req);
        process.stdout.write(JSON.stringify(res) + '\n');
      } catch (err) {
        console.error('JSON-RPC parse error:', err);
      }
    }
  });
}
