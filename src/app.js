import { initDataModule, getProgramById } from './data.js';
import {
  escapeHtml as eh,
  escapeAttr as ea,
  sanitizePlainText,
  sanitizeRichHtml,
  sanitizeProgramStrings
} from './security.js';
import {
  trackVisit,
  trackWizardUsed,
  trackListCreated,
  startPresence,
  fetchSimpleStats,
  formatStatNumber
} from './usageStats.js';

const NO_DATA_NOTE = 'Bu alan için doğrulanmış resmî veri bulunamadı.';

export const getMetricScore = (item, key) => {
  const scoreKey = key.endsWith('_score') ? key : `${key}_score`;
  const availKey = `${key.replace(/_score$/, '')}_data_available`;
  const available = item[availKey];
  const score = item[scoreKey] ?? item[key];
  if (available === false || score == null || score === '') return null;
  return score;
};

export const formatMetricDisplay = (score, desc, dataNote, viewMode = 'scores') => {
  if (score == null) {
    const note = eh(dataNote || NO_DATA_NOTE);
    if (viewMode === 'scores') {
      return `<span class="score-pill score-na" title="${note}">—</span>`;
    }
    return `<div class="cell-sub cell-na" title="${note}">${note}</div>`;
  }
  if (viewMode === 'scores') {
    return `<span class="score-pill">${Math.round(score * 10)} / 100</span>`;
  }
  const safeDesc = eh(desc || '—');
  return `<div class="cell-sub" title="${ea(desc || '')}">${safeDesc}</div>`;
};

export function sanitizeItem(item) {
  const newItem = sanitizeProgramStrings(item);
  const metrics = ['prestige', 'academic', 'uniar', 'transport'];
  metrics.forEach((key) => {
    const score = getMetricScore(newItem, key);
    const availKey = `${key}_data_available`;
    if (score == null) {
      newItem[`${key}_score`] = null;
      if (newItem[availKey] !== true) {
        newItem[availKey] = false;
        newItem[`${key}_data_note`] = newItem[`${key}_data_note`] || NO_DATA_NOTE;
        newItem[`${key}_desc`] = newItem[`${key}_data_note`];
      }
    }
  });
  if (newItem.partial_rating != null) {
    newItem.rating = newItem.partial_rating;
  }
  return newItem;
}

const PAGE_SIZE = 100;
let MASTER_DATABASE = [];

const itemId = (raw) => String(raw);

const bootstrapDatabase = async () => {
  const raw = await initDataModule();
  MASTER_DATABASE = raw.map(sanitizeItem);
  return MASTER_DATABASE;
};

