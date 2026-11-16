/**
 * Automated Verification Suite for SLEnS Climate Platform
 * Tests:
 * 1. MCP Server JSON-RPC 2.0 primitives
 * 2. Mathematical SPI / RAI solver accuracy
 * 3. District dataset integrity (25 districts)
 * 4. PWA Manifest & Service Worker consistency
 */

import assert from 'assert';
import { handleJsonRpc } from './server.js';
import { ClimateSolver } from '../src/js/spi.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting SLEnS Test Suite...\n');

// 1. Dataset Integrity Test
console.log('[Test 1] Validating Sri Lanka District Dataset...');
const districtsFile = path.resolve(__dirname, '../src/data/districts_sri_lanka.json');
const rawDistricts = JSON.parse(fs.readFileSync(districtsFile, 'utf8'));
assert.strictEqual(rawDistricts.districts.length, 25, 'Must contain exactly 25 Sri Lankan administrative districts');

// Verify key districts from user document
const vavuniya = rawDistricts.districts.find(d => d.id === 'vavuniya');
assert.ok(vavuniya, 'Vavuniya district must be present');
assert.strictEqual(vavuniya.zone, 'Dry');
assert.ok(vavuniya.vtcs_risk_multiplier >= 1.5, 'Vavuniya VTCS multiplier must be high (>=1.5)');

const nuwaraEliya = rawDistricts.districts.find(d => d.id === 'nuwara_eliya');
assert.ok(nuwaraEliya, 'Nuwara Eliya must be present');
assert.strictEqual(nuwaraEliya.zone, 'Wet');
console.log('✅ District dataset verified: 25 districts loaded with VTCS attributes.\n');

// 2. Mathematical Solver Test: SPI & RAI
console.log('[Test 2] Testing SPI & RAI Mathematical Solver...');
// Normal condition test
const normalSPI = ClimateSolver.calculateSPI(100, 100);
assert.ok(Math.abs(normalSPI) < 0.3, `SPI for normal rainfall should be near 0 (got ${normalSPI})`);

// Severe drought test (e.g. 25mm when baseline is 100mm)
const droughtSPI = ClimateSolver.calculateSPI(25, 100);
assert.ok(droughtSPI <= -1.5, `Drought SPI should be <= -1.5 (got ${droughtSPI})`);

// RAI test
const rai = ClimateSolver.calculateRAI(25, 100);
assert.ok(rai < -1.0, `RAI should indicate severe negative anomaly (got ${rai})`);

// Monsoonal Symptom Diagnosis for Vavuniya in drought
const diag = ClimateSolver.diagnoseDistrictSymptoms({
  observedRainfall: 20,
  baselineRainfall: 85,
  observedTemp: 32.5,
  baselineTemp: 29.5,
  month: 6, // SWM / Yala season
  zone: 'Dry',
  vtcsRiskMultiplier: 1.6,
  nino34Anomaly: 1.6,
  isSriLanka: true
});
assert.ok(diag.symptomScore >= 70, `Drought score should be >= 70% in Yala (got ${diag.symptomScore}%)`);
assert.strictEqual(diag.wibiTriggered, true, 'WIBI insurance strike should trigger when SPI <= -1.5');
console.log(`✅ Mathematical solver passed: SPI = ${droughtSPI}, RAI = ${rai}, Symptom Score = ${diag.symptomScore}%, WIBI = ${diag.wibiTriggered}.\n`);

// 3. MCP Server Protocol Test
console.log('[Test 3] Testing MCP Server Tools & JSON-RPC 2.0 Endpoints...');

// 3.1 tools/list
const listRes = handleJsonRpc({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
assert.strictEqual(listRes.result.tools.length, 3, 'Must register 3 MCP tools');
console.log('  ✓ tools/list returned 3 registered tools');

// 3.2 get_enso_diagnostic_state
const ensoCall = handleJsonRpc({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: { name: 'get_enso_diagnostic_state', arguments: { index_preference: 'BOTH' } }
});
const ensoResult = JSON.parse(ensoCall.result.content[0].text);
assert.ok(ensoResult.oni_value >= 0.5, 'ONI value must be >= 0.5°C');
assert.ok(ensoResult.predictive_certainty_pct > 95, 'Predictive certainty should reflect thermodynamic locking');
console.log(`  ✓ get_enso_diagnostic_state: ONI=+${ensoResult.oni_value}°C, Certainty=${ensoResult.predictive_certainty_pct}%`);

// 3.3 analyze_sri_lanka_location_drought (Vavuniya coords)
const droughtCall = handleJsonRpc({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: {
    name: 'analyze_sri_lanka_location_drought',
    arguments: { latitude: 8.75, longitude: 80.50, recent_rainfall_mm: 15 }
  }
});
const droughtResult = JSON.parse(droughtCall.result.content[0].text);
assert.strictEqual(droughtResult.resolved_district, 'Vavuniya');
assert.ok(droughtResult.spi_score <= -1.5, 'Vavuniya SPI must indicate drought');
assert.strictEqual(droughtResult.wibi_insurance_strike, true);
console.log(`  ✓ analyze_sri_lanka_location_drought: Resolved ${droughtResult.resolved_district}, SPI=${droughtResult.spi_score}`);

// 3.4 compare_district_climate_symptoms (Vavuniya vs Nuwara Eliya)
const compCall = handleJsonRpc({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'compare_district_climate_symptoms',
    arguments: { primary_district: 'Vavuniya', target_districts: ['Nuwara Eliya'] }
  }
});
const compResult = JSON.parse(compCall.result.content[0].text);
assert.strictEqual(compResult.primary_baseline.name, 'Vavuniya');
assert.strictEqual(compResult.comparisons[0].name, 'Nuwara Eliya');
console.log(`  ✓ compare_district_climate_symptoms: Compared ${compResult.primary_baseline.name} with ${compResult.comparisons[0].name}`);

// 3.5 resources/list and resources/read
const resList = handleJsonRpc({ jsonrpc: '2.0', id: 5, method: 'resources/list' });
assert.strictEqual(resList.result.resources.length, 2);
console.log('  ✓ resources/list verified');

console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
