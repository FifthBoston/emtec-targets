/**
 * EmTec Targets - Frontend Application
 * Connects to the API and renders the catalog UI
 */

// API base - works with both Netlify Functions and local Express
const API_BASE = '/api';

// State
let currentFilters = {
  material: '',
  diameter: '',
  thickness: '',
  type: '',
  search: ''
};
let currentSort = 'material';
let currentOrder = 'asc';
let currentOffset = 0;
const PAGE_SIZE = 24;

// DOM Elements
const elements = {
  materialsGrid: document.getElementById('materials-grid'),
  productsGrid: document.getElementById('products-grid'),
  resultsCount: document.getElementById('results-count'),
  filterMaterial: document.getElementById('filter-material'),
  filterDiameter: document.getElementById('filter-diameter'),
  filterThickness: document.getElementById('filter-thickness'),
  filterType: document.getElementById('filter-type'),
  heroSearch: document.getElementById('hero-search'),
  searchBtn: document.getElementById('search-btn'),
  applyFilters: document.getElementById('apply-filters'),
  clearFilters: document.getElementById('clear-filters'),
  sortProducts: document.getElementById('sort-products'),
  loadMore: document.getElementById('load-more'),
  statTargets: document.getElementById('stat-targets'),
  statMaterials: document.getElementById('stat-materials'),
  statDiameters: document.getElementById('stat-diameters'),
  lastSync: document.getElementById('last-sync'),
  filterPills: document.getElementById('filter-pills'),
  activeFilters: document.getElementById('active-filters')
};

// Material colors
const materialColors = {
  'Gold': 'linear-gradient(135deg, #FFD700, #FFA500)',
  'Silver': 'linear-gradient(135deg, #C0C0C0, #A8A8A8)',
  'Platinum': 'linear-gradient(135deg, #E5E4E2, #BCC6CC)',
  'Copper': 'linear-gradient(135deg, #B87333, #DA8A67)',
  'Aluminum': 'linear-gradient(135deg, #A8A9AD, #848789)',
  'Titanium': 'linear-gradient(135deg, #878681, #54534D)',
  'Chromium': 'linear-gradient(135deg, #DBE4EB, #9BA4AA)',
  'Palladium': 'linear-gradient(135deg, #CED0DD, #9A9BA3)',
  'Carbon': 'linear-gradient(135deg, #1C1C1C, #3D3D3D)',
  'Iridium': 'linear-gradient(135deg, #E8E8E8, #D0D0D0)'
};

const materialSymbols = {
  'Gold': 'Au', 'Silver': 'Ag', 'Platinum': 'Pt', 'Copper': 'Cu',
  'Aluminum': 'Al', 'Titanium': 'Ti', 'Chromium': 'Cr', 'Palladium': 'Pd',
  'Carbon': 'C', 'Iridium': 'Ir', 'Nickel': 'Ni', 'Tungsten': 'W',
  'Tantalum': 'Ta', 'Molybdenum': 'Mo', 'Silicon': 'Si'
};