// SVG Icon Helper Constants (Pure Monochrome / Emoji-Free)
const SVG_STAR_FILLED = `<svg class="icon-svg" style="fill:currentColor; color:#18181b;" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const SVG_STAR_OUTLINE = `<svg class="icon-svg" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const SVG_INSPECT = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
const SVG_DELETE = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const SVG_UNDO = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
const SVG_DRAG = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`;
const SVG_UP = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>`;
const SVG_DOWN = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
const SVG_REMOVE = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SVG_SAVE = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`;
const SVG_REFRESH = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>`;
const SVG_CHECK = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
const SVG_BARS = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`;

const DEFAULT_RATING_WEIGHTS = {
  prestige: 40,
  academic: 30,
  transport: 15,
  student_life: 15
};

class MasterApp {
  constructor() {
    this.data = this.loadState();
    this.viewMode = 'scores'; // 'scores' (Puanlar 1-10) or 'descriptions' (Metinler)
    this.filterDegree = 'all'; // 'all', 'Lisans (4Y)', 'Önlisans (2Y)'
    this.searchQuery = '';
    this.cityFilter = '';
    this.langFilter = '';
    this.tuitionFilter = '';
    this.minRatingFilter = 0; // 0, 5, 6, 7, 8, 9
    this.sortOrder = 'rating-desc';
    this.currentPage = 1;

    // Favorites Order Array of IDs
    this.favoriteOrder = this.loadFavoriteOrder();

    // Pairwise Wizard State
    this.wizardPairs = [];
    this.wizardCurrentIndex = 0;
    this.wizardScores = {}; // id -> win count
    this.wizardHeadToHead = {}; // id1_vs_id2 -> winnerId
    this.wizardChoices = []; // index -> 'A' | 'B' | null
    this.wizardListFilter = 'all'; // 'all' | 'answered' | 'pending'

    // Comparison State
    const cleanCompare = (val) => {
      if (Array.isArray(val)) {
        if (val.length === 2) return val;
        if (val.length > 2) return [val[0], val[1]];
        if (val.length === 1) return [val[0], null];
      }
      return [null, null];
    };
    this.comparePrograms = cleanCompare(this.loadCompareState('yks_compare_programs'));
    this.compareUnis = cleanCompare(this.loadCompareState('yks_compare_unis'));
    this.compareDepts = cleanCompare(this.loadCompareState('yks_compare_depts'));
    this.activeCompareMode = localStorage.getItem('yks_compare_mode') || 'program';
  }

  calculateRating(item) {
    if (item.partial_rating != null) {
      return parseFloat(item.partial_rating);
    }
    const prestige = getMetricScore(item, 'prestige');
    const academic = getMetricScore(item, 'academic');
    const transport = getMetricScore(item, 'transport');
    const student_life = getMetricScore(item, 'uniar');
    const parts = [
      [prestige, DEFAULT_RATING_WEIGHTS.prestige],
      [academic, DEFAULT_RATING_WEIGHTS.academic],
      [transport, DEFAULT_RATING_WEIGHTS.transport],
      [student_life, DEFAULT_RATING_WEIGHTS.student_life],
    ].filter(([s]) => s != null);
    if (!parts.length) return null;
    const totalWeight = parts.reduce((sum, [, w]) => sum + w, 0);
    const rawVal = parts.reduce((sum, [s, w]) => sum + s * w, 0);
    return parseFloat((rawVal / totalWeight).toFixed(1));
  }

  loadCompareState(key) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  }

  saveCompareState(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  loadState() {
    let deletedIds = [];

    try {
      const deleted = localStorage.getItem('yks_deleted_ids');
      if (deleted) deletedIds = JSON.parse(deleted);
    } catch (e) {}

    const deletedSet = new Set(deletedIds);
    const saved = localStorage.getItem('yks_master_v8_employability_data');
    const savedFavorites = localStorage.getItem('yks_favorite_ids');
    let favoriteIds = new Set();
    try {
      if (savedFavorites) favoriteIds = new Set(JSON.parse(savedFavorites));
    } catch (e) {}

    const mergeSavedFields = (item) => {
      const rating = this.calculateRating(item);
      const isFavorite = favoriteIds.has(item.id) || favoriteIds.has(String(item.id));

      if (!saved) return { ...item, rating, isFavorite };

      try {
        const parsed = JSON.parse(saved);
        const match = parsed.find(x => String(x.id) === String(item.id));
        if (match) {
          return {
            ...item,
            rating,
            notes: typeof match.notes === 'string' ? sanitizePlainText(match.notes) : match.notes,
            isFavorite: typeof match.isFavorite === 'boolean' ? match.isFavorite : isFavorite
          };
        }
      } catch (e) {}

      return { ...item, rating, isFavorite };
    };

    return MASTER_DATABASE
      .filter(item => !deletedSet.has(item.id))
      .map(mergeSavedFields);
  }

  saveState() {
    const masterIds = new Set(MASTER_DATABASE.map(x => x.id));
    const stateToSave = this.data.map(item => ({
      id: item.id,
      rating: item.rating,
      notes: typeof item.notes === 'string' ? sanitizePlainText(item.notes) : item.notes,
      isFavorite: item.isFavorite
    }));
    localStorage.setItem('yks_master_v8_employability_data', JSON.stringify(stateToSave));

    const customPrograms = this.data.filter(item => !masterIds.has(item.id));
    localStorage.setItem('yks_custom_programs', JSON.stringify(customPrograms));

    this.updateStats();
  }

  loadFavoriteOrder() {
    const saved = localStorage.getItem('yks_fav_v5_order');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return MASTER_DATABASE.map(x => x.id);
  }

  saveFavoriteOrder() {
    localStorage.setItem('yks_fav_v5_order', JSON.stringify(this.favoriteOrder));
  }

  toggleFavorite(id) {
    const key = itemId(id);
    const item = this.data.find(x => itemId(x.id) === key);
    if (!item) return;

    item.isFavorite = !item.isFavorite;
    if (item.isFavorite) {
      if (!this.favoriteOrder.includes(id)) {
        this.favoriteOrder.push(id);
      }
    } else {
      this.favoriteOrder = this.favoriteOrder.filter(x => x !== id);
    }
    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
  }

  clearAllFavorites() {
    this.data.forEach(item => {
      item.isFavorite = false;
    });
    this.favoriteOrder = [];
    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
  }

  deleteItem(id) {
    const key = itemId(id);
    const index = this.data.findIndex(x => itemId(x.id) === key);
    if (index === -1) return null;
    const item = this.data[index];
    const wasFavorite = item.isFavorite || this.favoriteOrder.map(itemId).includes(key);
    const masterIds = new Set(MASTER_DATABASE.map(x => itemId(x.id)));

    this.data.splice(index, 1);
    this.favoriteOrder = this.favoriteOrder.filter(x => itemId(x) !== key);

    if (masterIds.has(key)) {
      const deletedIds = JSON.parse(localStorage.getItem('yks_deleted_ids') || '[]');
      if (!deletedIds.map(itemId).includes(key)) {
        deletedIds.push(key);
        localStorage.setItem('yks_deleted_ids', JSON.stringify(deletedIds));
      }
    }

    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
    return { item, index, wasFavorite };
  }

  restoreItem(info) {
    if (!info || !info.item) return;
    const { item, index, wasFavorite } = info;
    if (index >= 0 && index <= this.data.length) {
      this.data.splice(index, 0, item);
    } else {
      this.data.push(item);
    }
    if (wasFavorite && !this.favoriteOrder.includes(item.id)) {
      this.favoriteOrder.push(item.id);
    }
    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
  }

  restoreAllItems() {
    localStorage.setItem('yks_cleared_list', 'true');
    localStorage.setItem('yks_custom_programs', '[]');
    localStorage.setItem('yks_deleted_ids', JSON.stringify(MASTER_DATABASE.map(x => x.id)));
    localStorage.setItem('yks_master_v8_employability_data', '[]');
    this.data = [];
    this.favoriteOrder = [];
    this.saveFavoriteOrder();
    this.updateStats();
  }

  updateItem(id, key, value) {
    const item = this.data.find(x => x.id === id);
    if (item) {
      item[key] = value;
      this.saveState();
    }
  }

  getNextId() {
    if (this.data.length === 0) return 1;
    return Math.max(...this.data.map(x => x.id)) + 1;
  }

  addProgramItem(item) {
    localStorage.removeItem('yks_cleared_list');
    this.data.push(item);
    this.saveState();
    this.updateStats();
  }

  syncFavoritesList() {
    const favIds = this.data.filter(x => x.isFavorite).map(x => x.id);

    // Keep existing order, add new favs, remove unfavs
    this.favoriteOrder = this.favoriteOrder.filter(id => favIds.includes(id));
    favIds.forEach(id => {
      if (!this.favoriteOrder.includes(id)) {
        this.favoriteOrder.push(id);
      }
    });
    this.saveFavoriteOrder();
  }

  updateStats() {
    const totalEl = document.getElementById('stat-total-count');
    const favEl = document.getElementById('stat-fav-count');
    const favHeaderCount = document.getElementById('fav-count-header');

    const favCount = this.data.filter(x => x.isFavorite).length;

    if (totalEl) totalEl.textContent = this.getFilteredData().length;
    if (favEl) favEl.textContent = favCount;
    if (favHeaderCount) favHeaderCount.textContent = favCount;
  }

  getFilteredData() {
    let result = [...this.data];

    // Segment Filter
    if (this.filterDegree !== 'all') {
      result = result.filter(x => x.degree === this.filterDegree);
    }

    // Search Query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      result = result.filter(x =>
        x.full_name.toLowerCase().includes(q) ||
        (x.faculty || '').toLowerCase().includes(q) ||
        x.city.toLowerCase().includes(q) ||
        (x.transport_desc || '').toLowerCase().includes(q) ||
        (x.department_group || '').toLowerCase().includes(q) ||
        (x.notes && x.notes.toLowerCase().includes(q))
      );
    }

    // City Filter
    if (this.cityFilter) result = result.filter(x => x.city === this.cityFilter);

    // Language Filter
    if (this.langFilter) result = result.filter(x => x.language === this.langFilter);

    // Tuition Filter
    if (this.tuitionFilter) result = result.filter(x => x.tuition_status === this.tuitionFilter);

    // Min Rating Filter (100-Point Scale)
    if (this.minRatingFilter > 0) {
      result = result.filter(x => (Math.round(x.rating * 10) || 0) >= this.minRatingFilter);
    }

    // Sorting Options
    if (this.sortOrder === 'tahmin-asc') {
      result.sort((a, b) => (a.prediction?.tahmini_skor || 999999) - (b.prediction?.tahmini_skor || 999999));
    } else if (this.sortOrder === 'rating-desc') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (this.sortOrder === 'rating-asc') {
      result.sort((a, b) => (a.rating || 0) - (b.rating || 0));
    } else if (this.sortOrder === 'prestige-desc') {
      result.sort((a, b) => (getMetricScore(b, 'prestige') || 0) - (getMetricScore(a, 'prestige') || 0));
    } else if (this.sortOrder === 'academic-desc') {
      result.sort((a, b) => (b.academic_score || 0) - (a.academic_score || 0));
    } else if (this.sortOrder === 'transport-desc') {
      result.sort((a, b) => (getMetricScore(b, 'transport') || 0) - (getMetricScore(a, 'transport') || 0));
    } else if (this.sortOrder === 'uniar-desc') {
      result.sort((a, b) => (getMetricScore(b, 'uniar') || 0) - (getMetricScore(a, 'uniar') || 0));
    } else if (this.sortOrder === 'y5-asc') {
      result.sort((a, b) => (a.last_rank || 999999) - (b.last_rank || 999999));
    } else {
      result.sort((a, b) => a.id - b.id);
    }

    return result;
  }

  recalculateWizardScores() {
    const candidates = this.favoriteOrder
      .map(id => this.data.find(x => x.id === id))
      .filter(Boolean);

    this.wizardScores = {};
    this.wizardHeadToHead = {};

    candidates.forEach(x => { this.wizardScores[x.id] = 0; });

    this.wizardChoices.forEach((choice, idx) => {
      if (!choice) return;
      const pair = this.wizardPairs[idx];
      if (!pair) return;
      const [itemA, itemB] = pair;
      const winner = choice === 'A' ? itemA : itemB;
      const loser = choice === 'A' ? itemB : itemA;

      this.wizardScores[winner.id] = (this.wizardScores[winner.id] || 0) + 1;
      this.wizardHeadToHead[`${winner.id}_vs_${loser.id}`] = winner.id;
    });
  }

  getWizardFavoriteHash() {
    return [...this.favoriteOrder].sort((a, b) => a - b).join(',');
  }

  saveWizardState() {
    if (!this.wizardPairs.length) return;
    try {
      localStorage.setItem('yks_wizard_state_v1', JSON.stringify({
        hash: this.getWizardFavoriteHash(),
        pairIds: this.wizardPairs.map(([a, b]) => [a.id, b.id]),
        choices: this.wizardChoices,
        currentIndex: this.wizardCurrentIndex,
        listFilter: this.wizardListFilter
      }));
    } catch (e) {}
  }

  restoreWizardState() {
    try {
      const raw = localStorage.getItem('yks_wizard_state_v1');
      if (!raw) return false;

      const state = JSON.parse(raw);
      if (state.hash !== this.getWizardFavoriteHash()) return false;
      if (!Array.isArray(state.pairIds) || !state.pairIds.length) return false;

      const pairs = state.pairIds.map(([idA, idB]) => {
        const itemA = this.data.find(x => x.id === idA);
        const itemB = this.data.find(x => x.id === idB);
        if (!itemA || !itemB) return null;
        return [itemA, itemB];
      });

      if (pairs.some(p => !p)) return false;

      this.wizardPairs = pairs;
      this.wizardChoices = Array.isArray(state.choices)
        ? state.choices.map(c => (c === 'A' || c === 'B' ? c : null))
        : Array(pairs.length).fill(null);
      this.wizardCurrentIndex = Number.isInteger(state.currentIndex)
        ? Math.min(Math.max(state.currentIndex, 0), pairs.length - 1)
        : 0;
      this.wizardListFilter = ['all', 'answered', 'pending'].includes(state.listFilter)
        ? state.listFilter
        : 'all';
      this.recalculateWizardScores();
      return true;
    } catch (e) {
      return false;
    }
  }

  clearWizardState() {
    try {
      localStorage.removeItem('yks_wizard_state_v1');
    } catch (e) {}
  }
}

const app = new MasterApp();

document.addEventListener('DOMContentLoaded', async () => {
  const loader = document.getElementById('app-loading');
  try {
    if (loader) loader.classList.remove('hidden');
    await bootstrapDatabase();
    app.data = app.loadState();
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
      subtitle.textContent = `${MASTER_DATABASE.length.toLocaleString('tr-TR')} Program | Deterministik Karar Motoru`;
    }
    const totalBadge = document.getElementById('stat-total-count');
    if (totalBadge) totalBadge.textContent = MASTER_DATABASE.length.toLocaleString('tr-TR');
  } catch (e) {
    console.error('Veritabanı yükleme hatası:', e);
    alert('Analiz veritabanı yüklenemedi. Lütfen build_analysis_database.py çalıştırın.');
  } finally {
    if (loader) loader.classList.add('hidden');
  }

  trackVisit();
  startPresence();
  app.syncFavoritesList();
  setupNavTabs();
  setupFilterEvents();
  setupViewModeToggle();
  populateDropdowns();
  renderMasterTable();
  renderFavoritesList();
  setupModalEvents();
  setupAddProgramModal();
  setupDisclaimer();
  setupPairwiseWizard();
  setupCompareHub();
});

// Navigation Tabs Logic
function setupNavTabs() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      t.classList.add('active');
      const targetId = t.dataset.tab;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');

      if (targetId === 'tab-favorites') {
        renderFavoritesList();
      } else if (targetId === 'tab-pairwise') {
        startPairwiseWizard();
      } else if (targetId === 'tab-compare-hub') {
        renderCompareHub();
      } else if (targetId === 'tab-stats') {
        renderUsageStatsPage();
      }
    });
  });
}

// Display Mode Toggle (Scores vs Descriptions)
function setupViewModeToggle() {
  const toggleBtn = document.getElementById('btn-toggle-view-mode');
  if (!toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    if (app.viewMode === 'scores') {
      app.viewMode = 'descriptions';
      toggleBtn.innerHTML = `${SVG_INSPECT} Metinler (Açıklama)`;
    } else {
      app.viewMode = 'scores';
      toggleBtn.innerHTML = `${SVG_BARS} Puanlar (1-10)`;
    }
    renderMasterTable();
    renderFavoritesList();
  });
}

function populateDropdowns() {
  const citySelect = document.getElementById('filter-city');
  if (citySelect) {
    const cities = [...new Set(app.data.map(x => x.city))].sort();
    citySelect.innerHTML = '<option value="">Tümü</option>';
    cities.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      citySelect.appendChild(opt);
    });
  }
}

function setupFilterEvents() {
  document.querySelectorAll('.filter-bar .seg-btn[data-filter-degree]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-bar .seg-btn[data-filter-degree]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      app.filterDegree = btn.dataset.filterDegree;
      resetTablePage();
      renderMasterTable();
    });
  });

  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      app.searchQuery = e.target.value;
      resetTablePage();
      renderMasterTable();
    });
  }

  const citySelect = document.getElementById('filter-city');
  const langSelect = document.getElementById('filter-lang');
  const tuitionSelect = document.getElementById('filter-tuition');
  const minRatingSelect = document.getElementById('filter-min-rating');
  const sortSelect = document.getElementById('sort-order');

  if (citySelect) citySelect.addEventListener('change', (e) => { app.cityFilter = e.target.value; resetTablePage(); renderMasterTable(); });
  if (langSelect) langSelect.addEventListener('change', (e) => { app.langFilter = e.target.value; resetTablePage(); renderMasterTable(); });
  if (tuitionSelect) tuitionSelect.addEventListener('change', (e) => { app.tuitionFilter = e.target.value; resetTablePage(); renderMasterTable(); });
  if (minRatingSelect) minRatingSelect.addEventListener('change', (e) => { app.minRatingFilter = parseFloat(e.target.value) || 0; resetTablePage(); renderMasterTable(); });
  if (sortSelect) sortSelect.addEventListener('change', (e) => { app.sortOrder = e.target.value; resetTablePage(); renderMasterTable(); });

  const restoreBtn = document.getElementById('btn-restore-all');
  if (restoreBtn) {
    restoreBtn.onclick = () => {
      if (confirm('Tüm bölümleri listeden silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
        app.restoreAllItems();
        renderMasterTable();
        renderFavoritesList();
        renderCompareHub();
      }
    };
  }

  // Clickable Column Header Sorting
  document.querySelectorAll('#master-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const sortKey = th.dataset.sort;
      if (sortKey) {
        app.sortOrder = sortKey;
        if (sortSelect) sortSelect.value = sortKey;
        renderMasterTable();
      }
    });
  });
}

function resetTablePage() {
  app.currentPage = 1;
}

function renderTablePagination(total, totalPages, startIndex) {
  const container = document.getElementById('table-pagination');
  if (!container) return;

  if (total === 0) {
    container.innerHTML = '';
    return;
  }

  const end = Math.min(startIndex + PAGE_SIZE, total);
  container.innerHTML = `
    <span>${(startIndex + 1).toLocaleString('tr-TR')}–${end.toLocaleString('tr-TR')} / ${total.toLocaleString('tr-TR')} program</span>
    <div class="pagination-actions">
      <button class="btn btn-outline btn-sm" id="btn-page-prev" ${app.currentPage <= 1 ? 'disabled' : ''}>Önceki</button>
      <span>Sayfa ${app.currentPage} / ${totalPages}</span>
      <button class="btn btn-outline btn-sm" id="btn-page-next" ${app.currentPage >= totalPages ? 'disabled' : ''}>Sonraki</button>
    </div>
  `;

  document.getElementById('btn-page-prev')?.addEventListener('click', () => {
    if (app.currentPage > 1) {
      app.currentPage -= 1;
      renderMasterTable();
    }
  });
  document.getElementById('btn-page-next')?.addEventListener('click', () => {
    if (app.currentPage < totalPages) {
      app.currentPage += 1;
      renderMasterTable();
    }
  });
}

// Master Table Rendering (Emoji-Free / High Contrast)
function renderMasterTable() {
  const tbody = document.getElementById('master-tbody');
  if (!tbody) return;

  const items = app.getFilteredData();
  app.updateStats();

  // Update header visual clues (dot indicator next to sorted column)
  const HEADER_NAMES = {
    'id': 'ID & Tür',
    'transport-desc': 'Ulaşım & KYK',
    'uniar-desc': 'ÜNİAR',
    'prestige-desc': 'Prestij',
    'academic-desc': 'Akademik Kadro',
    'tahmin-asc': 'Geçen Yıl / Tahmin',
    'rating-desc': 'Puanım'
  };

  document.querySelectorAll('#master-table th[data-sort]').forEach(th => {
    const key = th.dataset.sort;
    const baseName = HEADER_NAMES[key];
    if (!baseName) return;
    
    const isSorted = app.sortOrder === key || 
                     (key === 'rating-desc' && app.sortOrder === 'rating-asc');
    
    if (isSorted) {
      th.innerHTML = `${baseName} <span style="color: var(--primary); font-weight: 800; margin-left: 2px;">•</span>`;
      th.style.color = 'var(--foreground)';
    } else {
      th.innerHTML = baseName;
      th.style.color = '';
    }
  });

  tbody.innerHTML = '';

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="11" style="padding: 2.5rem; text-align: center;">
          <p style="color: var(--muted-foreground); font-size: 0.875rem; margin-bottom: 1rem;">Listeniz boş. Yeni bölüm ekleyerek başlayın.</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-add-program" style="display: inline-flex; align-items: center; gap: 0.25rem;">
            <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Bölüm Ekle
          </button>
        </td>
      </tr>
    `;
    document.getElementById('btn-empty-add-program')?.addEventListener('click', openAddProgramModal);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (app.currentPage > totalPages) app.currentPage = totalPages;
  const startIndex = (app.currentPage - 1) * PAGE_SIZE;
  const pageItems = items.slice(startIndex, startIndex + PAGE_SIZE);

  pageItems.forEach(item => {
    const tr = document.createElement('tr');

    const lastRankStr = item.last_rank ? item.last_rank.toLocaleString('tr-TR') : '-';
    const predRankStr = item.prediction && typeof item.prediction.tahmini_skor === 'number'
      ? item.prediction.tahmini_skor.toLocaleString('tr-TR')
      : '-';

    const degreeClass = item.degree.includes('Lisans') ? 'lisans' : 'onlisans';

    const renderMetricCell = (key) => {
      const score = getMetricScore(item, key);
      const desc = item[`${key}_desc`];
      const note = item[`${key}_data_note`];
      return formatMetricDisplay(score, desc, note, app.viewMode);
    };

    const starSvg = item.isFavorite ? SVG_STAR_FILLED : SVG_STAR_OUTLINE;

    tr.innerHTML = `
      <td style="text-align: center;">
        <button class="fav-star-btn ${item.isFavorite ? 'active' : ''}" data-id="${item.id}" title="Favorilere Ekle/Çıkar">${starSvg}</button>
      </td>
      <td>
        <div class="cell-stack">
          <span class="cell-title">#${item.id}</span>
          <span class="cell-tag ${degreeClass}">${item.degree}</span>
        </div>
      </td>
      <td>
        <div class="cell-stack">
          <span class="cell-title">${item.university}</span>
          <span class="cell-sub">${item.department}</span>
          <span class="cell-sub" style="color: var(--muted-foreground);">${item.faculty}</span>
        </div>
      </td>
      <td>
        <div class="cell-stack">
          <span class="cell-title">${item.city}</span>
          <span class="cell-sub">${item.language}</span>
          <span class="cell-sub">${item.tuition_status}</span>
        </div>
      </td>
      <td>${renderMetricCell('transport')}</td>
      <td>${renderMetricCell('uniar')}</td>
      <td>${renderMetricCell('prestige')}</td>
      <td>${renderMetricCell('academic')}</td>
      <td>
        <div class="cell-stack">
          <span class="cell-sub">Geçen: ${lastRankStr}</span>
          <span class="cell-title" style="font-family: var(--font-mono); font-size: 0.8125rem;">Tahmin: ${predRankStr}</span>
        </div>
      </td>
      <td>
        <span class="rating-badge font-mono">${typeof item.rating === 'number' ? Math.round(item.rating * 10) : item.rating}</span>
      </td>
      <td>
        <div style="display: flex; gap: 0.25rem;">
          <button class="btn-action detail-btn" data-id="${item.id}" title="Detaylı İncele">${SVG_INSPECT} İncele</button>
          <button class="btn-action delete-btn" data-id="${item.id}" style="background-color: var(--destructive-bg); color: var(--destructive-text); border-color: var(--destructive-border);" title="Listeden Sil">${SVG_DELETE} Sil</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  renderTablePagination(items.length, totalPages, startIndex);

  // Attach Star Toggle
  tbody.querySelectorAll('.fav-star-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = itemId(e.currentTarget.dataset.id);
      app.toggleFavorite(id);
      renderMasterTable();
    });
  });

  tbody.querySelectorAll('.detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      openDetailModal(itemId(e.currentTarget.dataset.id));
    });
  });

  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = itemId(e.currentTarget.dataset.id);
      const info = app.deleteItem(id);
      if (info) {
        renderMasterTable();
        renderFavoritesList();
        showUndoToast(info);
      }
    });
  });
}

// Single-Click Delete Undo Toast Manager (2 Seconds)
let undoTimeout = null;
let undoInterval = null;

function showUndoToast(deletedInfo) {
  let toast = document.getElementById('undo-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'undo-toast';
    toast.className = 'undo-toast';
    document.body.appendChild(toast);
  }

  if (undoTimeout) clearTimeout(undoTimeout);
  if (undoInterval) clearInterval(undoInterval);

  let remainingMs = 2000;
  const itemTitle = deletedInfo.item.full_name || deletedInfo.item.department || `Bölüm #${deletedInfo.item.id}`;

  toast.innerHTML = `
    <div class="undo-toast-content">
      <span><strong>${itemTitle}</strong> silindi.</span>
      <button id="btn-undo-delete" class="undo-btn">${SVG_UNDO} Geri Al (2.0s)</button>
    </div>
    <div class="undo-progress-bar" id="undo-progress-bar"></div>
  `;

  toast.classList.add('show');

  const btnUndo = document.getElementById('btn-undo-delete');
  const progressBar = document.getElementById('undo-progress-bar');

  btnUndo.onclick = () => {
    app.restoreItem(deletedInfo);
    toast.classList.remove('show');
    if (undoTimeout) clearTimeout(undoTimeout);
    if (undoInterval) clearInterval(undoInterval);
    renderMasterTable();
    renderFavoritesList();
  };

  const startTime = Date.now();
  undoInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    remainingMs = Math.max(0, 2000 - elapsed);
    btnUndo.innerHTML = `${SVG_UNDO} Geri Al (${(remainingMs / 1000).toFixed(1)}s)`;
    if (progressBar) {
      progressBar.style.width = `${(remainingMs / 2000) * 100}%`;
    }
    if (remainingMs <= 0) {
      clearInterval(undoInterval);
    }
  }, 50);

  undoTimeout = setTimeout(() => {
    toast.classList.remove('show');
    if (undoInterval) clearInterval(undoInterval);
  }, 2000);
}

