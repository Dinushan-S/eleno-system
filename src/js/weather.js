/**
 * Low-Bandwidth Real-Time Weather & Telemetry Client
 * Connects to Open-Meteo API (global coverage, zero API keys needed)
 * Features:
 * - Aggressive request parameter trimming (fetches only required numerical metrics)
 * - Offline fallback to IndexedDB cached telemetry
 * - Global city geocoding lookup
 */

import { db } from './db.js';

export class WeatherClient {
  /**
   * Fetch current weather & 14-day rainfall sum for coordinate
   */
  static async fetchWeatherForCoordinate(lat, lon, locationKey = null) {
    const key = locationKey || `${lat.toFixed(2)},${lon.toFixed(2)}`;

    // If browser is offline, directly load from cache
    if (!navigator.onLine) {
      const cached = await this.getCachedWeather(key);
      if (cached) {
        return { ...cached, isOfflineData: true };
      }
      return this.generateFallbackWeather(lat, lon);
    }

    try {
      // Open-Meteo API query with minimal parameter set to save mobile bandwidth (< 1.5 KB)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=precipitation_sum,temperature_2m_max&past_days=14&forecast_days=3&timezone=auto`;

      const response = await fetch(url, { cache: 'no-cache' });
      if (!response.ok) {
        throw new Error(`Open-Meteo error: ${response.status}`);
      }
      const data = await response.json();

      // Aggregate past 14 days rainfall
      const pastRainfall = data.daily?.precipitation_sum?.slice(0, 14) || [];
      const past14DaysTotal = pastRainfall.reduce((acc, v) => acc + (v || 0), 0);

      // Estimate monthly rainfall projection based on 14-day trend
      const monthlyEstimatedRainfall = Math.round(past14DaysTotal * 2.14);

      const result = {
        lat,
        lon,
        temperature: data.current?.temperature_2m || 28.0,
        humidity: data.current?.relative_humidity_2m || 75,
        windSpeed: data.current?.wind_speed_10m || 10,
        recentRainfallMm: Math.round(past14DaysTotal * 10) / 10,
        estimatedMonthlyMm: monthlyEstimatedRainfall,
        fetchedAt: Date.now(),
        isOfflineData: false
      };

      // Cache locally for offline access
      await db.cacheTelemetry(key, result);
      return result;
    } catch (err) {
      console.warn(`[Weather] Fetch failed (${err.message}), attempting offline cache...`);
      const cached = await this.getCachedWeather(key);
      if (cached) {
        return { ...cached, isOfflineData: true };
      }
      return this.generateFallbackWeather(lat, lon);
    }
  }

  /**
   * Read cached telemetry from IndexedDB
   */
  static async getCachedWeather(locationKey) {
    try {
      if (!db.db) await db.init();
      return new Promise((resolve) => {
        const tx = db.db.transaction('telemetry', 'readonly');
        const store = tx.objectStore('telemetry');
        const req = store.get(locationKey);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  /**
   * Search global cities via Open-Meteo Geocoding API
   */
  static async searchGlobalCity(cityName) {
    if (!navigator.onLine) {
      throw new Error('City search requires an active internet connection.');
    }
    const cleanName = encodeURIComponent(cityName.trim());
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${cleanName}&count=5&language=en&format=json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Geocoding service unavailable');
    const data = await res.json();
    return (data.results || []).map((r) => ({
      name: r.name,
      country: r.country,
      lat: r.latitude,
      lon: r.longitude,
      admin1: r.admin1 || ''
    }));
  }

  /**
   * Deterministic synthetic baseline when fully offline without previous cache
   */
  static generateFallbackWeather(lat, lon) {
    return {
      lat,
      lon,
      temperature: 28.5,
      humidity: 70,
      windSpeed: 12,
      recentRainfallMm: 25.0,
      estimatedMonthlyMm: 55.0,
      fetchedAt: Date.now(),
      isOfflineData: true,
      isEstimated: true
    };
  }
}