// API Functions
async function fetchAPI(endpoint, params = {}) {
  const url = new URL(API_BASE + endpoint, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

async function loadStats() {
  try {
    const stats = await fetchAPI('/stats');
    if (elements.statTargets) elements.statTargets.textContent = stats.total_targets || '0';
    if (elements.statMaterials) elements.statMaterials.textContent = stats.unique_materials || '0';
    if (elements.statDiameters) elements.statDiameters.textContent = stats.unique_diameters || '0';
    if (elements.lastSync && stats.last_sync) {
      elements.lastSync.textContent = new Date(stats.last_sync).toLocaleDateString();
    }
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadMaterials() {
  try {
    const materials = await fetchAPI('/materials');
    
    if (elements.materialsGrid) {
      elements.materialsGrid.innerHTML = materials.map(m => `
        <a href="#catalog" class="material-chip" data-material="${m.material}">
          <span class="material-symbol" style="background: ${m.color_gradient || materialColors[m.material] || 'linear-gradient(135deg, #6b7280, #9ca3af)'}">
            ${m.symbol || materialSymbols[m.material] || m.material.substring(0, 2)}
          </span>
          <span class="material-name">${m.material}</span>
          <span class="material-count">${m.count} targets</span>
        </a>
      `).join('');
      
      // Add click handlers
      elements.materialsGrid.querySelectorAll('.material-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.preventDefault();
          currentFilters.material = chip.dataset.material;
          elements.filterMaterial.value = chip.dataset.material;
          loadTargets();
          updateFilterPills();
          document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
        });
      });
    }
    
    // Populate filter dropdown
    if (elements.filterMaterial) {
      const options = materials.map(m => `<option value="${m.material}">${m.material} (${m.count})</option>`);
      elements.filterMaterial.innerHTML = '<option value="">All Materials</option>' + options.join('');
    }
  } catch (error) {
    console.error('Failed to load materials:', error);
    if (elements.materialsGrid) {
      elements.materialsGrid.innerHTML = '<p class="empty-state">Failed to load materials</p>';
    }
  }
}

async function loadDiameters() {
  try {
    const diameters = await fetchAPI('/diameters');
    if (elements.filterDiameter) {
      const options = diameters.map(d => `<option value="${d}">${d} mm</option>`);
      elements.filterDiameter.innerHTML = '<option value="">All Diameters</option>' + options.join('');
    }
  } catch (error) {
    console.error('Failed to load diameters:', error);
  }
}

async function loadThicknesses() {
  try {
    const thicknesses = await fetchAPI('/thicknesses');
    if (elements.filterThickness) {
      const options = thicknesses.map(t => `<option value="${t}">${t} mm</option>`);
      elements.filterThickness.innerHTML = '<option value="">All Thicknesses</option>' + options.join('');
    }
  } catch (error) {
    console.error('Failed to load thicknesses:', error);
  }
}

async function loadTargets(append = false) {
  try {
    if (!append) {
      currentOffset = 0;
      elements.productsGrid.innerHTML = '<div class="loading-spinner"></div>';
    }
    
    const params = {
      ...currentFilters,
      sort: currentSort,
      order: currentOrder,
      limit: PAGE_SIZE,
      offset: currentOffset
    };
    
    const { data, pagination } = await fetchAPI('/targets', params);
    
    if (data.length === 0 && !append) {
      elements.productsGrid.innerHTML = `
        <div class="empty-state">
          <h3>No targets found</h3>
          <p>Try adjusting your filters or search terms</p>
        </div>
      `;
      elements.resultsCount.textContent = '0 products';
      return;
    }
    
    const html = data.map(target => renderTargetCard(target)).join('');
    
    if (append) {
      elements.productsGrid.insertAdjacentHTML('beforeend', html);
    } else {
      elements.productsGrid.innerHTML = html;
    }
    
    elements.resultsCount.innerHTML = `Showing <strong>${Math.min(currentOffset + PAGE_SIZE, pagination.total)}</strong> of ${pagination.total} products`;
    
    // Show/hide load more
    const hasMore = currentOffset + PAGE_SIZE < pagination.total;
    document.getElementById('pagination').style.display = hasMore ? 'block' : 'none';
    
  } catch (error) {
    console.error('Failed to load targets:', error);
    elements.productsGrid.innerHTML = `
      <div class="empty-state">
        <h3>Error loading catalog</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

function renderTargetCard(target) {
  const material = target.material || 'Unknown';
  const symbol = materialSymbols[material] || material.substring(0, 2);
  const gradient = materialColors[material] || 'linear-gradient(135deg, #6b7280, #9ca3af)';
  
  const isAnnular = target.target_type === 'annular';
  const diameterText = isAnnular 
    ? `OD: ${target.outer_diameter_mm || '—'}mm / ID: ${target.inner_diameter_mm || '—'}mm`
    : `${target.diameter_mm || '—'} mm dia`;
  
  return `
    <div class="product-card" data-id="${target.id}">
      ${target.purity ? '<div class="product-badge">' + target.purity + '</div>' : ''}
      <div class="product-image">
        <div class="target-visual" style="background: ${gradient};">
          <span>${symbol}</span>
        </div>
      </div>
      <div class="product-info">
        <h3>${material} ${isAnnular ? 'Annular' : 'Disc'} Target</h3>
        <div class="product-specs">
          <span class="spec">${target.part_number}</span>
          <span class="spec">${diameterText}</span>
          ${target.thickness_mm ? `<span class="spec">${target.thickness_mm} mm thick</span>` : ''}
        </div>
        ${target.notes ? `<p class="product-notes" style="font-size: 12px; color: #6b7280; margin-top: 8px;">${target.notes}</p>` : ''}
        <div class="product-actions" style="margin-top: 12px;">
          <a href="#quote" class="btn btn-primary" onclick="prefillQuote('${target.part_number}', '${material}')">Request Quote</a>
        </div>
        <p class="product-vendor" style="font-size: 11px; color: #9ca3af; margin-top: 8px;">
          Source: EMTEC-TARGETS
        </p>
      </div>
    </div>
  `;
}

function updateFilterPills() {
  const pills = [];
  
  if (currentFilters.material) {
    pills.push({ key: 'material', label: currentFilters.material });
  }
  if (currentFilters.diameter) {
    pills.push({ key: 'diameter', label: `${currentFilters.diameter}mm` });
  }
  if (currentFilters.thickness) {
    pills.push({ key: 'thickness', label: `${currentFilters.thickness}mm thick` });
  }
  if (currentFilters.type) {
    pills.push({ key: 'type', label: currentFilters.type });
  }
  if (currentFilters.search) {
    pills.push({ key: 'search', label: `"${currentFilters.search}"` });
  }
  
  if (pills.length === 0) {
    elements.activeFilters.style.display = 'none';
    return;
  }
  
  elements.activeFilters.style.display = 'block';
  elements.filterPills.innerHTML = pills.map(p => `
    <span class="filter-pill" data-key="${p.key}">
      ${p.label}
      <span class="remove" onclick="removeFilter('${p.key}')">×</span>
    </span>
  `).join('');
}

function removeFilter(key) {
  currentFilters[key] = '';
  
  // Reset corresponding dropdown
  if (key === 'material') elements.filterMaterial.value = '';
  if (key === 'diameter') elements.filterDiameter.value = '';
  if (key === 'thickness') elements.filterThickness.value = '';
  if (key === 'type') elements.filterType.value = '';
  if (key === 'search') elements.heroSearch.value = '';
  
  loadTargets();
  updateFilterPills();
}

function prefillQuote(partNumber, material) {
  const details = document.getElementById('quote-details');
  if (details) {
    details.value = `Part #: ${partNumber}\nMaterial: ${material}\nQuantity: 1\n\nAdditional requirements:`;
  }
}

// Event Listeners
function initEventListeners() {
  // Apply filters
  elements.applyFilters?.addEventListener('click', () => {
    currentFilters.material = elements.filterMaterial?.value || '';
    currentFilters.diameter = elements.filterDiameter?.value || '';
    currentFilters.thickness = elements.filterThickness?.value || '';
    currentFilters.type = elements.filterType?.value || '';
    loadTargets();
    updateFilterPills();
  });
  
  // Clear filters
  elements.clearFilters?.addEventListener('click', () => {
    currentFilters = { material: '', diameter: '', thickness: '', type: '', search: '' };
    elements.filterMaterial.value = '';
    elements.filterDiameter.value = '';
    elements.filterThickness.value = '';
    elements.filterType.value = '';
    elements.heroSearch.value = '';
    loadTargets();
    updateFilterPills();
  });
  
  // Search
  elements.searchBtn?.addEventListener('click', () => {
    currentFilters.search = elements.heroSearch?.value || '';
    loadTargets();
    updateFilterPills();
    document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
  });
  
  elements.heroSearch?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      currentFilters.search = elements.heroSearch?.value || '';
      loadTargets();
      updateFilterPills();
      document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
    }
  });
  
  // Sort
  elements.sortProducts?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    loadTargets();
  });
  
  // Load more
  elements.loadMore?.addEventListener('click', () => {
    currentOffset += PAGE_SIZE;
    loadTargets(true);
  });
}

// Initialize
async function init() {
  initEventListeners();
  
  // Load all data in parallel
  await Promise.all([
    loadStats(),
    loadMaterials(),
    loadDiameters(),
    loadThicknesses(),
    loadTargets()
  ]);
}

// Start app
document.addEventListener('DOMContentLoaded', init);

// Expose for onclick handlers
window.removeFilter = removeFilter;
window.prefillQuote = prefillQuote;