// Favorites Drag & Drop List Rendering
function renderFavoritesList() {
  const container = document.getElementById('fav-list-container');
  if (!container) return;

  app.syncFavoritesList();
  const favItems = app.favoriteOrder
    .map(id => app.data.find(x => x.id === id))
    .filter(Boolean);

  if (favItems.length === 0) {
    container.innerHTML = '<div style="padding: 2.5rem; text-align: center; color: var(--muted-foreground); font-size: 0.8125rem;">Henüz favori bölüm eklemediniz. (Ana tercih listesindeki favori butonuna basarak ekleyebilirsiniz)</div>';
    return;
  }

  container.innerHTML = '';

  favItems.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'fav-drag-item';
    div.draggable = true;
    div.dataset.id = item.id;
    div.dataset.index = index;

    div.innerHTML = `
      <div class="fav-item-left">
        <span class="drag-handle">${SVG_DRAG}</span>
        <span class="fav-rank-num">#${index + 1}</span>
        
        <div class="fav-content-block">
          <div class="fav-item-title">${item.full_name}</div>
          <div class="fav-item-sub">${item.city} | ${item.faculty} | ${item.degree} | ${item.language} | ${item.tuition_status}</div>
          
          <div class="fav-metrics-grid">
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">Ulaşım</span>
              <span class="fav-metric-val"><strong>${item.transport_score}</strong>/10</span>
            </div>
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">ÜNİAR</span>
              <span class="fav-metric-val"><strong>${item.uniar_score}</strong>/10</span>
            </div>
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">Prestij</span>
              <span class="fav-metric-val"><strong>${item.prestige_score}</strong>/10</span>
            </div>
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">Kadro</span>
              <span class="fav-metric-val"><strong>${item.academic_score}</strong>/10</span>
            </div>
            <div class="fav-metric-item fav-metric-pred">
              <span class="fav-metric-lbl">Tahmini Sıralama</span>
              <span class="fav-metric-val"><strong>${item.prediction.tahmini_skor.toLocaleString('tr-TR')}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div class="fav-item-actions">
        <div style="display: flex; gap: 0.25rem;">
          <button class="btn-reorder btn-up" data-index="${index}">${SVG_UP}</button>
          <button class="btn-reorder btn-down" data-index="${index}">${SVG_DOWN}</button>
          <button class="btn-action detail-btn" data-id="${item.id}">${SVG_INSPECT} İncele</button>
        </div>
        <button class="btn-remove-fav" data-id="${item.id}">${SVG_REMOVE} Favorilerden Çıkar</button>
      </div>
    `;

    container.appendChild(div);
  });

  // Attach Detail Buttons in Favorites List
  container.querySelectorAll('.detail-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      openDetailModal(id);
    });
  });

  // Attach Remove Favorite Handler
  container.querySelectorAll('.btn-remove-fav').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.currentTarget.dataset.id, 10);
      app.toggleFavorite(id);
      renderFavoritesList();
      renderMasterTable();
    });
  });

  // Reorder Button Handlers
  container.querySelectorAll('.btn-up').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (idx > 0) {
        const temp = app.favoriteOrder[idx];
        app.favoriteOrder[idx] = app.favoriteOrder[idx - 1];
        app.favoriteOrder[idx - 1] = temp;
        app.saveFavoriteOrder();
        renderFavoritesList();
      }
    });
  });

  container.querySelectorAll('.btn-down').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (idx < app.favoriteOrder.length - 1) {
        const temp = app.favoriteOrder[idx];
        app.favoriteOrder[idx] = app.favoriteOrder[idx + 1];
        app.favoriteOrder[idx + 1] = temp;
        app.saveFavoriteOrder();
        renderFavoritesList();
      }
    });
  });

  // Drag and Drop Logic
  let dragSrcIndex = null;

  container.querySelectorAll('.fav-drag-item').forEach(itemEl => {
    itemEl.addEventListener('dragstart', (e) => {
      dragSrcIndex = parseInt(itemEl.dataset.index, 10);
      e.dataTransfer.effectAllowed = 'move';
    });

    itemEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    itemEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const dropIndex = parseInt(itemEl.dataset.index, 10);
      if (dragSrcIndex !== null && dragSrcIndex !== dropIndex) {
        const movedItem = app.favoriteOrder.splice(dragSrcIndex, 1)[0];
        app.favoriteOrder.splice(dropIndex, 0, movedItem);
        app.saveFavoriteOrder();
        renderFavoritesList();
      }
    });
  });

  const resetBtn = document.getElementById('btn-reset-fav-order');
  if (resetBtn) {
    resetBtn.onclick = () => {
      app.favoriteOrder = app.data.filter(x => x.isFavorite).map(x => x.id);
      app.saveFavoriteOrder();
      renderFavoritesList();
    };
  }

  const clearFavsBtn = document.getElementById('btn-clear-all-favs');
  if (clearFavsBtn) {
    clearFavsBtn.onclick = () => {
      if (confirm('Tüm favorilerinizi sıfırlamak istediğinize emin misiniz?')) {
        app.clearAllFavorites();
        renderFavoritesList();
        renderMasterTable();
      }
    };
  }

  const startFavWizardBtn = document.getElementById('btn-start-wizard-from-fav');
  if (startFavWizardBtn) {
    startFavWizardBtn.onclick = () => {
      const wizardTab = document.querySelector('.nav-tab[data-tab="tab-pairwise"]');
      if (wizardTab) wizardTab.click();
      startPairwiseWizard();
    };
  }
}

// Pairwise Decision Wizard Logic (A / B)
function setupPairwiseWizard() {
  const startBtn = document.getElementById('btn-start-wizard');
  if (startBtn) {
    startBtn.addEventListener('click', () => {
      const answered = getWizardAnsweredCount();
      if (answered > 0) {
        const restart = confirm('Mevcut cevaplarınız silinecek. Sihirbazı sıfırdan başlatmak istiyor musunuz?');
        if (!restart) return;
      }
      startPairwiseWizard(true);
    });
  }

  document.getElementById('option-a-card')?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-wizard-inspect')) return;
    handleDuelChoice('A');
  });
  document.getElementById('option-b-card')?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-wizard-inspect')) return;
    handleDuelChoice('B');
  });

  document.getElementById('btn-inspect-a')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = parseInt(document.getElementById('option-a-card')?.dataset.itemId, 10);
    if (id) openDetailModal(id);
  });
  document.getElementById('btn-inspect-b')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = parseInt(document.getElementById('option-b-card')?.dataset.itemId, 10);
    if (id) openDetailModal(id);
  });

  document.getElementById('btn-toggle-wizard-side')?.addEventListener('click', toggleWizardSidePane);

  document.querySelectorAll('[data-wizard-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      app.wizardListFilter = btn.dataset.wizardFilter || 'all';
      app.saveWizardState();
      syncWizardListFilterUI();
      renderWizardQuestionsList();
    });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    const duelArea = document.getElementById('wizard-active-duel');
    if (!duelArea || duelArea.classList.contains('hidden')) return;

    if (e.key === '1' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
      handleDuelChoice('A');
    } else if (e.key === '2' || e.key === 'b' || e.key === 'B' || e.key === 'ArrowRight') {
      handleDuelChoice('B');
    }
  });

  // Undo and Show Results buttons
  document.getElementById('btn-wizard-undo')?.addEventListener('click', handleWizardUndo);
  document.getElementById('btn-wizard-show-results')?.addEventListener('click', finishWizard);

  // Auto Favorite All Button
  document.getElementById('btn-auto-fav-top5')?.addEventListener('click', () => {
    app.data.forEach(item => {
      item.isFavorite = true;
      if (!app.favoriteOrder.includes(item.id)) app.favoriteOrder.push(item.id);
    });
    app.saveState();
    app.saveFavoriteOrder();
    renderMasterTable();
    renderFavoritesList();
    startPairwiseWizard();
  });

  // Go to main list button
  document.getElementById('btn-go-to-main-list')?.addEventListener('click', () => {
    const mainTab = document.querySelector('.nav-tab[data-tab="tab-main-list"]');
    if (mainTab) mainTab.click();
  });
}

function toggleWizardSidePane() {
  const grid = document.getElementById('wizard-layout-grid');
  const sidePane = document.getElementById('wizard-side-pane');
  const toggleBtn = document.getElementById('btn-toggle-wizard-side');
  if (!grid || !sidePane || !toggleBtn) return;

  const isCollapsed = grid.classList.toggle('side-collapsed');
  sidePane.classList.toggle('collapsed', isCollapsed);
  toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
}

function startPairwiseWizard() {
  const duelArea = document.getElementById('wizard-active-duel');
  const resultsArea = document.getElementById('wizard-final-results');
  const emptyState = document.getElementById('wizard-empty-state');

  app.syncFavoritesList();

  const candidates = app.favoriteOrder
    .map(id => app.data.find(x => x.id === id))
    .filter(Boolean);

  if (candidates.length < 2) {
    if (duelArea) duelArea.classList.add('hidden');
    if (resultsArea) resultsArea.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  trackWizardUsed();
  app.wizardPairs = [];
  app.wizardScores = {};
  app.wizardHeadToHead = {};

  candidates.forEach(x => { app.wizardScores[x.id] = 0; });

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      app.wizardPairs.push([candidates[i], candidates[j]]);
    }
  }

  for (let i = app.wizardPairs.length - 1; i > 0; i--) {
    const r = Math.floor(Math.random() * (i + 1));
    [app.wizardPairs[i], app.wizardPairs[r]] = [app.wizardPairs[r], app.wizardPairs[i]];
  }

  app.wizardChoices = Array(app.wizardPairs.length).fill(null);
  app.wizardCurrentIndex = 0;
  app.recalculateWizardScores();

  document.getElementById('btn-wizard-show-results')?.classList.add('hidden');

  if (resultsArea) resultsArea.classList.add('hidden');
  if (duelArea) duelArea.classList.remove('hidden');
  renderDuelStep();
}

function formatWizardRankDisplay(item) {
  const last = item.last_rank ? item.last_rank.toLocaleString('tr-TR') : '-';
  const pred = item.prediction?.tahmini_skor != null
    ? item.prediction.tahmini_skor.toLocaleString('tr-TR')
    : '-';
  return `${last} / ${pred}`;
}

function renderDuelStep() {
  const totalPairs = app.wizardPairs.length;

  if (app.wizardCurrentIndex >= totalPairs) {
    const firstUnanswered = app.wizardChoices.indexOf(null);
    if (firstUnanswered !== -1) {
      app.wizardCurrentIndex = firstUnanswered;
    } else {
      finishWizard();
      return;
    }
  }

  const [itemA, itemB] = app.wizardPairs[app.wizardCurrentIndex];
  const cardA = document.getElementById('option-a-card');
  const cardB = document.getElementById('option-b-card');
  if (cardA) cardA.dataset.itemId = String(itemA.id);
  if (cardB) cardB.dataset.itemId = String(itemB.id);

  const stepText = document.getElementById('duel-step-text');
  const fillBar = document.getElementById('duel-progress-fill');

  const currentStep = app.wizardCurrentIndex + 1;
  const answeredCount = app.wizardChoices.filter(c => c !== null).length;

  if (stepText) {
    stepText.textContent = `Karşılaştırma ${currentStep} / ${totalPairs} (${answeredCount} / ${totalPairs} Cevaplandı)`;
  }
  if (fillBar) {
    fillBar.style.width = `${(answeredCount / totalPairs) * 100}%`;
  }

  const undoBtn = document.getElementById('btn-wizard-undo');
  if (undoBtn) {
    undoBtn.disabled = app.wizardCurrentIndex === 0;
  }

  const showResultsBtn = document.getElementById('btn-wizard-show-results');
  if (showResultsBtn) {
    if (app.wizardChoices.every(c => c !== null)) {
      showResultsBtn.classList.remove('hidden');
    } else {
      showResultsBtn.classList.add('hidden');
    }
  }

  // Highlight selected card if answered already
  const currentChoice = app.wizardChoices[app.wizardCurrentIndex];
  if (cardA && cardB) {
    cardA.classList.remove('selected-card-highlight');
    cardB.classList.remove('selected-card-highlight');
    if (currentChoice === 'A') cardA.classList.add('selected-card-highlight');
    if (currentChoice === 'B') cardB.classList.add('selected-card-highlight');
  }

  // Option A Card
  document.getElementById('opt-a-title').textContent = itemA.full_name;
  document.getElementById('opt-a-sub').textContent = `${itemA.city} | ${itemA.faculty}`;
  document.getElementById('opt-a-trans-val').textContent = `${Math.round(itemA.transport_score * 10)} / 100`;
  document.getElementById('opt-a-trans-desc').textContent = itemA.transport_desc || 'Detay bulunmuyor.';
  document.getElementById('opt-a-uniar-val').textContent = `${Math.round(itemA.uniar_score * 10)} / 100`;
  document.getElementById('opt-a-uniar-desc').textContent = itemA.uniar_desc || 'Detay bulunmuyor.';
  document.getElementById('opt-a-prestige').textContent = `${Math.round(itemA.prestige_score * 10)} / 100`;
  document.getElementById('opt-a-academic').textContent = `${Math.round(itemA.academic_score * 10)} / 100`;
  document.getElementById('opt-a-pred').textContent = formatWizardRankDisplay(itemA);

  // Option B Card
  document.getElementById('opt-b-title').textContent = itemB.full_name;
  document.getElementById('opt-b-sub').textContent = `${itemB.city} | ${itemB.faculty}`;
  document.getElementById('opt-b-trans-val').textContent = `${Math.round(itemB.transport_score * 10)} / 100`;
  document.getElementById('opt-b-trans-desc').textContent = itemB.transport_desc || 'Detay bulunmuyor.';
  document.getElementById('opt-b-uniar-val').textContent = `${Math.round(itemB.uniar_score * 10)} / 100`;
  document.getElementById('opt-b-uniar-desc').textContent = itemB.uniar_desc || 'Detay bulunmuyor.';
  document.getElementById('opt-b-prestige').textContent = `${Math.round(itemB.prestige_score * 10)} / 100`;
  document.getElementById('opt-b-academic').textContent = `${Math.round(itemB.academic_score * 10)} / 100`;
  document.getElementById('opt-b-pred').textContent = formatWizardRankDisplay(itemB);

  renderWizardQuestionsList();
}

