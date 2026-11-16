/**
 * Ultra-Lightweight Interactive Vector SVG Map Renderer (<30 KB)
 * Complies with strict offline-first and low-data constraints:
 * - Replaces heavy raster map tiles (Google Maps / Mapbox) with clean vector paths
 * - Dynamic color-coding based on El Niño symptom severity
 * - Responsive touch & click district selection
 * - Multilingual tooltips (English, Sinhala, Tamil)
 */

export class SriLankaVectorMap {
  constructor({ containerId, onSelectDistrict }) {
    this.container = document.getElementById(containerId);
    this.onSelectDistrict = onSelectDistrict;
    this.districts = [];
    this.districtDataMap = new Map();
    this.selectedDistrictId = null;
  }

  /**
   * Initialize map with district dataset
   */
  render(districts) {
    this.districts = districts;
    for (const d of districts) {
      this.districtDataMap.set(d.id, d);
    }

    if (!this.container) return;

    // Build SVG markup with 600x900 coordinate space
    let svgHtml = `
      <svg viewBox="100 20 400 800" class="sri-lanka-svg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Interactive Map of Sri Lanka Districts">
        <defs>
          <filter id="map-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#0f172a" flood-opacity="0.3"/>
          </filter>
        </defs>
        <!-- Ocean background hint -->
        <g id="districts-group" class="districts-layer">
    `;

    for (const d of districts) {
      svgHtml += `
        <path
          id="district-${d.id}"
          d="${d.svg_path}"
          class="district-path"
          data-id="${d.id}"
          data-name="${d.name}"
          data-name-si="${d.name_si}"
          data-name-ta="${d.name_ta}"
          data-zone="${d.zone}"
          fill="#3b82f6"
          stroke="#0b1329"
          stroke-width="1.2"
          stroke-linejoin="round"
        >
          <title>${d.name} (${d.name_si} / ${d.name_ta}) - ${d.zone} Zone</title>
        </path>
      `;
    }

    // Add district labels (abbreviations / names)
    svgHtml += `</g><g id="labels-group" class="labels-layer pointer-events-none">`;
    for (const d of districts) {
      const svgX = d.centroid_svg ? d.centroid_svg.x : 140 + (d.lon - 79.6) * 115;
      const svgY = d.centroid_svg ? d.centroid_svg.y : 780 - (d.lat - 5.8) * 195;
      const shortName = d.name.length > 9 ? d.name.substring(0, 8) + '.' : d.name;
      svgHtml += `
        <text x="${svgX}" y="${svgY}" class="district-svg-label" text-anchor="middle" font-size="8.5" fill="#f8fafc" font-weight="700">
          ${shortName}
        </text>
      `;
    }

    svgHtml += `</g></svg>`;
    this.container.innerHTML = svgHtml;

    this.attachEventListeners();
  }

  attachEventListeners() {
    const paths = this.container.querySelectorAll('.district-path');
    paths.forEach((p) => {
      p.addEventListener('click', (e) => {
        const districtId = e.currentTarget.getAttribute('data-id');
        this.selectDistrict(districtId);
      });

      p.addEventListener('mouseenter', (e) => {
        if (e.currentTarget.getAttribute('data-id') !== this.selectedDistrictId) {
          e.currentTarget.style.opacity = '0.9';
          e.currentTarget.style.stroke = '#38bdf8';
          e.currentTarget.style.strokeWidth = '2.2';
        }
      });

      p.addEventListener('mouseleave', (e) => {
        if (e.currentTarget.getAttribute('data-id') !== this.selectedDistrictId) {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.stroke = '#0b1329';
          e.currentTarget.style.strokeWidth = '1.2';
        }
      });
    });
  }

  /**
   * Programmatic district selection
   */
  selectDistrict(districtId) {
    this.selectedDistrictId = districtId;
    const paths = this.container.querySelectorAll('.district-path');
    paths.forEach((p) => {
      const isSelected = p.getAttribute('data-id') === districtId;
      p.classList.toggle('selected-district', isSelected);
      if (isSelected) {
        p.style.stroke = '#ffffff';
        p.style.strokeWidth = '3.0';
      } else {
        p.style.stroke = '#0b1329';
        p.style.strokeWidth = '1.2';
      }
    });

    const data = this.districtDataMap.get(districtId);
    if (data && typeof this.onSelectDistrict === 'function') {
      this.onSelectDistrict(data);
    }
  }

  /**
   * Update map colors dynamically based on symptom diagnostic scores
   * @param {Map<string, { alertColor: string, symptomScore: number }>} diagnosticMap
   */
  updateDistrictHeatmap(diagnosticMap) {
    if (!diagnosticMap) return;
    for (const [id, diag] of diagnosticMap.entries()) {
      const elem = this.container.querySelector(`#district-${id}`);
      if (elem && diag.alertColor) {
        elem.setAttribute('fill', diag.alertColor);
      }
    }
  }
}
