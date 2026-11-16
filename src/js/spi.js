/**
 * Climate Mathematical Solvers:
 * - Standardized Precipitation Index (SPI) via 2-parameter Gamma distribution & Abramowitz-Stegun Z-transformation
 * - Rainfall Anomaly Index (RAI)
 * - Sri Lanka Bimodal Monsoon Season & VTCS Vulnerability Evaluator
 */

export class ClimateSolver {
  /**
   * Approximate cumulative distribution function (CDF) for Gamma distribution
   * Shape alpha (k), scale beta (theta)
   */
  static gammaCDF(x, alpha, beta) {
    if (x <= 0) return 0;
    const t = x / beta;
    return this.incompleteGamma(alpha, t);
  }

  /**
   * Regularized lower incomplete gamma function P(a, x) using series expansion / continued fraction
   */
  static incompleteGamma(a, x) {
    if (x < 0 || a <= 0) return 0;
    if (x === 0) return 0;

    // For x < a + 1, use series expansion
    if (x < a + 1.0) {
      let ap = a;
      let sum = 1.0 / a;
      let del = sum;
      for (let n = 1; n <= 100; n++) {
        ap += 1.0;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-7) {
          break;
        }
      }
      return sum * Math.exp(-x + a * Math.log(x) - this.logGamma(a));
    } else {
      // Continued fraction approximation for upper incomplete gamma, then 1 - Q
      let b = x + 1.0 - a;
      let c = 1.0 / 1e-30;
      let d = 1.0 / b;
      let h = d;
      for (let i = 1; i <= 100; i++) {
        const an = -i * (i - a);
        b += 2.0;
        d = an * d + b;
        if (Math.abs(d) < 1e-30) d = 1e-30;
        c = b + an / c;
        if (Math.abs(c) < 1e-30) c = 1e-30;
        d = 1.0 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1.0) < 1e-7) break;
      }
      const q = Math.exp(-x + a * Math.log(x) - this.logGamma(a)) * h;
      return Math.max(0, Math.min(1, 1.0 - q));
    }
  }

  /**
   * Lanczos approximation for log Gamma ln(Γ(z)) (g=7, N=9)
   */
  static logGamma(x) {
    const p = [
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.138571095836526,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    if (x < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * x)) - this.logGamma(1 - x);
    }
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < p.length; i++) {
      a += p[i] / (x + i + 1);
    }
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  /**
   * Rational approximation of the inverse normal CDF (Abramowitz & Stegun 1964)
   * Converts cumulative probability H(x) to standard normal variable Z (SPI)
   */
  static normalInverse(p) {
    if (p <= 0.0) return -4.0;
    if (p >= 1.0) return 4.0;

    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;

    let t;
    if (p < 0.5) {
      t = Math.sqrt(-2.0 * Math.log(p));
      const z = -(t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0));
      return Math.max(-4.0, z);
    } else {
      t = Math.sqrt(-2.0 * Math.log(1.0 - p));
      const z = t - ((c2 * t + c1) * t + c0) / (((d3 * t + d2) * t + d1) * t + 1.0);
      return Math.min(4.0, z);
    }
  }

  /**
   * Calculate Standardized Precipitation Index (SPI)
   * @param {number} observedRainfall - precipitation in mm
   * @param {number} meanBaseline - 30-year normal mean in mm
   * @param {number} stdDev - standard deviation (approx 0.35 * mean if unspecified)
   * @param {number} zeroProb - probability of zero rain months (default 0.02)
   */
  static calculateSPI(observedRainfall, meanBaseline, stdDev = null, zeroProb = 0.02) {
    if (meanBaseline <= 0) return 0;
    const sd = stdDev || Math.max(15, meanBaseline * 0.38);

    // Fit Gamma parameters via method of moments / MLE approximation
    // alpha = (mean / sd)^2, beta = sd^2 / mean
    const alpha = Math.max(0.5, Math.pow(meanBaseline / sd, 2));
    const beta = Math.max(1.0, Math.pow(sd, 2) / meanBaseline);

    let H;
    if (observedRainfall <= 0) {
      H = zeroProb;
    } else {
      const G = this.gammaCDF(observedRainfall, alpha, beta);
      H = zeroProb + (1 - zeroProb) * G;
    }

    // Clamp H to prevent infinity in Z-transform
    H = Math.max(0.0001, Math.min(0.9999, H));
    const spi = this.normalInverse(H);
    return Math.round(spi * 100) / 100;
  }

  /**
   * Rainfall Anomaly Index (RAI)
   * RAI = (P_ij - mu) / sigma
   */
  static calculateRAI(observedRainfall, meanBaseline, stdDev = null) {
    const sd = stdDev || Math.max(15, meanBaseline * 0.38);
    const rai = (observedRainfall - meanBaseline) / sd;
    return Math.round(rai * 100) / 100;
  }

  /**
   * Identifies current Sri Lankan monsoon season based on month (1-12)
   */
  static getSriLankaSeason(month) {
    if (month >= 3 && month <= 4) {
      return { code: 'FIM', name: 'First Inter-Monsoon', focus: 'IPOC deficit, planting delays' };
    } else if (month >= 5 && month <= 9) {
      return { code: 'SWM', name: 'Southwest Monsoon (Yala)', focus: 'Summer agricultural drought, reservoir depletion' };
    } else if (month >= 10 && month <= 11) {
      return { code: 'SIM', name: 'Second Inter-Monsoon', focus: 'Convective thunderstorm & tank pre-filling' };
    } else {
      return { code: 'NEM', name: 'Northeast Monsoon (Maha)', focus: 'Climate whiplash, heavy flood risk in Dry/Eastern zone' };
    }
  }

  /**
   * Computes Comprehensive El Niño Symptom Score (0 - 100%)
   */
  static diagnoseDistrictSymptoms({
    observedRainfall,
    baselineRainfall,
    observedTemp,
    baselineTemp,
    month,
    zone = 'Dry',
    vtcsRiskMultiplier = 1.0,
    nino34Anomaly = 1.5,
    isSriLanka = true
  }) {
    const season = this.getSriLankaSeason(month);
    const spi = this.calculateSPI(observedRainfall, baselineRainfall);
    const rai = this.calculateRAI(observedRainfall, baselineRainfall);
    const rainPctDiff = ((observedRainfall - baselineRainfall) / Math.max(1, baselineRainfall)) * 100;
    const tempAnomaly = Math.round((observedTemp - baselineTemp) * 10) / 10;

    let symptomScore = 0;
    let primarySymptom = 'Nominal / Normal Conditions';
    let riskTier = 'Safe';
    let alertColor = '#10b981';

    // Global ENSO weight (if Niño 3.4 >= 1.5, macro factor is active)
    const ensoFactor = Math.min(1.0, Math.max(0, (nino34Anomaly - 0.5) / 1.5));

    if (isSriLanka) {
      if (season.code === 'SWM' || season.code === 'FIM') {
        // Southwest Monsoon / FIM: El Niño causes DROUGHT (rain deficit + elevated temps)
        let droughtSignal = 0;
        if (spi < -2.0) droughtSignal = 95;
        else if (spi < -1.5) droughtSignal = 80;
        else if (spi < -1.0) droughtSignal = 60;
        else if (spi < -0.5) droughtSignal = 35;

        // Temperature anomaly contribution
        if (tempAnomaly >= 2.0) droughtSignal += 15;
        else if (tempAnomaly >= 1.0) droughtSignal += 10;

        // Multiply by VTCS sensitivity (degraded minor cascades amplify drought)
        symptomScore = Math.min(100, Math.round(droughtSignal * ensoFactor * Math.min(1.3, vtcsRiskMultiplier)));
        if (symptomScore >= 75) {
          primarySymptom = 'Severe Agricultural Drought & Reservoir Depletion (Yala)';
          riskTier = 'Critical Alert';
          alertColor = '#ef4444';
        } else if (symptomScore >= 50) {
          primarySymptom = 'Moderate Drought Symptoms & Soil Moisture Stress';
          riskTier = 'Warning';
          alertColor = '#f97316';
        } else if (symptomScore >= 30) {
          primarySymptom = 'Mild Moisture Deficit';
          riskTier = 'Watch';
          alertColor = '#f59e0b';
        }
      } else if (season.code === 'NEM') {
        // Northeast Monsoon (Maha): El Niño causes CLIMATE WHIPLASH / FLOODING in Dry & Eastern Zones
        if (zone === 'Dry' && rainPctDiff > 35) {
          symptomScore = Math.min(100, Math.round((50 + rainPctDiff * 0.4) * ensoFactor));
          primarySymptom = 'Maha Season Climate Whiplash: Excess Rain & Tank Inundation Risk';
          riskTier = 'Critical Alert';
          alertColor = '#ef4444';
        } else if (spi < -1.0) {
          symptomScore = Math.round(65 * ensoFactor);
          primarySymptom = 'Localized Maha Deficit Warning';
          riskTier = 'Warning';
          alertColor = '#f97316';
        }
      }
    } else {
      // General International Mode
      if (spi < -1.5) {
        symptomScore = Math.min(100, Math.round(80 * ensoFactor));
        primarySymptom = 'Severe Meteorological Drought';
        riskTier = 'Critical Alert';
        alertColor = '#ef4444';
      } else if (spi < -1.0) {
        symptomScore = Math.min(100, Math.round(55 * ensoFactor));
        primarySymptom = 'Moderate Drought Symptoms';
        riskTier = 'Warning';
        alertColor = '#f97316';
      }
    }

    // Weather Index-Based Insurance (WIBI) Strike Level
    const wibiTriggered = spi <= -1.5;

    return {
      season,
      spi,
      rai,
      rainPctDiff: Math.round(rainPctDiff * 10) / 10,
      tempAnomaly,
      symptomScore,
      primarySymptom,
      riskTier,
      alertColor,
      wibiTriggered,
      vtcsVulnerability: vtcsRiskMultiplier > 1.3 ? 'High (Cascade amplification risk)' : 'Standard'
    };
  }
}