function handleDuelChoice(choice) {
  if (app.wizardCurrentIndex >= app.wizardPairs.length) return;

  app.wizardChoices[app.wizardCurrentIndex] = choice;
  app.recalculateWizardScores();
  app.saveWizardState();

  app.wizardCurrentIndex++;

  const allAnswered = app.wizardChoices.every(c => c !== null);
  if (allAnswered) {
    const firstUnanswered = app.wizardChoices.indexOf(null);
    if (firstUnanswered === -1) {
      finishWizard();
    } else {
      app.wizardCurrentIndex = firstUnanswered;
      renderDuelStep();
    }
  } else {
    renderDuelStep();
  }
}

function handleWizardUndo() {
  if (app.wizardCurrentIndex > 0) {
    app.wizardCurrentIndex--;
    app.wizardChoices[app.wizardCurrentIndex] = null;
    app.recalculateWizardScores();
    app.saveWizardState();
    renderDuelStep();
  }
}

function getWizardShortName(fullName) {
  return (fullName || '').split(' - ')[0];
}

function getWizardAnsweredCount() {
  return app.wizardChoices.filter(c => c !== null).length;
}

function updateWizardHistoryBadge() {
  const toggleBtn = document.getElementById('btn-toggle-wizard-side');
  if (!toggleBtn) return;

  const answered = getWizardAnsweredCount();
  const total = app.wizardPairs.length;
  const badge = toggleBtn.querySelector('.wizard-history-badge');

  if (!total || answered === 0) {
    badge?.remove();
    return;
  }

  const label = badge || document.createElement('span');
  label.className = 'wizard-history-badge';
  label.textContent = `${answered}/${total}`;
  if (!badge) toggleBtn.appendChild(label);
}

function syncWizardListFilterUI() {
  document.querySelectorAll('[data-wizard-filter]').forEach(btn => {
    const isActive = btn.dataset.wizardFilter === app.wizardListFilter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
}

function getFilteredWizardEntries() {
  return app.wizardPairs
    .map((pair, idx) => ({ pair, idx, choice: app.wizardChoices[idx] }))
    .filter(({ choice }) => {
      if (app.wizardListFilter === 'answered') return choice !== null;
      if (app.wizardListFilter === 'pending') return choice === null;
      return true;
    });
}

function buildWizardQuestionItem(pair, idx, choice, isActive, { readOnly = false } = {}) {
  const [itemA, itemB] = pair;
  const uNameA = getWizardShortName(itemA.full_name);
  const uNameB = getWizardShortName(itemB.full_name);
  const winnerName = choice === 'A' ? uNameA : choice === 'B' ? uNameB : null;
  const statusText = winnerName ? `→ ${winnerName}` : 'Bekliyor';

  const itemDiv = document.createElement('div');
  itemDiv.className = `question-item${isActive ? ' active' : ''}${choice ? ' answered' : ''}`;
  itemDiv.dataset.index = idx;

  itemDiv.innerHTML = `
    <div class="question-item-header">
      <span>Soru ${idx + 1}</span>
      <span class="question-item-status">${statusText}</span>
    </div>
    <div class="question-item-options">
      <button type="button" class="q-opt-btn ${choice === 'A' ? 'selected' : ''}" data-choice="A" title="${eh(itemA.full_name)}" ${readOnly ? 'tabindex="-1"' : ''}>${eh(uNameA)}</button>
      <span class="question-item-vs">vs</span>
      <button type="button" class="q-opt-btn ${choice === 'B' ? 'selected' : ''}" data-choice="B" title="${eh(itemB.full_name)}" ${readOnly ? 'tabindex="-1"' : ''}>${eh(uNameB)}</button>
    </div>
  `;

  return itemDiv;
}

function attachWizardQuestionItemHandlers(itemDiv, idx, { readOnly = false, onAfterChange } = {}) {
  itemDiv.addEventListener('click', (e) => {
    const optBtn = e.target.closest('.q-opt-btn');
    if (optBtn && !readOnly) {
      e.stopPropagation();
      app.wizardChoices[idx] = optBtn.dataset.choice;
      app.recalculateWizardScores();
      app.saveWizardState();

      if (app.wizardChoices.every(c => c !== null)) {
        const resultsArea = document.getElementById('wizard-final-results');
        if (resultsArea && !resultsArea.classList.contains('hidden')) {
          finishWizard();
          return;
        }
      }

      if (typeof onAfterChange === 'function') onAfterChange();
      return;
    }

    app.wizardCurrentIndex = idx;
    if (readOnly) {
      document.getElementById('wizard-final-results')?.classList.add('hidden');
      document.getElementById('wizard-active-duel')?.classList.remove('hidden');
    }
    renderDuelStep();
  });
}

function renderWizardQuestionsList() {
  const listContainer = document.getElementById('wizard-questions-list');
  if (!listContainer) return;

  const entries = getFilteredWizardEntries();
  listContainer.innerHTML = '';

  if (!entries.length) {
    const emptyMsg = app.wizardListFilter === 'answered'
      ? 'Henüz cevaplanmış karşılaştırma yok.'
      : app.wizardListFilter === 'pending'
        ? 'Tüm karşılaştırmalar cevaplandı.'
        : 'Karşılaştırma bulunamadı.';
    listContainer.innerHTML = `<div class="wizard-list-empty">${emptyMsg}</div>`;
    updateWizardHistoryBadge();
    return;
  }

  entries.forEach(({ pair, idx, choice }) => {
    const isActive = idx === app.wizardCurrentIndex;
    const itemDiv = buildWizardQuestionItem(pair, idx, choice, isActive);
    attachWizardQuestionItemHandlers(itemDiv, idx, { onAfterChange: renderDuelStep });
    listContainer.appendChild(itemDiv);
  });

  const activeEl = listContainer.querySelector('.question-item.active');
  if (activeEl) {
    activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  updateWizardHistoryBadge();
}

function renderWizardResultsAnswersList() {
  const listContainer = document.getElementById('wizard-results-answers-list');
  const section = document.getElementById('wizard-results-answers');
  if (!listContainer || !section) return;

  const answeredEntries = app.wizardPairs
    .map((pair, idx) => ({ pair, idx, choice: app.wizardChoices[idx] }))
    .filter(({ choice }) => choice !== null);

  if (!answeredEntries.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  listContainer.innerHTML = '';

  answeredEntries.forEach(({ pair, idx, choice }) => {
    const itemDiv = buildWizardQuestionItem(pair, idx, choice, false, { readOnly: true });
    attachWizardQuestionItemHandlers(itemDiv, idx, { readOnly: true });
    listContainer.appendChild(itemDiv);
  });
}

function finishWizard() {
  document.getElementById('wizard-active-duel').classList.add('hidden');
  const resultsArea = document.getElementById('wizard-final-results');
  const tbody = document.getElementById('wizard-final-tbody');

  const candidates = app.favoriteOrder
    .map(id => app.data.find(x => x.id === id))
    .filter(Boolean);

  const totalRoundsPerItem = candidates.length - 1;

  const sortedCandidates = [...candidates].sort((a, b) => {
    const winsA = app.wizardScores[a.id] || 0;
    const winsB = app.wizardScores[b.id] || 0;
    if (winsB !== winsA) return winsB - winsA;

    if (app.wizardHeadToHead && app.wizardHeadToHead[`${a.id}_vs_${b.id}`]) return -1;
    if (app.wizardHeadToHead && app.wizardHeadToHead[`${b.id}_vs_${a.id}`]) return 1;

    return (b.rating || 0) - (a.rating || 0);
  });

  const rankedIds = sortedCandidates.map(x => x.id);

  tbody.innerHTML = '';

  sortedCandidates.forEach((item, index) => {
    const wins = app.wizardScores[item.id] || 0;
    const winRate = totalRoundsPerItem > 0 ? Math.round((wins / totalRoundsPerItem) * 100) : 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-weight:700; text-align:center;">#${index + 1}</td>
      <td>
        <div style="font-weight:700; color:var(--foreground);">${item.full_name}</div>
        <div style="font-size:0.75rem; color:var(--muted-foreground);">${item.faculty} | ${item.tuition_status} | ${item.language}</div>
      </td>
      <td>${item.city}</td>
      <td>
        <span class="score-pill">
          ${wins} / ${totalRoundsPerItem} Galibiyet (%${winRate})
        </span>
      </td>
    `;
    tbody.appendChild(tr);
  });

  let actionsDiv = document.getElementById('wizard-results-actions');
  if (!actionsDiv) {
    actionsDiv = document.createElement('div');
    actionsDiv.id = 'wizard-results-actions';
    actionsDiv.style.marginTop = '1.25rem';
    actionsDiv.style.display = 'flex';
    actionsDiv.style.gap = '0.75rem';
    actionsDiv.style.flexWrap = 'wrap';
    resultsArea.appendChild(actionsDiv);
  }

  actionsDiv.innerHTML = `
    <button id="btn-save-wizard-order-to-fav" class="btn btn-primary">${SVG_SAVE} Bu Sonucu Favori Listeme Kaydet</button>
    <button id="btn-edit-wizard-choices" class="btn btn-outline">${SVG_UNDO} Seçimleri Düzenle / Değiştir</button>
    <button id="btn-restart-wizard" class="btn btn-outline">${SVG_REFRESH} Sihirbazı Tekrar Başlat</button>
  `;

  document.getElementById('btn-save-wizard-order-to-fav').onclick = () => {
    app.favoriteOrder = [...rankedIds];
    app.saveFavoriteOrder();
    const btn = document.getElementById('btn-save-wizard-order-to-fav');
    btn.innerHTML = `${SVG_CHECK} Favori Listeniz Güncellendi!`;
    setTimeout(() => {
      btn.innerHTML = `${SVG_SAVE} Bu Sonucu Favori Listeme Kaydet`;
    }, 2500);
    renderFavoritesList();
  };

  document.getElementById('btn-edit-wizard-choices').onclick = () => {
    resultsArea.classList.add('hidden');
    document.getElementById('wizard-active-duel').classList.remove('hidden');
    // Start by editing the first step, or keep it at the end
    app.wizardCurrentIndex = 0;
    renderDuelStep();
  };

  document.getElementById('btn-restart-wizard').onclick = () => startPairwiseWizard(true);

  renderWizardResultsAnswersList();
  app.saveWizardState();
  resultsArea.classList.remove('hidden');
  trackListCreated();
}

function getQualitativeReason(subKey, value) {
  switch (subKey) {
    case 'employer_reputation':
      if (value >= 9) return "İşveren saygınlığı ve diploma değeri zirve seviyede.";
      if (value >= 7) return "Sektörde yüksek tanınırlık ve kurumsal marka gücü.";
      if (value >= 5) return "Ortalama sektör tanınırlığına sahip diploma.";
      return "Sektör tanınırlığı sınırlı, bireysel portfolyo daha önemli.";
    case 'employment_rate':
      if (value >= 9) return "Mezunların ilk 3-6 ayda işe yerleşme oranı çok yüksek.";
      if (value >= 7) return "İstihdam oranları ve iş bulma hızı tatmin edici seviyede.";
      if (value >= 5) return "Ortalama işe yerleşme hızı, staj tecrübesi gerektirir.";
      return "İstihdam süreleri uzun, adayların kendilerini geliştirmesi şart.";
    case 'alumni_network':
      if (value >= 9) return "Çok güçlü ve sektörü domine eden mezun ağı.";
      if (value >= 7) return "Geniş mezun ağı ve aktif dayanışma platformları.";
      if (value >= 5) return "Standart mezun ilişkileri ve bölgesel iş birlikleri.";
      return "Gelişmekte olan, sınırlı mezun network gücü.";
    case 'academic_reputation':
      if (value >= 9) return "Ulusal ve uluslararası akademik çevrelerde yüksek saygınlık.";
      if (value >= 7) return "Köklü akademik gelenek ve bilimsel tanınırlık.";
      if (value >= 5) return "Temel akademik standartları karşılayan saygınlık.";
      return "Akademik bilinirliği ve yayın performansı sınırlı.";
    case 'industry_collaboration':
      if (value >= 8) return "Sanayi projeleri (TÜBİTAK vb.) ve ortaklıklar çok güçlü.";
      if (value >= 6) return "Düzenli sanayi iş birlikleri ve staj anlaşmaları mevcut.";
      if (value >= 4) return "Temel düzeyde sanayi entegrasyonu var.";
      return "Sanayi iş birlikleri ve sektör bağlantıları zayıf.";
    case 'research_power':
      if (value >= 8) return "Bilimsel araştırma altyapısı ve laboratuvar olanakları üst düzey.";
      if (value >= 6) return "Aktif araştırma projeleri ve araştırma merkezleri var.";
      if (value >= 4) return "Temel araştırma ve proje faaliyetleri yürütülüyor.";
      return "Araştırma ve geliştirme (Ar-Ge) altyapısı sınırlı.";
    case 'mudek_fedek':
      return value > 0 ? "MÜDEK/FEDEK akreditasyonuna sahip, müfredat onaylı." : "Akreditasyon süreci henüz tamamlanmamış.";
    case 'professor_count':
      if (value >= 12) return "Çok zengin profesör kadrosu ve köklü anabilim dalı.";
      if (value >= 8) return "Yeterli sayıda profesör ve deneyimli öğretim kadrosu.";
      if (value >= 5) return "Standart profesör kadrosu ve genç akademisyenler.";
      return "Profesör sayısı kısıtlı, kadro gelişme aşamasında.";
    case 'student_faculty_ratio':
      if (value >= 8) return "Hoca-öğrenci oranı çok iyi (birebir iletişim kolay).";
      if (value >= 6) return "Hoca-öğrenci oranı standart ve dengeli.";
      return "Hoca başına düşen öğrenci sayısı yüksek (kalabalık sınıflar).";
    case 'sci_publications':
      if (value >= 12) return "Uluslararası SCI indeksli yayın performansı mükemmel.";
      if (value >= 7) return "Akademisyenlerin SCI dergilerindeki yayın sayısı iyi.";
      return "Akademik kadronun SCI yayın üretkenliği geliştirilmeli.";
    case 'tubitak_projects':
      if (value >= 8) return "Çok sayıda aktif TÜBİTAK ve AR-GE projesi barındırıyor.";
      if (value >= 5) return "Yürütülen TÜBİTAK ve bilimsel araştırma projeleri mevcut.";
      return "Proje üretkenliği ve fonlama performansı düşük.";
    case 'erasmus_mobility':
      if (value >= 4) return "Avrupa'nın seçkin üniversiteleriyle çok yönlü Erasmus anlaşmaları.";
      if (value >= 3) return "Yeterli sayıda kontenjan ve Erasmus değişim imkanı.";
      return "Uluslararası değişim ve Erasmus olanakları sınırlı.";
    case 'lab_facilities':
      if (value >= 8) return "Gelişmiş donanımlı laboratuvarlar ve AR-GE altyapısı var.";
      if (value >= 6) return "Öğrencilerin kullanımı için yeterli bilgisayar/laboratuvar ortamı.";
      return "Laboratuvar olanakları temel standartlarda.";
    case 'teknopark_presence':
      if (value >= 5) return "Üniversite bünyesinde çok güçlü bir Teknoloji Geliştirme Bölgesi var.";
      if (value >= 3) return "Teknokent/Teknopark iş birlikleri ve staj imkanları mevcut.";
      return "Bünyesinde teknopark bulunmuyor veya pasif durumda.";
    case 'metro_access':
      return value >= 8 ? "Metro istasyonuna yürüme mesafesinde kolay erişim var." : "Doğrudan metro durağı veya hattı bulunmuyor.";
    case 'tram_access':
      return value >= 8 ? "Tramvay istasyonuna yürüme mesafesinde kolay erişim var." : "Doğrudan tramvay bağlantısı bulunmuyor.";
    case 'bus_frequency':
      if (value >= 8) return "Çok sık kalkan otobüs ve dolmuş hatları kampüse ulaşıyor.";
      if (value >= 6) return "Otobüs sefer sıklığı yeterli, ulaşım sorunu yaşanmıyor.";
      return "Toplu taşıma sefer sıklığı seyrek, ulaşım planlanmalı.";
    case 'kyk_dorm_capacity':
      if (value >= 8) return "KYK yurt kapasitesi bölge için oldukça yüksek.";
      if (value >= 6) return "Yurt sayısı ve kapasitesi dengeli.";
      return "KYK yurt kapasitesi kısıtlı veya yoğun talep var.";
    case 'kyk_occupancy_rate':
      if (value >= 8) return "KYK yurdu bulma ve yerleşme ihtimali yüksek (düşük yoğunluk).";
      if (value >= 5) return "KYK yurt doluluk oranları orta seviyede.";
      return "Yurt doluluk oranları çok yüksek (yedek sırası beklenebilir).";
    case 'inner_campus_transit':
      if (value >= 8) return "Kampüs içi ring, servis ve ulaşım imkanları çok düzenli.";
      return "Kampüs içi ulaşım yürüyerek veya temel araçlarla yapılıyor.";
    case 'city_transit_integration':
      if (value >= 8) return "Büyükşehir toplu taşıma kartları ve entegrasyonu çok gelişmiş.";
      return "Şehir içi ulaşım entegrasyonu temel düzeyde.";
    case 'uniar_satisfaction':
      if (value >= 9) return "ÜNİAR genel öğrenci memnuniyeti puanı zirve (A+) grupta.";
      if (value >= 7) return "Öğrencilerin genel üniversite memnuniyeti yüksek derecede.";
      if (value >= 5) return "Orta seviyede öğrenci memnuniyeti raporlanmış.";
      return "Öğrenci memnuniyet oranları düşük seviyede seyrediyor.";
    case 'student_clubs':
      if (value >= 8) return "Çok aktif öğrenci kulüpleri ve zengin sosyal etkinlikler.";
      if (value >= 6) return "Yeterli sayıda kulüp faaliyeti ve topluluk mevcut.";
      return "Öğrenci kulüpleri ve kampüs sosyal yaşamı durağan.";
    case 'erasmus_mobility_rate':
      if (value >= 7) return "Yurt dışına giden ve gelen Erasmus öğrenci yoğunluğu yüksek.";
      if (value >= 5) return "Erasmus programıyla yurt dışı değişim oranları dengeli.";
      return "Uluslararası öğrenci hareketliliği düşük seviyede.";
    case 'sports_facilities':
      if (value >= 8) return "Gelişmiş spor salonları, sahalar ve yüzme havuzları mevcut.";
      if (value >= 6) return "Öğrencilerin yararlanabileceği spor tesisleri bulunuyor.";
      return "Spor tesisleri ve rekreasyon alanları sınırlı.";
    case 'campus_size':
      if (value >= 8) return "Çok geniş, yeşil alanları bol ve modern bir kampüs.";
      if (value >= 6) return "Standart genişlikte ve sosyal alanları olan bir yerleşke.";
      return "Sınırlı alana sahip şehir veya bina kampüsü.";
    default:
      return `${subKey}: ${value}`;
  }
}

function getOverallMetricDescription(item, key, score) {
  const scorePercent = Math.round(score * 10);
  switch (key) {
    case 'prestige':
      return `Diploma gücü ve işveren itibarı 100 üzerinden <strong>${scorePercent}</strong> seviyesindedir. ${eh(item.prestige_desc || 'Sektör genelinde yüksek tanınırlığa sahiptir.')}`;
    case 'academic':
      return `Akademik yeterlilik ve kadro gücü 100 üzerinden <strong>${scorePercent}</strong> olarak değerlendirilmiştir. ${eh(item.academic_desc || 'Deneyimli öğretim üyeleri barındırmaktadır.')}`;
    case 'transport':
      return `Kampüse ulaşım ve KYK yurt erişilebilirliği 100 üzerinden <strong>${scorePercent}</strong> düzeyindedir. ${eh(item.transport_desc || 'Toplu taşıma seçenekleri mevcuttur.')}`;
    case 'student_life':
      return `Öğrenci kulüpleri, spor imkanları ve kampüs yaşamı memnuniyeti 100 üzerinden <strong>${scorePercent}</strong>'dur. ${eh(item.uniar_desc || 'ÜNİAR memnuniyet endeksleri referans alınmıştır.')}`;
    case 'industry':
      return `Sanayi ve sektör bağlantıları 100 üzerinden <strong>${scorePercent}</strong> seviyesindedir. Üniversitenin iş dünyasıyla yürüttüğü ortak projeleri ve sektörel marka gücünü yansıtır.`;
    case 'research':
      return `Bilimsel araştırma gücü, yayın performansı ve AR-GE projeleri 100 üzerinden <strong>${scorePercent}</strong>'dur. URAP akademik başarı sıralamaları ve TÜBİTAK proje hacmi referans alınmıştır.`;
    case 'international':
      return `Değişim programı (Erasmus) zenginliği ve uluslararasılaşma skoru 100 üzerinden <strong>${scorePercent}</strong>'dur. ${item.language === 'İngilizce' ? 'Eğitim dilinin İngilizce olması uluslararası iş birliklerini ve öğrenci hareketliliğini doğrudan desteklemektedir.' : 'Yabancı dil hazırlık ve yurt dışı eğitim entegrasyonu değerlendirilmiştir.'}`;
    case 'cost':
      return `Yaşam maliyetinin bütçe dostu olma derecesi 100 üzerinden <strong>${scorePercent}</strong>'dur. ${item.city === 'İstanbul' ? 'İstanbul gibi bir metropolde yaşam maliyetleri ve genel giderler yüksektir.' : item.city === 'Ankara' || item.city === 'İzmir' ? 'Büyükşehir hayatının getirdiği yaşam maliyetleri orta-yüksek seviyededir.' : 'Bölgesel olarak yaşam maliyetleri ve genel giderler daha ekonomiktir.'}`;
    case 'housing':
      return `Yurt (KYK/Özel) kapasitesi ve barınma kolaylığı 100 üzerinden <strong>${scorePercent}</strong> olarak belirlenmiştir. ${item.city === 'İstanbul' ? 'İstanbul genelinde yurt doluluk oranları yüksek, kira endeksleri ise rekabetçidir.' : 'Bölgedeki KYK yurtlarının öğrenci sayısına oranı ve kiralık konut yoğunluğu elverişlidir.'}`;
    case 'career':
      return `Mezuniyet sonrası ilk iş bulma hızı ve kariyer basamaklarındaki mezun başarısı 100 üzerinden <strong>${scorePercent}</strong> seviyesindedir. Sektördeki ilk 6 ay istihdam verilerine dayanır.`;
    case 'ai_opportunity':
      return `Yapay zeka, veri bilimi ve yüksek teknoloji şirketlerine/fırsatlarına yakınlık skoru 100 üzerinden <strong>${scorePercent}</strong>'dur. ${item.city === 'İstanbul' || item.city === 'Ankara' ? 'Bölgedeki bilişim/AI odaklı ekosistem ve teknopark yoğunluğu adaya avantaj sağlamaktadır.' : 'Bölgesel teknoloji yatırımları ve teknokent imkanları referans alınmıştır.'}`;
    case 'internship':
      return `Öğrencilerin zorunlu ve isteğe bağlı staj yeri bulma kolaylığı 100 üzerinden <strong>${scorePercent}</strong>'dur. Çevredeki sanayi ve ofis yoğunluğu ile stajyer kabul istatistiklerine göredir.`;
    case 'scholarship':
      return `Burs ve finansal destek olanakları 100 üzerinden <strong>${scorePercent}</strong>'dur. ${item.tuition_status && item.tuition_status.includes('Burslu') ? 'Öğrencinin tam burslu statüde eğitim görecek olması finansal yükü sıfırlamaktadır.' : 'Programın devlet/vakıf statüsü ve sunulan ek burs imkanlarına dayanır.'}`;
    case 'startup':
      return `Girişimcilik ekosistemi, kuluçka merkezleri ve teknokent entegrasyonu 100 üzerinden <strong>${scorePercent}</strong>'dur. Yeni iş fikirleri üreten ve startup kurmak isteyen öğrenciler için altyapı gücünü temsil eder.`;
    default:
      return `Bu metrik için hesaplanan skor 100 üzerinden <strong>${scorePercent}</strong>'dur.`;
  }
}

// Modal Details Logic
function openDetailModal(id) {
  const overlay = document.getElementById('dept-detail-modal');
  const item = app.data.find(x => itemId(x.id) === itemId(id));
  if (!item) return;

  document.getElementById('modal-dept-title').textContent = item.full_name;
  document.getElementById('modal-dept-sub').textContent = `${item.location || item.city} (${item.city}) - ${item.degree}`;

  document.getElementById('modal-faculty').textContent = item.faculty;
  document.getElementById('modal-lang-tuition').textContent = `${item.language} | ${item.tuition_status}`;

  // Use pre-calculated Gemini LLM analysis if available, otherwise fallback to template
  const evalBadge = document.getElementById('modal-eval-badge');
  if (item.ai_eval) {
    document.getElementById('modal-general-eval').innerHTML = sanitizeRichHtml(item.ai_eval);
    if (evalBadge) evalBadge.classList.remove('hidden');
  } else {
    const unName = item.university.split(' (')[0];
    const prestige = getMetricScore(item, 'prestige');
    const academic = getMetricScore(item, 'academic');
    const isTopTier = prestige != null && academic != null && prestige >= 8 && academic >= 8;
    const isGood = (prestige != null && prestige >= 7) || (academic != null && academic >= 7);
    let tierText = NO_DATA_NOTE;
    if (isTopTier) {
      tierText = "akademik kadro kalitesi ve üniversite prestiji açısından Türkiye genelinde üst düzey (seçkin) bir konumdadır.";
    } else if (isGood) {
      tierText = "güçlü ve dengeli bir akademik/prestij altyapısına sahiptir.";
    } else if (prestige == null && academic == null) {
      tierText = "prestij ve akademik kalite için doğrulanmış resmî veri bulunmamaktadır.";
    }

    const predRank = item.prediction && typeof item.prediction.tahmini_skor === 'number'
      ? item.prediction.tahmini_skor.toLocaleString('tr-TR')
      : '-';

    const generalEvalHtml = `Bu program, <strong>${eh(item.city)}</strong> şehrinde, <strong>${eh(item.tuition_status)}</strong> statüsünde ve <strong>${eh(item.language)}</strong> eğitim diliyle verilmektedir. ${eh(unName)} bünyesindeki bu bölüm, ${eh(tierText)} Son yerleşme verilerine göre geçen yılki taban sıralaması <strong>${item.last_rank ? item.last_rank.toLocaleString('tr-TR') : '-'}</strong> iken, bu yılki kontenjan esnekliği ve trend analizi doğrultusunda tahmini yerleşme skorunun <strong>${predRank}</strong> civarında seyretmesi beklenmektedir.`;
    
    document.getElementById('modal-general-eval').innerHTML = generalEvalHtml;
    if (evalBadge) evalBadge.classList.add('hidden');
  }

  const METRIC_LABELS = {
    prestige: 'Diploma Gücü & Prestij',
    academic: 'Akademik Kalite & Kadro',
    transport: 'Ulaşım & KYK Yurdu',
    student_life: 'Sosyal Yaşam & Memnuniyet',
    industry: 'Sanayi Bağlantısı',
    research: 'Araştırma Gücü',
    international: 'Uluslararasılaşma',
    cost: 'Yaşam Maliyeti Uygunluğu',
    housing: 'Barınma / Yurt Olanakları',
    career: 'İlk İş Bulma Hızı',
    ai_opportunity: 'AI Sektörü Fırsatları',
    internship: 'Staj Olanakları',
    scholarship: 'Burs Olanakları',
    startup: 'Girişimcilik & Startup'
  };

  const SUB_LABELS = {
    employer_reputation: 'İşveren İtibarı (%30)',
    employment_rate: 'İstihdam Oranı (%20)',
    alumni_network: 'Mezun Ağı (%20)',
    academic_reputation: 'Akademik İtibar (%10)',
    industry_collaboration: 'Sanayi İş Birliği (%10)',
    research_power: 'Araştırma Gücü (%10)',
    
    mudek_fedek: 'MÜDEK/FEDEK Akreditasyonu',
    professor_count: 'Profesör Sayısı',
    student_faculty_ratio: 'Öğrenci/Hoca Oranı',
    sci_publications: 'SCI Yayın Performansı',
    tubitak_projects: 'TÜBİTAK Projeleri',
    erasmus_mobility: 'Erasmus Anlaşmaları',
    lab_facilities: 'Laboratuvar Altyapısı',
    teknopark_presence: 'Teknopark Varlığı',
    
    metro_access: 'Metro Erişimi (%20)',
    tram_access: 'Tramvay Erişimi (%15)',
    bus_frequency: 'Otobüs Sıklığı (%15)',
    kyk_dorm_capacity: 'KYK Yurt Kapasitesi (%15)',
    kyk_occupancy_rate: 'KYK Doluluk Durumu (%10)',
    inner_campus_transit: 'Kampüs Ulaşımı (%10)',
    city_transit_integration: 'Şehir İçi Ulaşım Entegrasyonu (%15)',
    
    uniar_satisfaction: 'ÜNİAR Memnuniyeti (%40)',
    student_clubs: 'Öğrenci Kulüpleri (%20)',
    erasmus_mobility_rate: 'Erasmus Değişimi (%15)',
    sports_facilities: 'Spor Tesisleri (%10)',
    campus_size: 'Kampüs Genişliği (%15)'
  };

  const gridContainer = document.getElementById('modal-detailed-scores-grid');
  if (gridContainer) {
    gridContainer.innerHTML = '';
    
    const scores = item.detailed_scores || {
      prestige: getMetricScore(item, 'prestige'),
      academic: getMetricScore(item, 'academic'),
      transport: getMetricScore(item, 'transport'),
      student_life: getMetricScore(item, 'uniar'),
      industry: getMetricScore(item, 'industry'),
      research: getMetricScore(item, 'research'),
      international: getMetricScore(item, 'international'),
      cost: getMetricScore(item, 'cost'),
      housing: getMetricScore(item, 'housing'),
      career: getMetricScore(item, 'career'),
      ai_opportunity: getMetricScore(item, 'ai_opportunity'),
      internship: getMetricScore(item, 'internship'),
      scholarship: getMetricScore(item, 'scholarship'),
      startup: getMetricScore(item, 'startup'),
    };
    
    const exp = item.explainable_details || {};
    const meta = item.metadata || {};

    Object.keys(METRIC_LABELS).forEach(key => {
      const label = METRIC_LABELS[key];
      const score = scores[key];
      if (score == null) return;
      const mMeta = meta[key] || { source: 'Resmî kaynak', version: '2025', confidence: 1.0 };
      
      let explainHtml = '';
      if (exp[key]) {
        const subItems = Object.entries(exp[key]).map(([subKey, subVal]) => {
          const subLabel = SUB_LABELS[subKey] || subKey;
          const reason = getQualitativeReason(subKey, subVal);
          return `<li><strong>${eh(subLabel)}:</strong> ${eh(reason)}</li>`;
        }).join('');
        
        explainHtml = `
          <details class="metric-explain-details" style="margin-top: 0.5rem; font-size: 0.75rem;">
            <summary style="cursor: pointer; color: var(--primary); outline: none; font-weight: 500;">Puan Detayları</summary>
            <ul class="explain-sub-list" style="margin: 0.25rem 0 0 0; padding-left: 1rem; list-style-type: disc; color: var(--muted-foreground); line-height: 1.4;">
              ${subItems}
            </ul>
          </details>
        `;
      }
      
      const card = document.createElement('div');
      card.className = 'modal-metric-card';
      card.style.cssText = 'background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; margin-bottom: 0.75rem; display: flex; flex-direction: column;';
      card.innerHTML = `
        <div class="modal-metric-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
          <span class="modal-metric-title" style="font-weight: 600; font-size: 0.8125rem;">${label}</span>
          <span class="modal-metric-score" style="font-family: var(--font-mono); font-weight: 700; font-size: 0.8125rem;">${Math.round(score * 10)} / 100</span>
        </div>
        <div class="modal-metric-bar-bg" style="background: var(--secondary); height: 6px; border-radius: var(--radius-full); overflow: hidden; width: 100%; margin-bottom: 0.4rem;">
          <div class="modal-metric-bar-fill" style="background: var(--primary); height: 100%; width: ${score * 10}%;"></div>
        </div>
        
        <p class="modal-metric-desc" style="font-size: 0.75rem; color: var(--foreground); line-height: 1.45; margin: 0 0 0.5rem 0;">
          ${getOverallMetricDescription(item, key, score)}
        </p>

        <div class="modal-metric-meta" style="display:flex; justify-content:space-between; font-size:0.7rem; color:var(--muted-foreground); margin-top:0.35rem; border-top: 1px solid var(--border); padding-top: 0.35rem;">
          <span>Güven: <strong>${(mMeta.confidence * 100).toFixed(0)}%</strong></span>
          <span title="Güncelleme: ${ea(mMeta.last_updated || '')}">Kaynak: ${eh(mMeta.source)} (${eh(mMeta.version)})</span>
        </div>
        ${explainHtml}
      `;
      gridContainer.appendChild(card);
    });
  }

  document.getElementById('modal-notes').textContent = item.notes || 'Belirtilmiş özel bir koşul veya ek not bulunmuyor.';

  // Fill 5-year Table
  const rankRow = document.getElementById('modal-rank-row');
  const quotaRow = document.getElementById('modal-quota-row');

  rankRow.innerHTML = '<td><strong>Sıralama</strong></td>' + item.history_rankings.map(r => `<td style="font-family: var(--font-mono); font-weight:700;">${r.toLocaleString('tr-TR')}</td>`).join('');
  quotaRow.innerHTML = '<td><strong>Kontenjan</strong></td>' + item.history_quotas.map(q => `<td style="font-family: var(--font-mono);">${q}</td>`).join('');

  overlay.classList.remove('hidden');
}

// ==========================================================================
// Add Program Modal — YÖK Atlas program_index üzerinden bölüm ekleme
// ==========================================================================

let programSearchCache = null;
let programIndexCache = null;
let departmentsIndexCache = null;
let selectedAddProgram = null;
let addProgramSearchTimer = null;
const MIN_SEARCH_CHARS = 2;
const MAX_SEARCH_RESULTS = 40;

const trLower = (s) => {
  if (!s) return '';
  return s
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ').replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş').replace(/Ö/g, 'ö').replace(/Ç/g, 'ç')
    .toLowerCase();
};

const loadProgramSearchIndex = async () => {
  if (programSearchCache) return programSearchCache;
  try {
    const response = await fetch('/data/program_search.json');
    if (response.ok) {
      programSearchCache = await response.json();
      return programSearchCache;
    }
  } catch (e) {
    console.warn('program_search.json yüklenemedi, program_index fallback');
  }
  const fallback = await loadProgramIndex();
  programSearchCache = fallback.map(p => ({
    id: p.program_id,
    t: p.full_title,
    u: p.university || '',
    d: p.department || '',
    g: p.department_group || '',
    c: p.city || '',
    s: p.score_type || '',
    b: p.scholarship_rate || '',
    h: trLower(`${p.full_title} ${p.university || ''} ${p.department_group || ''} ${p.city || ''}`),
  }));
  return programSearchCache;
};

const loadProgramIndex = async () => {
  if (programIndexCache) return programIndexCache;
  try {
    const response = await fetch('/data/program_index.json');
    if (!response.ok) throw new Error('program_index yüklenemedi');
    programIndexCache = await response.json();
    return programIndexCache;
  } catch (e) {
    console.error('Program index yükleme hatası:', e);
    return [];
  }
};

const expandSearchEntry = (entry) => ({
  program_id: entry.id,
  full_title: entry.t,
  university: entry.u,
  department: entry.d,
  department_group: entry.g,
  city: entry.c,
  score_type: entry.s,
  scholarship_rate: entry.b,
});

const scoreSearchMatch = (entry, queryTerms) => {
  const haystack = entry.h || trLower(`${entry.t} ${entry.u} ${entry.g} ${entry.d}`);
  const deptGroup = trLower(entry.g || '');
  const dept = trLower(entry.d || '');

  let score = 0;
  for (const term of queryTerms) {
    if (!haystack.includes(term)) return -1;
    if (deptGroup.includes(term) || dept.includes(term)) score += 10;
    else if (trLower(entry.u).includes(term)) score += 5;
    else score += 1;
  }
  return score;
};

const parseProgramTitle = (fullTitle) => {
  const parts = fullTitle.split(' - ');
  const department = parts.length > 1 ? parts.slice(1).join(' - ').trim() : fullTitle;
  let university = parts[0].trim();
  university = university.replace(/\s*\([^)]+\)\s*$/, '').trim();
  return { university, department };
};

const normalizeCity = (city) => {
  if (!city) return '';
  const lower = city.toLocaleLowerCase('tr-TR');
  return lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
};

const normalizeTitle = (title) => title.toUpperCase().replace(/\s+/g, ' ').trim();

const inferDegree = (fullTitle) => {
  const upper = fullTitle.toUpperCase();
  if (upper.includes('ÖNLİSANS') || upper.includes('MYO') || upper.includes('MESLEK YÜKSEKOKULU')) {
    return 'Önlisans (2Y)';
  }
  return 'Lisans (4Y)';
};

const inferLanguage = (fullTitle) => {
  const upper = fullTitle.toUpperCase();
  if (upper.includes('%100 İNGİLİZCE') || upper.includes('100% İNGİLİZCE')) {
    return '%100 İngilizce';
  }
  if (upper.includes('İNGİLİZCE')) return 'İngilizce';
  return 'Türkçe';
};

const inferTuition = (fullTitle) => {
  const upper = fullTitle.toUpperCase();
  if (upper.includes('%50')) return '%50 İndirimli';
  if (upper.includes('BURSLU') || upper.includes('%100 BURSLU')) return 'Burslu';
  if (upper.includes('ÜCRETLİ')) return 'Ücretli';
  return 'Devlet (Ücretsiz)';
};

const findMatchingUniversityProgram = (universityName) => {
  const normalized = universityName.toUpperCase().replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '');
  if (!normalized) return null;

  return app.data.find(item => {
    const itemNorm = item.university.toUpperCase().replace(/[^A-ZÇĞİÖŞÜ0-9]/g, '');
    return itemNorm.includes(normalized) || normalized.includes(itemNorm);
  }) || null;
};

const isProgramAlreadyAdded = (program) => {
  const normalized = normalizeTitle(program.full_title);
  return app.data.some(item => normalizeTitle(item.full_name) === normalized);
};

const buildNewProgramItem = (program, rank, predRank, notes, matchSource) => {
  const existing = getProgramById(program.program_id)
  if (existing) {
    return sanitizeItem({
      ...existing,
      last_rank: rank || existing.last_rank,
      prediction: predRank ? {
        tahmini_skor: predRank,
        model: 'manual_entry',
        confidence: 'low',
        prediction_generated_at: new Date().toISOString()
      } : existing.prediction,
      notes: sanitizePlainText(notes || existing.notes || '-'),
      isFavorite: true,
    })
  }

  const { university, department } = parseProgramTitle(program.full_title);
  const city = normalizeCity(program.city);
  const degree = inferDegree(program.full_title);
  const language = inferLanguage(program.full_title);
  const tuition = inferTuition(program.full_title);
  const fullName = `${university} - ${department}`;

  const base = {
    id: app.getNextId(),
    degree,
    score_type: 'SAY',
    university,
    department,
    full_name: fullName,
    faculty: 'Fakülte / Meslek Yüksekokulu',
    language,
    tuition_status: tuition,
    city,
    transport_desc: matchSource?.transport_desc || null,
    transport_score: matchSource?.transport_score ?? null,
    transport_data_available: matchSource?.transport_data_available ?? false,
    transport_data_note: matchSource?.transport_data_note || NO_DATA_NOTE,
    uniar_score: matchSource?.uniar_score ?? null,
    uniar_desc: matchSource?.uniar_desc || null,
    uniar_data_available: matchSource?.uniar_data_available ?? false,
    uniar_data_note: matchSource?.uniar_data_note || NO_DATA_NOTE,
    prestige_score: matchSource?.prestige_score ?? null,
    prestige_desc: matchSource?.prestige_desc || null,
    prestige_data_available: matchSource?.prestige_data_available ?? false,
    prestige_data_note: matchSource?.prestige_data_note || NO_DATA_NOTE,
    academic_score: matchSource?.academic_score ?? null,
    academic_desc: matchSource?.academic_desc || null,
    academic_data_available: matchSource?.academic_data_available ?? false,
    academic_data_note: matchSource?.academic_data_note || NO_DATA_NOTE,
    last_rank: rank || null,
    prediction: predRank ? {
      tahmini_skor: predRank,
      model: 'manual_entry',
      confidence: 'low',
      prediction_generated_at: new Date().toISOString()
    } : null,
    history_rankings: rank ? [rank] : [],
    history_quotas: [],
    notes: sanitizePlainText(notes || '-'),
    isFavorite: true,
    program_id: program.program_id
  };

  base.rating = app.calculateRating(base);
  return sanitizeItem(base);
};

const resetAddProgramModal = () => {
  selectedAddProgram = null;

  const searchInput = document.getElementById('search-add-program');
  const resultsContainer = document.getElementById('search-add-results');
  const detailsForm = document.getElementById('add-program-details-form');
  const matchingBadge = document.getElementById('matching-badge');

  if (searchInput) searchInput.value = '';
  if (resultsContainer) {
    resultsContainer.innerHTML = '<div class="search-empty-state">Aramaya başlamak için bölüm veya üniversite adı yazın.</div>';
  }
  if (detailsForm) {
    detailsForm.classList.add('hidden');
    document.getElementById('add-program-rank').value = '';
    document.getElementById('add-program-pred').value = '';
    document.getElementById('add-program-notes').value = '';
    document.getElementById('selected-program-title').textContent = '-';
  }
  if (matchingBadge) matchingBadge.style.display = 'none';
};

const renderAddProgramSearchResults = (programs, totalMatches = 0) => {
  const container = document.getElementById('search-add-results');
  if (!container) return;

  if (programs.length === 0) {
    container.innerHTML = '<div class="search-empty-state">Sonuç bulunamadı. Farklı bir bölüm veya üniversite adı deneyin.</div>';
    return;
  }

  const truncated = typeof totalMatches === 'string' || totalMatches > programs.length;
  const countHtml = truncated
    ? `<div class="search-match-count">${totalMatches} eşleşme — ilk ${programs.length} gösteriliyor</div>`
    : `<div class="search-match-count">${programs.length} program bulundu</div>`;

  container.innerHTML = countHtml + programs.slice(0, MAX_SEARCH_RESULTS).map(prog => `
    <button type="button" class="add-program-result-item${selectedAddProgram?.program_id === prog.program_id ? ' selected' : ''}" data-program-id="${ea(prog.program_id)}" role="option">
      <span class="add-program-result-title">${eh(prog.full_title)}</span>
      <span class="add-program-result-meta">
        <span>${eh(prog.department_group || prog.department || '')}</span>
        <span>${eh(prog.city)}</span>
        <span>${eh(prog.score_type || '')}</span>
        ${prog.scholarship_rate ? `<span>${eh(prog.scholarship_rate)}</span>` : ''}
      </span>
    </button>
  `).join('');

  container.querySelectorAll('.add-program-result-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const programId = btn.dataset.programId;
      const program = programs.find(p => p.program_id === programId);
      if (!program) return;

      selectedAddProgram = program;
      container.querySelectorAll('.add-program-result-item').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');

      const detailsForm = document.getElementById('add-program-details-form');
      const titleEl = document.getElementById('selected-program-title');
      const matchingBadge = document.getElementById('matching-badge');
      const matchSource = findMatchingUniversityProgram(parseProgramTitle(program.full_title).university);

      if (titleEl) titleEl.textContent = program.full_title;
      if (matchingBadge) {
        matchingBadge.style.display = matchSource ? 'block' : 'none';
      }
      if (detailsForm) detailsForm.classList.remove('hidden');
    });
  });
};

const searchAddPrograms = async () => {
  const rawQuery = document.getElementById('search-add-program')?.value.trim() || '';
  const query = trLower(rawQuery);
  const cityFilter = document.getElementById('add-program-city')?.value || '';
  const degreeFilter = document.getElementById('add-program-degree')?.value || 'all';
  const container = document.getElementById('search-add-results');

  if (query.length < MIN_SEARCH_CHARS) {
    if (container) {
      container.innerHTML = `<div class="search-empty-state">En az ${MIN_SEARCH_CHARS} harf yazın.</div>`;
    }
    return;
  }

  const queryTerms = query.split(/\s+/).filter(t => t.length >= 2);
  if (!queryTerms.length) {
    if (container) {
      container.innerHTML = '<div class="search-empty-state">Anlamlı bir arama terimi girin.</div>';
    }
    return;
  }

  const index = await loadProgramSearchIndex();
  const scored = [];

  for (const entry of index) {
    const prog = expandSearchEntry(entry);
    if (isProgramAlreadyAdded(prog)) continue;
    if (cityFilter && prog.city !== cityFilter) continue;
    if (degreeFilter === 'Lisans' && inferDegree(prog.full_title) !== 'Lisans (4Y)') continue;
    if (degreeFilter === 'Önlisans' && inferDegree(prog.full_title) !== 'Önlisans (2Y)') continue;

    const matchScore = scoreSearchMatch(entry, queryTerms);
    if (matchScore >= 0) {
      scored.push({ prog, matchScore });
      if (scored.length >= MAX_SEARCH_RESULTS * 4) break;
    }
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const results = scored.slice(0, MAX_SEARCH_RESULTS).map(s => s.prog);
  renderAddProgramSearchResults(results, scored.length >= MAX_SEARCH_RESULTS * 4 ? '160+' : scored.length);
};

const populateAddProgramCityDropdown = async () => {
  const citySelect = document.getElementById('add-program-city');
  if (!citySelect) return;

  const index = await loadProgramSearchIndex();
  const cities = [...new Set(index.map(p => p.c).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  citySelect.innerHTML = '<option value="">Tümü</option>';
  cities.forEach(city => {
    const opt = document.createElement('option');
    opt.value = city;
    opt.textContent = normalizeCity(city);
    citySelect.appendChild(opt);
  });
};

const openAddProgramModal = async () => {
  const modal = document.getElementById('add-program-modal');
  if (!modal) return;

  resetAddProgramModal();
  await Promise.all([loadProgramSearchIndex(), populateAddProgramCityDropdown()]);
  modal.classList.remove('hidden');
  document.getElementById('search-add-program')?.focus();
};

const closeAddProgramModal = () => {
  const modal = document.getElementById('add-program-modal');
  if (modal) modal.classList.add('hidden');
  resetAddProgramModal();
};

function setupAddProgramModal() {
  const openBtn = document.getElementById('btn-open-add-program-modal');
  const closeBtn = document.getElementById('add-program-close-btn');
  const modal = document.getElementById('add-program-modal');
  const searchInput = document.getElementById('search-add-program');
  const searchBtn = document.getElementById('btn-search-add-program');
  const citySelect = document.getElementById('add-program-city');
  const degreeSelect = document.getElementById('add-program-degree');
  const saveBtn = document.getElementById('btn-save-new-program');

  if (!openBtn || !modal) return;

  openBtn.addEventListener('click', openAddProgramModal);
  closeBtn?.addEventListener('click', closeAddProgramModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeAddProgramModal();
  });

  const runSearch = () => {
    clearTimeout(addProgramSearchTimer);
    searchAddPrograms();
  };

  const handleSearchInput = () => {
    clearTimeout(addProgramSearchTimer);
    addProgramSearchTimer = setTimeout(searchAddPrograms, 180);
  };

  searchInput?.addEventListener('input', handleSearchInput);
  searchBtn?.addEventListener('click', runSearch);
  searchInput?.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(addProgramSearchTimer);
      await searchAddPrograms();
      document.querySelector('.add-program-result-item')?.click();
    }
  });
  citySelect?.addEventListener('change', () => {
    if ((searchInput?.value.trim().length || 0) >= MIN_SEARCH_CHARS) {
      runSearch();
    }
  });
  degreeSelect?.addEventListener('change', () => {
    if ((searchInput?.value.trim().length || 0) >= MIN_SEARCH_CHARS) {
      runSearch();
    }
  });

  saveBtn?.addEventListener('click', () => {
    if (!selectedAddProgram) {
      alert('Lütfen önce bir program seçin.');
      return;
    }

    const rank = parseInt(document.getElementById('add-program-rank')?.value, 10) || null;
    const predRank = parseInt(document.getElementById('add-program-pred')?.value, 10) || null;
    const notes = document.getElementById('add-program-notes')?.value.trim() || '-';
    const { university } = parseProgramTitle(selectedAddProgram.full_title);
    const matchSource = findMatchingUniversityProgram(university);

    const newItem = buildNewProgramItem(selectedAddProgram, rank, predRank, notes, matchSource);
    app.addProgramItem(newItem);

    if (!app.favoriteOrder.includes(newItem.id)) {
      app.favoriteOrder.push(newItem.id);
      app.saveFavoriteOrder();
    }

    closeAddProgramModal();
    renderMasterTable();
    renderFavoritesList();
    populateDropdowns();
    renderCompareHub();
  });
}

function setupModalEvents() {
  const detailModal = document.getElementById('dept-detail-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', () => detailModal.classList.add('hidden'));

  const exportBtn = document.getElementById('btn-export-md');
  const exportModal = document.getElementById('export-modal');
  const exportCloseBtn = document.getElementById('export-close-btn');
  const copyBtn = document.getElementById('btn-copy-code');
  const exportCode = document.getElementById('export-code-box');

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportCode.textContent = generateMarkdownTable(app.getFilteredData());
      exportModal.classList.remove('hidden');
    });
  }

  if (exportCloseBtn) exportCloseBtn.addEventListener('click', () => exportModal.classList.add('hidden'));

  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(exportCode.textContent);
      copyBtn.innerHTML = `${SVG_CHECK} Panoya Kopyalandı!`;
      setTimeout(() => { copyBtn.innerHTML = `Panoya Kopyala`; }, 2000);
    });
  }
}

function setupDisclaimer() {
  const disclaimerModal = document.getElementById('disclaimer-modal');
  const acceptBtn = document.getElementById('btn-accept-disclaimer');
  
  if (!disclaimerModal) return;

  const accepted = localStorage.getItem('yks_disclaimer_accepted');
  if (!accepted) {
    disclaimerModal.classList.remove('hidden');
  }

  if (acceptBtn) {
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('yks_disclaimer_accepted', 'true');
      disclaimerModal.classList.add('hidden');
    });
  }
}

function generateMarkdownTable(items) {
  let md = '# YKS Master Tercih ve Analiz Veritabanı\n\n';
  md += '| ID | Tür | Üniversite & Bölüm Adı | Fakülte / MYO | Şehir | Dil | Burs | Ulaşım (1-10) | ÜNİAR (1-10) | Prestij (1-10) | Akademik Kadro (1-10) | Geçen Yıl Sıralama | Tahmini Skor | Kişisel Puan |\n';
  md += '| :---: | :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |\n';

  items.forEach(item => {
    const lastR = item.last_rank ? item.last_rank.toLocaleString('tr-TR') : '-';
    const predR = item.prediction && typeof item.prediction.tahmini_skor === 'number' ? item.prediction.tahmini_skor.toLocaleString('tr-TR') : '-';
    md += `| **${item.id}** | ${item.degree} | ${item.full_name} | ${item.faculty} | ${item.city} | ${item.language} | ${item.tuition_status} | ${item.transport_score} | ${item.uniar_score} | ${item.prestige_score} | ${item.academic_score} | ${lastR} | ${predR} | ${item.rating || '-'} |\n`;
  });

  return md;
}

// ==========================================================================
// Comparison Laboratory Feature Logic
// ==========================================================================

function setupCompareHub() {
  const modeBtns = document.querySelectorAll('[data-compare-mode]');
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.dataset.compareMode;
      app.activeCompareMode = mode;
      localStorage.setItem('yks_compare_mode', mode);

      // Hide all panes
      document.querySelectorAll('.compare-pane').forEach(p => p.classList.add('hidden'));
      // Show active pane
      const targetPane = document.getElementById(`compare-pane-${mode}`);
      if (targetPane) targetPane.classList.remove('hidden');

      renderCompareHub();
    });
  });

  // Program select 1 and 2 changes
  document.getElementById('compare-program-select-1')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value) || null;
    app.comparePrograms[0] = val;
    app.saveCompareState('yks_compare_programs', app.comparePrograms);
    renderCompareHub();
  });
  document.getElementById('compare-program-select-2')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value) || null;
    app.comparePrograms[1] = val;
    app.saveCompareState('yks_compare_programs', app.comparePrograms);
    renderCompareHub();
  });

  // University select 1 and 2 changes
  document.getElementById('compare-university-select-1')?.addEventListener('change', (e) => {
    const val = e.target.value || null;
    app.compareUnis[0] = val;
    app.saveCompareState('yks_compare_unis', app.compareUnis);
    renderCompareHub();
  });
  document.getElementById('compare-university-select-2')?.addEventListener('change', (e) => {
    const val = e.target.value || null;
    app.compareUnis[1] = val;
    app.saveCompareState('yks_compare_unis', app.compareUnis);
    renderCompareHub();
  });

  // Department select 1 and 2 changes
  document.getElementById('compare-department-select-1')?.addEventListener('change', (e) => {
    const val = e.target.value || null;
    app.compareDepts[0] = val;
    app.saveCompareState('yks_compare_depts', app.compareDepts);
    renderCompareHub();
  });
  document.getElementById('compare-department-select-2')?.addEventListener('change', (e) => {
    const val = e.target.value || null;
    app.compareDepts[1] = val;
    app.saveCompareState('yks_compare_depts', app.compareDepts);
    renderCompareHub();
  });

  // Load correct state
  const savedMode = app.activeCompareMode;
  const activeBtn = document.querySelector(`[data-compare-mode="${savedMode}"]`);
  if (activeBtn) {
    modeBtns.forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');
  }
  document.querySelectorAll('.compare-pane').forEach(p => p.classList.add('hidden'));
  const activePane = document.getElementById(`compare-pane-${savedMode}`);
  if (activePane) activePane.classList.remove('hidden');
}

function initCompareHubDropdowns() {
  const populateDualDropdown = (select1Id, select2Id, items, selectedValues, valKey = 'value', textKey = 'text') => {
    const select1 = document.getElementById(select1Id);
    const select2 = document.getElementById(select2Id);
    if (!select1 || !select2) return;

    const val1 = selectedValues[0];
    const val2 = selectedValues[1];

    let html1 = `<option value="">-- 1. Seçeneği Belirleyin --</option>`;
    let html2 = `<option value="">-- 2. Seçeneği Belirleyin --</option>`;

    items.forEach(item => {
      const val = item[valKey];
      const text = item[textKey];
      
      // Populate Option 1 (exclude if selected in Option 2)
      if (val !== val2) {
        html1 += `<option value="${ea(val)}" ${val === val1 ? 'selected' : ''}>${eh(text)}</option>`;
      }
      // Populate Option 2 (exclude if selected in Option 1)
      if (val !== val1) {
        html2 += `<option value="${ea(val)}" ${val === val2 ? 'selected' : ''}>${eh(text)}</option>`;
      }
    });

    select1.innerHTML = html1;
    select2.innerHTML = html2;
  };

  // Populate Program Dropdowns
  const sortedProgs = [...app.data].sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'));
  const progItems = sortedProgs.map(p => ({ value: p.id, text: p.full_name }));
  populateDualDropdown('compare-program-select-1', 'compare-program-select-2', progItems, app.comparePrograms);

  // Populate University Dropdowns
  const uniqueUnis = [...new Set(app.data.map(x => x.university))].sort((a, b) => a.localeCompare(b, 'tr'));
  const uniItems = uniqueUnis.map(u => ({ value: u, text: u }));
  populateDualDropdown('compare-university-select-1', 'compare-university-select-2', uniItems, app.compareUnis);

  // Populate Department Dropdowns
  const uniqueDepts = [...new Set(app.data.map(x => x.department))].sort((a, b) => a.localeCompare(b, 'tr'));
  const deptItems = uniqueDepts.map(d => ({ value: d, text: d }));
  populateDualDropdown('compare-department-select-1', 'compare-department-select-2', deptItems, app.compareDepts);
}

function renderCompareHub() {
  initCompareHubDropdowns();

  const mode = app.activeCompareMode;
  if (mode === 'program') {
    renderProgramComparison();
  } else if (mode === 'university') {
    renderUniversityComparison();
  } else if (mode === 'department') {
    renderDepartmentComparison();
  }
}

function renderProgramComparison() {
  const results = document.getElementById('compare-program-results');
  if (!results) return;

  const selectedIds = app.comparePrograms.filter(Boolean);

  if (selectedIds.length === 0) {
    results.innerHTML = `
      <div class="compare-empty-state">
        <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2 2V7a2 2 0 0 1 2-2h1"/><path d="M18 8h4a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-4"/><path d="M5 8h4"/><path d="M5 12h4"/></svg>
        <h3>Karşılaştırılacak Program Seçilmedi</h3>
        <p>Kıyaslama yapmak için yukarıdan iki farklı tercih programı seçin.</p>
      </div>
    `;
    return;
  }

  const selectedItems = app.comparePrograms.map(id => app.data.find(x => x.id === id)).filter(Boolean);

  let html = `<table class="compare-table">`;
  html += `<thead><tr><th class="label-col">Metrik / Program</th>`;
  selectedItems.forEach(item => {
    html += `
      <th class="value-col">
        <div style="font-weight:800; color:var(--foreground);">${eh(item.university)}</div>
        <div style="font-size:0.8125rem; font-weight:600; color:var(--muted-foreground); margin-top:0.25rem;">${eh(item.department)}</div>
        <div style="margin-top:0.75rem; display:flex; gap:0.375rem; flex-wrap:wrap;">
          <span class="badge badge-outline">${eh(item.degree)}</span>
          <span class="badge badge-secondary">${eh(item.language)}</span>
          <span class="badge badge-secondary">${eh(item.city)}</span>
        </div>
      </th>
    `;
  });
  html += `</tr></thead><tbody>`;

  const renderRow = (label, getValueHtml) => {
    let rHtml = `<tr><td class="label-col">${label}</td>`;
    selectedItems.forEach(item => {
      rHtml += `<td>${getValueHtml(item)}</td>`;
    });
    rHtml += `</tr>`;
    return rHtml;
  };

  html += renderRow('Kişisel Puanım', item => `
    <div class="compare-score-badge">${item.rating || '-'}</div>
    <div style="font-size:0.75rem; color:var(--muted-foreground);">Kişisel tercih değerlendirme puanınız.</div>
  `);

  html += renderRow('Ulaşım & KYK', item => `
    <div class="compare-score-wrapper">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="badge badge-dark">${item.transport_score} / 10</span>
      </div>
      <p class="compare-desc-text">${eh(item.transport_desc)}</p>
    </div>
  `);

  html += renderRow('ÜNİAR Memnuniyet', item => `
    <div class="compare-score-wrapper">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="badge badge-dark">${item.uniar_score} / 10</span>
      </div>
      <p class="compare-desc-text">${eh(item.uniar_desc)}</p>
    </div>
  `);

  html += renderRow('Prestij & Sektör', item => `
    <div class="compare-score-wrapper">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="badge badge-dark">${item.prestige_score} / 10</span>
      </div>
      <p class="compare-desc-text">${eh(item.prestige_desc)}</p>
    </div>
  `);

  html += renderRow('Akademik Kadro', item => `
    <div class="compare-score-wrapper">
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span class="badge badge-dark">${item.academic_score} / 10</span>
      </div>
      <p class="compare-desc-text">${eh(item.academic_desc)}</p>
    </div>
  `);

  html += renderRow('Sıralama / Tahmin', item => {
    const lastR = item.last_rank ? item.last_rank.toLocaleString('tr-TR') : '-';
    const predR = item.prediction && typeof item.prediction.tahmini_skor === 'number'
      ? item.prediction.tahmini_skor.toLocaleString('tr-TR')
      : '-';
    return `
      <div style="font-family:var(--font-mono); font-size:0.8125rem; display:flex; flex-direction:column; gap:0.25rem;">
        <div>Geçen Yıl: <strong>${lastR}</strong></div>
        <div>YKS 2026 Tahmin: <strong style="color:var(--primary);">${predR}</strong></div>
      </div>
    `;
  });

  html += renderRow('Notlarım & Detaylar', item => `
    <p style="font-size:0.75rem; white-space:pre-wrap; margin-bottom:0.75rem;">${eh(item.notes || 'Not eklenmemiş.')}</p>
    <button class="btn btn-outline btn-sm btn-inspect-compare" data-id="${item.id}">Detay Kartını Aç</button>
  `);

  html += `</tbody></table>`;
  results.innerHTML = html;

  results.querySelectorAll('.btn-inspect-compare').forEach(btn => {
    btn.addEventListener('click', () => {
      openDetailModal(itemId(btn.dataset.id));
    });
  });
}

function renderUniversityComparison() {
  const results = document.getElementById('compare-university-results');
  if (!results) return;

  const selectedUnis = app.compareUnis.filter(Boolean);

  if (selectedUnis.length === 0) {
    results.innerHTML = `
      <div class="compare-empty-state">
        <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10v6"/><path d="M6 12h12"/><path d="M12 4v16"/><rect x="6" y="8" width="12" height="8" rx="2"/></svg>
        <h3>Karşılaştırılacak Üniversite Seçilmedi</h3>
        <p>Kıyaslama yapmak için yukarıdan iki farklı üniversite seçin.</p>
      </div>
    `;
    return;
  }

  const selectedUnisData = app.compareUnis.map(uniName => {
    if (!uniName) return null;
    const matches = app.data.filter(x => x.university === uniName);
    if (matches.length === 0) return null;

    const count = matches.length;
    const avg = (arr) => {
      const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
      if (valid.length === 0) return '-';
      const sum = valid.reduce((acc, v) => acc + v, 0);
      return (sum / valid.length).toFixed(1);
    };

    return {
      name: uniName,
      count,
      avgRating: avg(matches.map(x => x.rating)),
      avgPrestige: avg(matches.map(x => x.prestige_score)),
      avgAcademic: avg(matches.map(x => x.academic_score)),
      avgTransport: avg(matches.map(x => x.transport_score)),
      avgUniar: avg(matches.map(x => x.uniar_score)),
      cities: [...new Set(matches.map(x => x.city))].join(', '),
      programs: matches
    };
  }).filter(Boolean);

  let html = `<table class="compare-table">`;
  html += `<thead><tr><th class="label-col">Metrik / Üniversite</th>`;
  selectedUnisData.forEach(uni => {
    html += `
      <th class="value-col">
        <div style="font-weight:800; color:var(--foreground);">${eh(uni.name)}</div>
        <div style="margin-top:0.75rem;">
          <span class="badge badge-outline">${eh(uni.cities)}</span>
          <span class="badge badge-secondary">${uni.count} Tercih Programı</span>
        </div>
      </th>
    `;
  });
  html += `</tr></thead><tbody>`;

  const renderRow = (label, getValueHtml) => {
    let rHtml = `<tr><td class="label-col">${label}</td>`;
    selectedUnisData.forEach(uni => {
      rHtml += `<td>${getValueHtml(uni)}</td>`;
    });
    rHtml += `</tr>`;
    return rHtml;
  };

  html += renderRow('Ortalama Kişisel Puan', uni => `
    <div class="compare-score-badge">${uni.avgRating}</div>
    <div style="font-size:0.75rem; color:var(--muted-foreground);">Ekli programlarınızın ortalama kişisel puanı.</div>
  `);

  html += renderRow('Ort. Ulaşım & KYK', uni => {
    const val = parseFloat(uni.avgTransport) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${uni.avgTransport} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Ort. ÜNİAR Memnuniyet', uni => {
    const val = parseFloat(uni.avgUniar) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${uni.avgUniar} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Ort. Üniversite Prestiji', uni => {
    const val = parseFloat(uni.avgPrestige) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${uni.avgPrestige} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Ort. Akademik Kadro', uni => {
    const val = parseFloat(uni.avgAcademic) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${uni.avgAcademic} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Veritabanındaki Programları', uni => {
    let listHtml = `<ul class="compare-programs-list">`;
    uni.programs.forEach(prog => {
      const pred = prog.prediction && typeof prog.prediction.tahmini_skor === 'number'
        ? prog.prediction.tahmini_skor.toLocaleString('tr-TR')
        : '-';
      listHtml += `
        <li class="compare-program-item">
          <div style="flex:1; margin-right:0.5rem;">
            <div style="font-weight:600; font-size:0.75rem;">${eh(prog.department)}</div>
            <div style="font-size:0.7rem; color:var(--muted-foreground);">Tahmin: ${pred} | Puan: ${prog.rating || '-'}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-inspect-compare" data-id="${prog.id}" style="padding: 0.2rem 0.4rem; height: auto;">Gözat</button>
        </li>
      `;
    });
    listHtml += `</ul>`;
    return listHtml;
  });

  html += `</tbody></table>`;
  results.innerHTML = html;

  results.querySelectorAll('.btn-inspect-compare').forEach(btn => {
    btn.addEventListener('click', () => {
      openDetailModal(itemId(btn.dataset.id));
    });
  });
}

function renderDepartmentComparison() {
  const results = document.getElementById('compare-department-results');
  if (!results) return;

  const selectedDepts = app.compareDepts.filter(Boolean);

  if (selectedDepts.length === 0) {
    results.innerHTML = `
      <div class="compare-empty-state">
        <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 22h20L12 2z"/><path d="M12 16v2"/><path d="M12 10v4"/></svg>
        <h3>Karşılaştırılacak Bölüm Seçilmedi</h3>
        <p>Kıyaslama yapmak için yukarıdan iki farklı bölüm seçin.</p>
      </div>
    `;
    return;
  }

  const selectedDeptsData = app.compareDepts.map(deptName => {
    if (!deptName) return null;
    const matches = app.data.filter(x => x.department === deptName);
    if (matches.length === 0) return null;

    const count = matches.length;
    const avg = (arr) => {
      const valid = arr.filter(v => typeof v === 'number' && !isNaN(v));
      if (valid.length === 0) return '-';
      const sum = valid.reduce((acc, v) => acc + v, 0);
      return (sum / valid.length).toFixed(1);
    };

    const ranks = matches.map(x => x.last_rank).filter(Boolean);
    const bestRank = ranks.length > 0 ? Math.min(...ranks) : null;
    const worstRank = ranks.length > 0 ? Math.max(...ranks) : null;

    return {
      name: deptName,
      count,
      avgRating: avg(matches.map(x => x.rating)),
      avgPrestige: avg(matches.map(x => x.prestige_score)),
      avgAcademic: avg(matches.map(x => x.academic_score)),
      avgTransport: avg(matches.map(x => x.transport_score)),
      avgUniar: avg(matches.map(x => x.uniar_score)),
      bestRank,
      worstRank,
      programs: matches
    };
  }).filter(Boolean);

  let html = `<table class="compare-table">`;
  html += `<thead><tr><th class="label-col">Metrik / Bölüm</th>`;
  selectedDeptsData.forEach(dept => {
    html += `
      <th class="value-col">
        <div style="font-weight:800; color:var(--foreground);">${eh(dept.name)}</div>
        <div style="margin-top:0.75rem;">
          <span class="badge badge-secondary">${dept.count} Farklı Üniversite</span>
        </div>
      </th>
    `;
  });
  html += `</tr></thead><tbody>`;

  const renderRow = (label, getValueHtml) => {
    let rHtml = `<tr><td class="label-col">${label}</td>`;
    selectedDeptsData.forEach(dept => {
      rHtml += `<td>${getValueHtml(dept)}</td>`;
    });
    rHtml += `</tr>`;
    return rHtml;
  };

  html += renderRow('Ortalama Kişisel Puan', dept => `
    <div class="compare-score-badge">${dept.avgRating}</div>
    <div style="font-size:0.75rem; color:var(--muted-foreground);">Kişisel tercih listenizdeki ortalama puanı.</div>
  `);

  html += renderRow('Sıralama Aralığı', dept => {
    const bestStr = dept.bestRank ? dept.bestRank.toLocaleString('tr-TR') : '-';
    const worstStr = dept.worstRank ? dept.worstRank.toLocaleString('tr-TR') : '-';
    return `
      <div style="font-family:var(--font-mono); font-size:0.8125rem; display:flex; flex-direction:column; gap:0.25rem;">
        <div>En Yüksek Başarı: <strong>${bestStr}</strong></div>
        <div>En Düşük Başarı: <strong>${worstStr}</strong></div>
      </div>
    `;
  });

  html += renderRow('Ort. Ulaşım & KYK', dept => {
    const val = parseFloat(dept.avgTransport) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${dept.avgTransport} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Ort. ÜNİAR Memnuniyet', dept => {
    const val = parseFloat(dept.avgUniar) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${dept.avgUniar} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Ort. Bölüm Prestiji', dept => {
    const val = parseFloat(dept.avgPrestige) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${dept.avgPrestige} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Ort. Akademik Kadro', dept => {
    const val = parseFloat(dept.avgAcademic) || 0;
    return `
      <div class="compare-score-wrapper">
        <strong>${dept.avgAcademic} / 10</strong>
        <div style="width:100%; height:4px; background:var(--secondary); border-radius:2px; overflow:hidden; margin-top:0.25rem;">
          <div style="height:100%; width:${val * 10}%; background:var(--primary);"></div>
        </div>
      </div>
    `;
  });

  html += renderRow('Sunan Üniversiteler', dept => {
    let listHtml = `<ul class="compare-programs-list">`;
    const sortedProgs = [...dept.programs].sort((a, b) => (a.last_rank || 999999) - (b.last_rank || 999999));
    sortedProgs.forEach(prog => {
      const lastR = prog.last_rank ? prog.last_rank.toLocaleString('tr-TR') : '-';
      listHtml += `
        <li class="compare-program-item">
          <div style="flex:1; margin-right:0.5rem;">
            <div style="font-weight:600; font-size:0.75rem;">${eh(prog.university.split(' (')[0])}</div>
            <div style="font-size:0.7rem; color:var(--muted-foreground);">Geçen Yıl: ${lastR} | Şehir: ${eh(prog.city)}</div>
          </div>
          <button class="btn btn-ghost btn-sm btn-inspect-compare" data-id="${prog.id}" style="padding: 0.2rem 0.4rem; height: auto;">Gözat</button>
        </li>
      `;
    });
    listHtml += `</ul>`;
    return listHtml;
  });

  html += `</tbody></table>`;
  results.innerHTML = html;

  results.querySelectorAll('.btn-inspect-compare').forEach(btn => {
    btn.addEventListener('click', () => {
      openDetailModal(itemId(btn.dataset.id));
    });
  });
}

// ==========================================================================
// Platform Usage Statistics Page
// ==========================================================================

let statsRefreshTimer = null

async function renderUsageStatsPage() {
  const grid = document.getElementById('stats-simple-grid')
  const footnote = document.getElementById('stats-footnote')

  if (grid) {
    grid.innerHTML = `
      <div class="stats-big-card"><span class="stats-big-label">Yükleniyor...</span><span class="stats-big-value">—</span></div>
      <div class="stats-big-card"><span class="stats-big-label">Yükleniyor...</span><span class="stats-big-value">—</span></div>
      <div class="stats-big-card"><span class="stats-big-label">Yükleniyor...</span><span class="stats-big-value">—</span></div>
      <div class="stats-big-card"><span class="stats-big-label">Yükleniyor...</span><span class="stats-big-value">—</span></div>
    `
  }

  const data = await fetchSimpleStats()

  const cards = [
    { label: 'Toplam Ziyaretçi', value: formatStatNumber(data.totalVisitors), highlight: false },
    { label: 'Şu An Aktif', value: data.liveUsers !== null ? formatStatNumber(data.liveUsers) : '—', highlight: true },
    { label: 'Oluşturulan Liste', value: formatStatNumber(data.listsCreated), highlight: false },
    { label: 'Sihirbaz Kullanımı', value: formatStatNumber(data.wizardUsed), highlight: false }
  ]

  if (grid) {
    grid.innerHTML = cards.map((card) => `
      <div class="stats-big-card${card.highlight ? ' live' : ''}">
        <span class="stats-big-label">${card.label}</span>
        <span class="stats-big-value">${card.value}</span>
      </div>
    `).join('')
  }

  if (footnote) {
    footnote.textContent = data.remoteAvailable
      ? 'Anonim kullanım sayıları — kişisel bilgi toplanmaz.'
      : 'İstatistikler yalnızca bu cihazda görüntülenir.'
  }

  if (statsRefreshTimer) clearInterval(statsRefreshTimer)
  statsRefreshTimer = setInterval(renderUsageStatsPage, 30000)
}

