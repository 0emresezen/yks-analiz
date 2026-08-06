import {
  ensureCampusMetricsOnItem,
  applyAcademicHeuristic,
  loadCampusMetricsIndex,
} from './campusMetrics.js';
import {
  initDataModule,
  getProgramCard,
  loadProgramDetail,
  loadProgramIndex,
  loadFilterIndexes,
  fetchProgramsByIds as fetchProgramsByIdsLocal,
} from './data.js';
import {
  isSupabaseDataEnabled,
  fetchProgramsByIds as fetchProgramsByIdsSupabase,
  fetchFilterOptions,
  searchPrograms,
} from './analysisRepository.js';

const fetchProgramsByIds = (ids) => (
  isSupabaseDataEnabled() ? fetchProgramsByIdsSupabase(ids) : fetchProgramsByIdsLocal(ids)
);
import {
  escapeHtml as eh,
  escapeAttr as ea,
  sanitizePlainText,
  sanitizeRichHtml,
  sanitizeProgramStrings
} from './security.js';
import {
  initUsageStats,
  trackWizardUsed,
  trackListCreated,
  startPresence,
  fetchSimpleStats,
  formatStatNumber,
} from './usageStats.js';
import { setupAboutPage, renderAboutPage } from './aboutPage.js';
import { enrichItemWithPrediction } from './rankingPrediction.js';
import { MergeSortWizard } from './pairwiseMergeSort.js';
import { initModalScrollLock } from './scrollLock.js';
import { BRAND_NAME, BRAND_TAGLINE } from './brand.js';
import {
  EXPORT_FORMATS,
  EXPORT_SCOPES,
  generateExportContent,
  generateHtmlExport,
  generateExportPreviewHtml,
  generatePdfHelpHtml,
  downloadExportFile,
  printExportHtml,
  getExportFormat,
} from './exportFormats.js';
import { buildMetricCardSections } from './metricExplanations.js';

const NO_DATA_NOTE = 'Bu alan için doğrulanmış resmî veri bulunamadı.';

export const getMetricScore = (item, key) => {
  const scoreKey = key.endsWith('_score') ? key : `${key}_score`;
  const availKey = `${key.replace(/_score$/, '')}_data_available`;
  const available = item[availKey];
  const score = item[scoreKey] ?? item[key];
  if (available === false || score == null || score === '') return null;
  return score;
};

/** Kaynak etiketini UI için kısalt — LLM kaynakları kullanıcıya gösterilmez */
export const formatMetricSourceLabel = (source) => {
  if (!source) return source;
  const s = String(source).trim();
  if (/llm|yapay zek|gemini/i.test(s)) return null;
  return s;
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
const VIRTUAL_ROW_HEIGHT = 64;
const VIRTUAL_OVERSCAN = 6;
let MASTER_DATABASE = [];
let filteredDataCache = null;
let filteredDataCacheKey = '';
let virtualScrollRaf = null;
let lastVirtualRange = { start: -1, end: -1 };
let lastHydratedRange = { start: -1, end: -1 };

const itemId = (raw) => String(raw);

const bootstrapDatabase = async () => {
  MASTER_DATABASE = await initDataModule();
  return isSupabaseDataEnabled();
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
    this.useSupabase = false;
    this.data = [];
    this.totalCount = 0;
    this.isLoadingPrograms = false;
    this.filterRefreshTimer = null;
    this.favoriteCache = new Map();
    this.viewMode = 'scores'; // 'scores' (Puanlar 1-10) or 'descriptions' (Metinler)
    this.filterDegree = 'all'; // 'all', 'Lisans (4Y)', 'Önlisans (2Y)'
    this.searchQuery = '';
    this.cityFilter = '';
    this.langFilter = '';
    this.tuitionFilter = '';
    this.minRatingFilter = 0; // 0, 5, 6, 7, 8, 9
    this.sortOrder = 'rating-desc';
    this.virtualScrollTop = 0;

    // Favorites Order Array of IDs
    this.favoriteOrder = this.loadFavoriteOrder();

    // Pairwise Wizard State (merge sort + transitivity graph)
    this.wizardEngine = null;
    this.wizardCurrentIndex = 0;
    this.wizardReviewMode = false;
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
    this.comparePrograms = cleanCompare(this.loadCompareState('yks_compare_programs')).map((v) => (v != null ? itemId(v) : null));
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

  ensureListBootstrapped() {
    const hasExistingState =
      localStorage.getItem('yks_deleted_ids') ||
      localStorage.getItem('yks_master_v8_employability_data') ||
      localStorage.getItem('yks_cleared_list') ||
      localStorage.getItem('yks_custom_programs');
    if (hasExistingState || localStorage.getItem('yks_list_bootstrapped_v1')) return;

    if (!this.useSupabase && MASTER_DATABASE.length) {
      localStorage.setItem(
        'yks_deleted_ids',
        JSON.stringify(MASTER_DATABASE.map((x) => x.id))
      );
    }
    localStorage.setItem('yks_list_bootstrapped_v1', '1');
  }

  getPersistedListIds() {
    const ids = new Set();
    const deletedSet = new Set();

    try {
      const deleted = localStorage.getItem('yks_deleted_ids');
      if (deleted) JSON.parse(deleted).forEach((d) => deletedSet.add(itemId(d)));
    } catch (e) {}

    try {
      const saved = localStorage.getItem('yks_master_v8_employability_data');
      if (saved) {
        JSON.parse(saved).forEach((row) => {
          if (row?.id != null) ids.add(itemId(row.id));
        });
      }
    } catch (e) {}

    if (ids.size > 0) {
      return [...ids].filter((id) => !deletedSet.has(id));
    }

    if (!this.useSupabase) {
      return MASTER_DATABASE
        .filter((x) => !deletedSet.has(itemId(x.id)))
        .map((x) => itemId(x.id));
    }

    return [];
  }

  loadCustomPrograms() {
    try {
      const raw = localStorage.getItem('yks_custom_programs');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((row) => sanitizeItem(row)) : [];
    } catch (e) {
      return [];
    }
  }

  unmarkDeleted(id) {
    const key = itemId(id);
    try {
      const deletedIds = JSON.parse(localStorage.getItem('yks_deleted_ids') || '[]');
      const filtered = deletedIds.filter((d) => itemId(d) !== key);
      if (filtered.length !== deletedIds.length) {
        localStorage.setItem('yks_deleted_ids', JSON.stringify(filtered));
      }
    } catch (e) {}
  }

  loadState() {
    const enrichedMaster = MASTER_DATABASE.map((item) => applyMetricSnapshot(item));
    const fromMaster = this.applyUserStateToPrograms(enrichedMaster);
    const masterIds = new Set(fromMaster.map((x) => itemId(x.id)));
    const custom = this.loadCustomPrograms().filter((c) => !masterIds.has(itemId(c.id)));
    return [...fromMaster, ...custom];
  }

  async loadUserList() {
    const persistedIds = this.getPersistedListIds();
    const custom = this.loadCustomPrograms();
    const customIdSet = new Set(custom.map((c) => itemId(c.id)));
    const catalogIds = persistedIds.filter((id) => !customIdSet.has(itemId(id)));

    let catalogPrograms = [];
    if (catalogIds.length > 0) {
      catalogPrograms = this.applyUserStateToPrograms(await fetchProgramsByIds(catalogIds));
    }

    const catalogIdSet = new Set(catalogPrograms.map((x) => itemId(x.id)));
    const extraCustom = custom.filter((c) => !catalogIdSet.has(itemId(c.id)));
    this.data = [...catalogPrograms, ...extraCustom];
    this.totalCount = this.data.length;
    this.data.forEach((item) => {
      if (item.isFavorite) this.favoriteCache.set(item.id, item);
    });
    this.updateStats();
  }

  applyUserStateToPrograms(programs) {
    let deletedIds = [];
    try {
      const deleted = localStorage.getItem('yks_deleted_ids');
      if (deleted) deletedIds = JSON.parse(deleted);
    } catch (e) {}

    const deletedSet = new Set(deletedIds.map(itemId));
    let favoriteIds = new Set();
    try {
      const savedFavorites = localStorage.getItem('yks_favorite_ids');
      if (savedFavorites) favoriteIds = new Set(JSON.parse(savedFavorites).map(itemId));
    } catch (e) {}

    const saved = localStorage.getItem('yks_master_v8_employability_data');
    let savedMap = new Map();
    if (saved) {
      try {
        JSON.parse(saved).forEach((row) => savedMap.set(itemId(row.id), row));
      } catch (e) {}
    }

    return programs
      .filter((item) => !deletedSet.has(itemId(item.id)))
      .map((item) => {
        const id = itemId(item.id);
        const savedRow = savedMap.get(id);
        const isFavorite = savedRow?.isFavorite ?? favoriteIds.has(id) ?? false;
        const notes = savedRow?.notes ?? item.notes ?? '-';
        return {
          ...item,
          isFavorite,
          notes: typeof notes === 'string' ? notes : '-',
          rating: item.rating ?? (item.overall_rating != null ? item.overall_rating / 10 : null),
        };
      });
  }

  async refreshPrograms() {
    if (!this.useSupabase) return;
    this.isLoadingPrograms = true;
    try {
      const { programs, total } = await searchPrograms({
        search: this.searchQuery,
        city: this.cityFilter,
        degree: this.filterDegree,
        language: this.langFilter,
        tuition: this.tuitionFilter,
        minRating: this.minRatingFilter,
        sort: this.sortOrder,
        limit: PAGE_SIZE,
      });
      this.data = this.applyUserStateToPrograms(programs);
      this.totalCount = total;
      this.data.forEach((item) => {
        if (item.isFavorite) this.favoriteCache.set(item.id, item);
      });
    } finally {
      this.isLoadingPrograms = false;
      this.updateStats();
    }
  }

  scheduleDataRefresh() {
    resetTablePage();
    renderMasterTable();
  }

  saveState() {
    const masterIds = new Set(MASTER_DATABASE.map((x) => itemId(x.id)));
    const stateToSave = this.data.map((item) => ({
      id: item.id,
      rating: item.rating,
      notes: typeof item.notes === 'string' ? sanitizePlainText(item.notes) : item.notes,
      isFavorite: item.isFavorite,
    }));
    localStorage.setItem('yks_master_v8_employability_data', JSON.stringify(stateToSave));

    const customPrograms = this.data.filter((item) => {
      if (this.useSupabase) return /^\d+$/.test(itemId(item.id));
      return !masterIds.has(itemId(item.id));
    });
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
    return [];
  }

  saveFavoriteOrder() {
    localStorage.setItem('yks_fav_v5_order', JSON.stringify(this.favoriteOrder));
  }

  toggleFavorite(id) {
    const key = itemId(id);
    const item = this.data.find((x) => itemId(x.id) === key) || this.favoriteCache.get(key);
    if (!item) return;

    item.isFavorite = !item.isFavorite;
    if (item.isFavorite) {
      this.favoriteCache.set(key, item);
      if (!this.favoriteOrder.includes(id)) {
        this.favoriteOrder.push(id);
      }
    } else {
      this.favoriteOrder = this.favoriteOrder.filter((x) => x !== id);
    }

    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
  }

  clearAllFavorites() {
    this.data.forEach((item) => {
      item.isFavorite = false;
    });
    this.favoriteOrder = [];
    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
  }

  async deleteItem(id) {
    const key = itemId(id);
    const index = this.data.findIndex((x) => itemId(x.id) === key);
    if (index === -1) return null;
    const item = this.data[index];
    const wasFavorite = item.isFavorite || this.favoriteOrder.map(itemId).includes(key);
    const masterIds = new Set(MASTER_DATABASE.map((x) => itemId(x.id)));
    const isLocalCustom = /^\d+$/.test(key) && !masterIds.has(key);

    this.data.splice(index, 1);
    this.favoriteOrder = this.favoriteOrder.filter((x) => itemId(x) !== key);

    if (masterIds.has(key) || (this.useSupabase && !isLocalCustom)) {
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
    this.unmarkDeleted(item.id);
    this.saveState();
    this.saveFavoriteOrder();
    this.updateStats();
  }

  restoreAllItems() {
    localStorage.setItem('yks_cleared_list', 'true');
    localStorage.setItem('yks_custom_programs', '[]');
    localStorage.setItem('yks_master_v8_employability_data', '[]');
    if (!this.useSupabase && MASTER_DATABASE.length) {
      localStorage.setItem('yks_deleted_ids', JSON.stringify(MASTER_DATABASE.map((x) => x.id)));
    } else {
      localStorage.setItem('yks_deleted_ids', '[]');
    }
    this.data = [];
    this.favoriteOrder = [];
    this.saveFavoriteOrder();
    this.updateStats();
  }

  updateItem(id, key, value) {
    const item = this.data.find((x) => x.id === id);
    if (item) {
      item[key] = value;
      this.saveState();
    }
  }

  getNextId() {
    const numericIds = this.data
      .map((x) => Number(x.id))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!numericIds.length) return 1;
    return Math.max(...numericIds) + 1;
  }

  addProgramItem(item) {
    localStorage.removeItem('yks_cleared_list');
    this.unmarkDeleted(item.id);
    this.data.push(item);
    this.saveState();
    this.updateStats();
  }

  syncFavoritesList() {
    const favIds = this.data.filter((x) => x.isFavorite).map((x) => x.id);

    this.favoriteOrder = this.favoriteOrder.filter((id) => favIds.includes(id));
    favIds.forEach((id) => {
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

    const favCount = this.data.filter((x) => x.isFavorite).length;
    const totalDisplay = this.getFilteredData().length;

    if (totalEl) totalEl.textContent = totalDisplay;
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

  getWizardFavoriteHash() {
    return [...this.favoriteOrder].sort((a, b) => a - b).join(',');
  }

  saveWizardState() {
    if (!this.wizardEngine) return;
    try {
      localStorage.setItem('yks_wizard_state_v2', JSON.stringify({
        hash: this.getWizardFavoriteHash(),
        userAnswers: this.wizardEngine.userAnswers,
        currentIndex: this.wizardCurrentIndex,
        listFilter: this.wizardListFilter
      }));
    } catch (e) {}
  }

  restoreWizardState(candidates) {
    try {
      const raw = localStorage.getItem('yks_wizard_state_v2');
      if (!raw) return false;

      const state = JSON.parse(raw);
      if (state.hash !== this.getWizardFavoriteHash()) return false;
      if (!Array.isArray(state.userAnswers)) return false;

      const validAnswers = state.userAnswers.filter(
        (a) => (a.choice === 'A' || a.choice === 'B') && candidates.some((c) => c.id === a.idA) && candidates.some((c) => c.id === a.idB)
      );

      this.wizardEngine = MergeSortWizard.fromUserAnswers(candidates, validAnswers);
      this.wizardCurrentIndex = Number.isInteger(state.currentIndex)
        ? Math.max(state.currentIndex, 0)
        : 0;
      this.wizardListFilter = ['all', 'answered', 'pending'].includes(state.listFilter)
        ? state.listFilter
        : 'all';
      return true;
    } catch (e) {
      return false;
    }
  }

  clearWizardState() {
    try {
      localStorage.removeItem('yks_wizard_state_v2');
      localStorage.removeItem('yks_wizard_state_v1');
    } catch (e) {}
  }
}

const app = new MasterApp();

document.addEventListener('DOMContentLoaded', async () => {
  // Ziyaret sayacı veritabanı yüklemesini beklemez; her sayfa açılışı/F5 sayılır.
  initUsageStats();
  startPresence();

  // Buton/etkileşim dinleyicileri veri yüklemesini BEKLEMEDEN bağlanır;
  // aksi halde yavaş ağda saniyelerce "ölü buton" dönemi oluşuyor.
  setupNavTabs();
  setupFilterEvents();
  setupViewModeToggle();
  setupModalEvents();
  initModalScrollLock();
  setupAddProgramModal();
  setupDisclaimer();
  setupPairwiseWizard();
  setupCompareHub();

  const loader = document.getElementById('app-loading');
  try {
    if (loader) loader.classList.remove('hidden');
    await bootstrapDatabase();
    await loadCampusMetricsIndex(2026);
    app.useSupabase = isSupabaseDataEnabled();
    app.ensureListBootstrapped();
    await app.loadUserList();
    app.favoriteOrder = app.loadFavoriteOrder();
    const catalogTotal = app.useSupabase
      ? (await searchPrograms({ limit: 1 })).total
      : MASTER_DATABASE.length;
    const subtitle = document.querySelector('.subtitle');
    if (subtitle) {
      subtitle.textContent = `${catalogTotal.toLocaleString('tr-TR')} program · ${BRAND_TAGLINE}`;
    }
    document.title = `${BRAND_NAME} — ${BRAND_TAGLINE}`;
    app.updateStats();
  } catch (e) {
    console.error('Veritabanı yükleme hatası:', e);
    alert(app.useSupabase
      ? 'Uzak veritabanı yüklenemedi. Şema ve migration betiğini kontrol edin.'
      : 'Analiz veritabanı yüklenemedi. Lütfen build_analysis_database.py çalıştırın.');
  } finally {
    if (loader) loader.classList.add('hidden');
  }

  app.syncFavoritesList();
  await populateDropdowns();
  renderMasterTable();
  await renderFavoritesList();
});

// Navigation Tabs Logic
const activateNavTab = (targetId) => {
  const tabs = document.querySelectorAll('.nav-tab')
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === targetId)
  })
  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === targetId)
  })

  if (targetId === 'tab-favorites') {
    renderFavoritesList()
  } else if (targetId === 'tab-pairwise') {
    startPairwiseWizard()
  } else if (targetId === 'tab-compare-hub') {
    renderCompareHub()
  } else if (targetId === 'tab-stats') {
    renderUsageStatsPage()
  } else if (targetId === 'tab-about') {
    renderAboutPage()
  }
}

function setupNavTabs() {
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      activateNavTab(tab.dataset.tab)
    })
  })

  setupAboutPage({ activateTab: activateNavTab })
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

async function populateDropdowns() {
  const citySelect = document.getElementById('filter-city');
  if (citySelect) {
    let cities = [];
    if (app.useSupabase) {
      try {
        const opts = await fetchFilterOptions();
        cities = opts.cities || [];
      } catch (e) {
        console.warn('Şehir listesi yüklenemedi', e);
      }
    } else {
      try {
        const indexes = await loadFilterIndexes();
        cities = Object.keys(indexes.city || {}).sort();
      } catch (e) {
        cities = [...new Set(MASTER_DATABASE.map((x) => x.city).filter(Boolean))].sort();
      }
    }
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
  const refresh = () => app.scheduleDataRefresh();

  document.querySelectorAll('.filter-bar .seg-btn[data-filter-degree]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-bar .seg-btn[data-filter-degree]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      app.filterDegree = btn.dataset.filterDegree;
      refresh();
    });
  });

  const searchInput = document.getElementById('global-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      app.searchQuery = e.target.value;
      refresh();
    });
  }

  const citySelect = document.getElementById('filter-city');
  const langSelect = document.getElementById('filter-lang');
  const tuitionSelect = document.getElementById('filter-tuition');
  const minRatingSelect = document.getElementById('filter-min-rating');
  const sortSelect = document.getElementById('sort-order');

  if (citySelect) citySelect.addEventListener('change', (e) => { app.cityFilter = e.target.value; refresh(); });
  if (langSelect) langSelect.addEventListener('change', (e) => { app.langFilter = e.target.value; refresh(); });
  if (tuitionSelect) tuitionSelect.addEventListener('change', (e) => { app.tuitionFilter = e.target.value; refresh(); });
  if (minRatingSelect) minRatingSelect.addEventListener('change', (e) => { app.minRatingFilter = parseFloat(e.target.value) || 0; refresh(); });
  if (sortSelect) sortSelect.addEventListener('change', (e) => { app.sortOrder = e.target.value; refresh(); });

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
        app.scheduleDataRefresh();
      }
    });
  });
}

const getFilteredDataCacheKey = () => [
  app.filterDegree,
  app.searchQuery,
  app.cityFilter,
  app.langFilter,
  app.tuitionFilter,
  app.minRatingFilter,
  app.sortOrder,
  app.data.length,
].join('|');

const invalidateFilteredDataCache = () => {
  filteredDataCache = null;
  filteredDataCacheKey = '';
};

const getCachedFilteredData = () => {
  const key = getFilteredDataCacheKey();
  if (filteredDataCache && filteredDataCacheKey === key) return filteredDataCache;
  filteredDataCache = app.getFilteredData();
  filteredDataCacheKey = key;
  return filteredDataCache;
};

const resetVirtualRangeState = () => {
  lastVirtualRange = { start: -1, end: -1 };
  lastHydratedRange = { start: -1, end: -1 };
};

function resetTablePage() {
  app.virtualScrollTop = 0;
  resetVirtualRangeState();
  const container = document.getElementById('master-scroll-container');
  if (container) container.scrollTop = 0;
}

function attachVirtualScroll() {
  const container = document.getElementById('master-scroll-container');
  if (!container || container.dataset.virtualBound) return;
  container.dataset.virtualBound = '1';
  container.addEventListener('scroll', () => {
    app.virtualScrollTop = container.scrollTop;
    if (virtualScrollRaf != null) return;
    virtualScrollRaf = requestAnimationFrame(() => {
      virtualScrollRaf = null;
      renderVirtualTableBody();
    });
  }, { passive: true });
}

const buildRowHtml = (item) => {
  const lastRankStr = item.last_rank ? item.last_rank.toLocaleString('tr-TR') : '-';
  const predRankStr = item.prediction && typeof item.prediction.tahmini_skor === 'number'
    ? item.prediction.tahmini_skor.toLocaleString('tr-TR')
    : '-';
  const degreeClass = (item.degree || '').includes('Lisans') ? 'lisans' : 'onlisans';
  const renderMetricCell = (key) => {
    const score = getMetricScore(item, key);
    const desc = item[`${key}_desc`];
    const note = item[`${key}_data_note`];
    return formatMetricDisplay(score, desc, note, app.viewMode);
  };
  const starSvg = item.isFavorite ? SVG_STAR_FILLED : SVG_STAR_OUTLINE;
  const displayRating = typeof item.rating === 'number'
    ? Math.round(item.rating * 10)
    : (item.overall_rating ?? '-');

  return `
    <td style="text-align: center;">
      <button class="fav-star-btn ${item.isFavorite ? 'active' : ''}" data-id="${ea(item.id)}" title="Favorilere Ekle/Çıkar">${starSvg}</button>
    </td>
    <td>
      <div class="cell-stack">
        <span class="cell-title">#${eh(item.id)}</span>
        <span class="cell-tag ${degreeClass}">${eh(item.degree || '-')}</span>
      </div>
    </td>
    <td>
      <div class="cell-stack">
        <span class="cell-title">${eh(item.university)}</span>
        <span class="cell-sub">${eh(item.department)}</span>
        <span class="cell-sub" style="color: var(--muted-foreground);">${eh(item.faculty || '')}</span>
      </div>
    </td>
    <td>
      <div class="cell-stack">
        <span class="cell-title">${eh(item.city)}</span>
        <span class="cell-sub">${eh(item.language || '-')}</span>
        <span class="cell-sub">${eh(item.tuition_status || '-')}</span>
        ${inferInstructionType(item.full_name || item.department) !== 'Örgün'
          ? `<span class="cell-tag onlisans">${eh(inferInstructionType(item.full_name || item.department))}</span>`
          : ''}
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
      <span class="rating-badge font-mono">${displayRating}</span>
    </td>
    <td>
      <div style="display: flex; gap: 0.25rem;">
        <button class="btn-action detail-btn" data-id="${ea(item.id)}" title="Detaylı İncele">${SVG_INSPECT} İncele</button>
        <button class="btn-action delete-btn" data-id="${ea(item.id)}" style="background-color: var(--destructive-bg); color: var(--destructive-text); border-color: var(--destructive-border);" title="Listeden Sil">${SVG_DELETE} Sil</button>
      </div>
    </td>
  `;
};

function renderTableStatus(total, startIndex, endIndex) {
  const container = document.getElementById('table-pagination');
  if (!container) return;
  if (total === 0) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<span>${(startIndex + 1).toLocaleString('tr-TR')}–${endIndex.toLocaleString('tr-TR')} / ${total.toLocaleString('tr-TR')} program (sanal liste)</span>`;
}

const MASTER_TABLE_HEADER_NAMES = {
  'id': 'ID & Tür',
  'transport-desc': 'Ulaşım & KYK',
  'uniar-desc': 'ÜNİAR',
  'prestige-desc': 'Prestij',
  'academic-desc': 'Akademik Kadro',
  'tahmin-asc': 'Geçen Yıl / Tahmin',
  'rating-desc': 'Puanım'
};

function updateMasterTableHeaders() {
  document.querySelectorAll('#master-table th[data-sort]').forEach(th => {
    const key = th.dataset.sort;
    const baseName = MASTER_TABLE_HEADER_NAMES[key];
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
}

function renderEmptyMasterTable(tbody) {
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
}

function getVirtualSlice(items, scrollTop, viewport) {
  const visibleCount = Math.ceil(viewport / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2;
  const startIndex = Math.max(0, Math.floor(scrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN);
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  return { startIndex, endIndex };
}

function bindMasterTableRowEvents(tbody) {
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

function renderVirtualTableBody({ force = false } = {}) {
  const tbody = document.getElementById('master-tbody');
  const container = document.getElementById('master-scroll-container');
  if (!tbody || !container) return;

  const items = getCachedFilteredData();
  if (items.length === 0) return;

  const scrollTop = container.scrollTop ?? app.virtualScrollTop ?? 0;
  const viewport = container.clientHeight || 600;
  const { startIndex, endIndex } = getVirtualSlice(items, scrollTop, viewport);

  if (!force && startIndex === lastVirtualRange.start && endIndex === lastVirtualRange.end) {
    return;
  }
  lastVirtualRange = { start: startIndex, end: endIndex };

  const topPad = startIndex * VIRTUAL_ROW_HEIGHT;
  const bottomPad = Math.max(0, (items.length - endIndex) * VIRTUAL_ROW_HEIGHT);

  const rows = [];
  if (topPad > 0) rows.push(`<tr class="virtual-spacer" aria-hidden="true"><td colspan="11" style="height:${topPad}px;padding:0;border:0;"></td></tr>`);
  for (let i = startIndex; i < endIndex; i++) {
    rows.push(`<tr class="virtual-row" style="height:${VIRTUAL_ROW_HEIGHT}px">${buildRowHtml(items[i])}</tr>`);
  }
  if (bottomPad > 0) rows.push(`<tr class="virtual-spacer" aria-hidden="true"><td colspan="11" style="height:${bottomPad}px;padding:0;border:0;"></td></tr>`);

  tbody.innerHTML = rows.join('');
  renderTableStatus(items.length, startIndex, endIndex);
  bindMasterTableRowEvents(tbody);

  const rangeChanged = force
    || startIndex !== lastHydratedRange.start
    || endIndex !== lastHydratedRange.end;
  if (!rangeChanged) return;

  lastHydratedRange = { start: startIndex, end: endIndex };
  hydrateVisibleProgramMetrics(items, startIndex, endIndex).then((changed) => {
    if (!changed) return;
    invalidateFilteredDataCache();
    renderVirtualTableBody({ force: true });
  });
}

// Master Table Rendering — virtual scroll
function renderMasterTable() {
  const tbody = document.getElementById('master-tbody');
  if (!tbody) return;

  invalidateFilteredDataCache();
  resetVirtualRangeState();
  app.updateStats();
  updateMasterTableHeaders();

  const items = getCachedFilteredData();
  tbody.innerHTML = '';

  if (items.length === 0) {
    renderEmptyMasterTable(tbody);
    renderTableStatus(0, 0, 0);
    return;
  }

  renderVirtualTableBody({ force: true });
  attachVirtualScroll();
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
async function renderFavoritesList() {
  const container = document.getElementById('fav-list-container');
  if (!container) return;

  app.syncFavoritesList();

  if (app.useSupabase) {
    const missing = app.favoriteOrder.filter((id) => (
      !app.data.find((x) => x.id === id) && !app.favoriteCache.has(id)
    ));
    if (missing.length) {
      try {
        const fetched = await fetchProgramsByIds(missing);
        fetched.forEach((item) => {
          const [withState] = app.applyUserStateToPrograms([item]);
          if (withState) app.favoriteCache.set(withState.id, withState);
        });
      } catch (e) {
        console.warn('Favori programlar yüklenemedi', e);
      }
    }
  }

  const favItems = app.favoriteOrder
    .map(id => app.data.find(x => x.id === id) || app.favoriteCache.get(id))
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
              <span class="fav-metric-val"><strong>${item.transport_score ?? '—'}</strong>/10</span>
            </div>
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">ÜNİAR</span>
              <span class="fav-metric-val"><strong>${item.uniar_score ?? '—'}</strong>/10</span>
            </div>
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">Prestij</span>
              <span class="fav-metric-val"><strong>${item.prestige_score ?? '—'}</strong>/10</span>
            </div>
            <div class="fav-metric-item">
              <span class="fav-metric-lbl">Kadro</span>
              <span class="fav-metric-val"><strong>${item.academic_score ?? '—'}</strong>/10</span>
            </div>
            <div class="fav-metric-item fav-metric-pred">
              <span class="fav-metric-lbl">Tahmini Sıralama</span>
              <span class="fav-metric-val"><strong>${item.prediction?.tahmini_skor != null ? item.prediction.tahmini_skor.toLocaleString('tr-TR') : '—'}</strong></span>
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

function startPairwiseWizard(forceRestart = false) {
  const duelArea = document.getElementById('wizard-active-duel');
  const resultsArea = document.getElementById('wizard-final-results');
  const emptyState = document.getElementById('wizard-empty-state');

  app.syncFavoritesList();

  const candidates = app.favoriteOrder
    .map(id => app.data.find(x => x.id === id))
    .filter(Boolean);

  if (candidates.length < 2) {
    app.wizardEngine = null;
    if (duelArea) duelArea.classList.add('hidden');
    if (resultsArea) resultsArea.classList.add('hidden');
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  if (forceRestart) {
    app.clearWizardState();
  } else if (app.restoreWizardState(candidates)) {
    if (app.wizardEngine.isComplete()) {
      finishWizard();
      return;
    }
    document.getElementById('btn-wizard-show-results')?.classList.add('hidden');
    if (resultsArea) resultsArea.classList.add('hidden');
    if (duelArea) duelArea.classList.remove('hidden');
    renderDuelStep();
    return;
  }

  trackWizardUsed();
  app.wizardReviewMode = false;
  app.wizardEngine = new MergeSortWizard(candidates);
  app.wizardEngine.advance();
  app.wizardCurrentIndex = 0;

  document.getElementById('btn-wizard-show-results')?.classList.add('hidden');

  if (resultsArea) resultsArea.classList.add('hidden');
  if (duelArea) duelArea.classList.remove('hidden');
  app.saveWizardState();
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
  const engine = app.wizardEngine;
  if (!engine) return;

  if (!engine.currentQuestion && !engine.isComplete()) {
    engine.advance();
  }

  if (engine.isComplete()) {
    if (app.wizardReviewMode) {
      const stepText = document.getElementById('duel-step-text');
      if (stepText) {
        stepText.textContent = 'Sıralama tamamlandı. Yan panelden seçimleri düzenleyebilirsiniz.';
      }
      renderWizardQuestionsList();
      return;
    }
    finishWizard();
    return;
  }

  const q = engine.currentQuestion;
  if (!q) return;

  app.wizardCurrentIndex = q.comparisonIndex;
  const { itemA, itemB } = q;
  const cardA = document.getElementById('option-a-card');
  const cardB = document.getElementById('option-b-card');
  if (cardA) cardA.dataset.itemId = String(itemA.id);
  if (cardB) cardB.dataset.itemId = String(itemB.id);

  const stepText = document.getElementById('duel-step-text');
  const fillBar = document.getElementById('duel-progress-fill');

  const answeredCount = engine.userAnswers.length;
  const estimatedTotal = engine.getEstimatedMaxQuestions();
  const inferredCount = engine.comparisons.filter((c) => c.inferred).length;

  if (stepText) {
    stepText.textContent = inferredCount > 0
      ? `Karşılaştırma ${answeredCount + 1} (${answeredCount} cevap, ${inferredCount} otomatik, ~${estimatedTotal} tahmini)`
      : `Karşılaştırma ${answeredCount + 1} (${answeredCount} cevap, ~${estimatedTotal} tahmini)`;
  }
  if (fillBar) {
    const pct = estimatedTotal > 0 ? Math.min((answeredCount / estimatedTotal) * 100, 100) : 0;
    fillBar.style.width = `${pct}%`;
  }

  const undoBtn = document.getElementById('btn-wizard-undo');
  if (undoBtn) {
    undoBtn.disabled = engine.userAnswers.length === 0;
  }

  const showResultsBtn = document.getElementById('btn-wizard-show-results');
  if (showResultsBtn) {
    showResultsBtn.classList.toggle('hidden', !engine.isComplete());
  }

  if (cardA && cardB) {
    cardA.classList.remove('selected-card-highlight');
    cardB.classList.remove('selected-card-highlight');
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
  const engine = app.wizardEngine;
  if (!engine?.currentQuestion) return;

  engine.submitAnswer(choice);
  engine.advance();
  app.saveWizardState();

  if (engine.isComplete()) {
    finishWizard();
  } else {
    renderDuelStep();
  }
}

function handleWizardUndo() {
  const engine = app.wizardEngine;
  if (!engine?.undoLastUserAnswer()) return;

  app.wizardCurrentIndex = Math.max(engine.comparisons.length - 1, 0);
  app.saveWizardState();
  renderDuelStep();
}

function getWizardShortName(fullName) {
  return (fullName || '').split(' - ')[0];
}

function getWizardAnsweredCount() {
  return app.wizardEngine?.userAnswers?.length || 0;
}

const getProgramWinStats = (programId, engine) => {
  if (!engine?.comparisons?.length) {
    return { wins: 0, total: 0, winPct: null };
  }

  const id = String(programId);
  let wins = 0;
  let total = 0;

  engine.comparisons.forEach((comp) => {
    if (comp.choice !== 'A' && comp.choice !== 'B') return;

    const isA = String(comp.idA) === id;
    const isB = String(comp.idB) === id;
    if (!isA && !isB) return;

    total += 1;
    const won = (comp.choice === 'A' && isA) || (comp.choice === 'B' && isB);
    if (won) wins += 1;
  });

  return {
    wins,
    total,
    winPct: total > 0 ? Math.round((wins / total) * 100) : null,
  };
};

const formatProgramWinLabel = (stats) => {
  if (!stats?.total) return '—';
  return `%${stats.winPct} galibiyet`;
};

function updateWizardHistoryBadge() {
  const toggleBtn = document.getElementById('btn-toggle-wizard-side');
  if (!toggleBtn) return;

  const answered = getWizardAnsweredCount();
  const estimated = app.wizardEngine?.getEstimatedMaxQuestions() || 0;
  const badge = toggleBtn.querySelector('.wizard-history-badge');

  if (!estimated || answered === 0) {
    badge?.remove();
    return;
  }

  const label = badge || document.createElement('span');
  label.className = 'wizard-history-badge';
  label.textContent = `${answered}/${estimated}~`;
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
  const engine = app.wizardEngine;
  if (!engine) return [];

  return engine.comparisons
    .map((comp, idx) => ({ comp, idx }))
    .filter(({ comp }) => {
      if (app.wizardListFilter === 'answered') return comp.choice !== null;
      if (app.wizardListFilter === 'pending') return comp.choice === null;
      return true;
    });
}

function getComparisonItems(comp) {
  const itemA = app.data.find((x) => x.id === comp.idA);
  const itemB = app.data.find((x) => x.id === comp.idB);
  return itemA && itemB ? [itemA, itemB] : null;
}

function buildWizardQuestionItem(comp, idx, isActive, { readOnly = false } = {}) {
  const pair = getComparisonItems(comp);
  if (!pair) return null;

  const [itemA, itemB] = pair;
  const choice = comp.choice;
  const uNameA = getWizardShortName(itemA.full_name);
  const uNameB = getWizardShortName(itemB.full_name);
  const winnerName = choice === 'A' ? uNameA : choice === 'B' ? uNameB : null;
  const statusText = comp.inferred
    ? (winnerName ? `${winnerName} (otomatik)` : 'Otomatik')
    : (winnerName ? winnerName : 'Bekliyor');

  const itemDiv = document.createElement('div');
  itemDiv.className = `question-item${isActive ? ' active' : ''}${choice ? ' answered' : ''}${comp.inferred ? ' inferred' : ''}`;
  itemDiv.dataset.index = idx;

  itemDiv.innerHTML = `
    <div class="question-item-header">
      <span>Soru ${idx + 1}</span>
      <span class="question-item-status">${statusText}</span>
    </div>
    <div class="question-item-options">
      <button type="button" class="q-opt-btn ${choice === 'A' ? 'selected' : ''}" data-choice="A" title="${eh(itemA.full_name)}" ${readOnly || comp.inferred ? 'tabindex="-1"' : ''}>${eh(uNameA)}</button>
      <span class="question-item-vs">veya</span>
      <button type="button" class="q-opt-btn ${choice === 'B' ? 'selected' : ''}" data-choice="B" title="${eh(itemB.full_name)}" ${readOnly || comp.inferred ? 'tabindex="-1"' : ''}>${eh(uNameB)}</button>
    </div>
  `;

  return itemDiv;
}

function attachWizardQuestionItemHandlers(itemDiv, idx, comp, { readOnly = false, onAfterChange } = {}) {
  itemDiv.addEventListener('click', (e) => {
    const optBtn = e.target.closest('.q-opt-btn');
    if (optBtn && !readOnly && !comp.inferred) {
      e.stopPropagation();
      const engine = app.wizardEngine;
      if (!engine) return;

      app.wizardReviewMode = false;
      const newChoice = optBtn.dataset.choice;
      const userIdx = engine.getUserAnswerIndexForComparison(idx);
      if (userIdx >= 0) {
        engine.truncateFromUserAnswerIndex(userIdx);
        engine.advance();
      }
      if (engine.currentQuestion) {
        handleDuelChoice(newChoice);
      }
      if (typeof onAfterChange === 'function') onAfterChange();
      return;
    }

    if (comp.inferred) return;

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

  entries.forEach(({ comp, idx }) => {
    const isActive = idx === app.wizardCurrentIndex;
    const itemDiv = buildWizardQuestionItem(comp, idx, isActive);
    if (!itemDiv) return;
    attachWizardQuestionItemHandlers(itemDiv, idx, comp, { onAfterChange: renderDuelStep });
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

  const answeredEntries = app.wizardEngine?.comparisons
    .map((comp, idx) => ({ comp, idx }))
    .filter(({ comp }) => comp.choice !== null && !comp.inferred) || [];

  if (!answeredEntries.length) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  listContainer.innerHTML = '';

  answeredEntries.forEach(({ comp, idx }) => {
    const itemDiv = buildWizardQuestionItem(comp, idx, false, { readOnly: true });
    if (!itemDiv) return;
    attachWizardQuestionItemHandlers(itemDiv, idx, comp, { readOnly: true });
    listContainer.appendChild(itemDiv);
  });
}

function finishWizard() {
  app.wizardReviewMode = false;
  document.getElementById('wizard-active-duel').classList.add('hidden');
  const resultsArea = document.getElementById('wizard-final-results');
  const tbody = document.getElementById('wizard-final-tbody');
  const engine = app.wizardEngine;
  if (!engine) return;

  const sortedCandidates = engine.getResult() || [];
  const rankedIds = sortedCandidates.map((x) => x.id);

  tbody.innerHTML = '';

  sortedCandidates.forEach((item, index) => {
    const winStats = getProgramWinStats(item.id, engine);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="font-family: var(--font-mono); font-weight:700; text-align:center;">#${index + 1}</td>
      <td>
        <div style="font-weight:700; color:var(--foreground);">${item.full_name}</div>
        <div style="font-size:0.75rem; color:var(--muted-foreground);">${item.faculty} | ${item.tuition_status} | ${item.language}</div>
      </td>
      <td>${item.city}</td>
      <td>
        <span class="score-pill" title="${winStats.total ? `${winStats.wins}/${winStats.total} ikili karşılaştırma kazanıldı` : 'Bu program için karşılaştırma yok'}">
          ${formatProgramWinLabel(winStats)}
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
    app.wizardReviewMode = true;
    renderDuelStep();
  };

  document.getElementById('btn-restart-wizard').onclick = () => startPairwiseWizard(true);

  renderWizardResultsAnswersList();
  app.saveWizardState();
  resultsArea.classList.remove('hidden');
  trackListCreated();
}

// Modal Details Logic
async function openDetailModal(id) {
  const overlay = document.getElementById('dept-detail-modal');
  const card = app.data.find(x => itemId(x.id) === itemId(id));
  if (!card) return;

  let item = enrichItemWithPrediction(
    await loadProgramDetail(id).catch(() => card) || card
  );
  item = await ensureCampusMetricsOnItem(item);
  applyAcademicHeuristic(item);

  const listItem = app.data.find((x) => itemId(x.id) === itemId(id));
  if (listItem) {
    listItem.prediction = item.prediction;
    listItem.history_rankings = item.history_rankings ?? listItem.history_rankings;
    listItem.history_quotas = item.history_quotas ?? listItem.history_quotas;
    saveMetricSnapshot(listItem);
  }

  document.getElementById('modal-dept-title').textContent = item.full_name;
  document.getElementById('modal-dept-sub').textContent = `${item.location || item.city} (${item.city}) - ${item.degree}`;

  document.getElementById('modal-faculty').textContent = item.faculty || 'Fakülte / Yüksekokul bilgisi bulunamadı';
  const instructionLabel = inferInstructionType(item.full_name || item.department);
  const instructionSuffix = instructionLabel !== 'Örgün' ? ` | ${instructionLabel}` : '';
  document.getElementById('modal-lang-tuition').textContent = `${item.language} | ${item.tuition_status}${instructionSuffix}`;

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
    ai_opportunity: 'Yapay Zeka Fırsatları',
    internship: 'Staj Olanakları',
    scholarship: 'Burs Olanakları',
    startup: 'Girişimcilik'
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
      const hasScore = score != null;
      const metricKey = key === 'student_life' ? 'uniar' : key;
      const dataSource = item[`${metricKey}_data_source`] || meta[key]?.source || null;
      const dataNote = item[`${metricKey}_data_note`] || NO_DATA_NOTE;

      const sections = buildMetricCardSections({
        item,
        metricKey: key,
        label,
        score,
        dataNote,
        escapeHtml: eh,
      });

      const cardEl = document.createElement('div');
      cardEl.className = `modal-metric-card${hasScore ? '' : ' modal-metric-card-na'}`;
      cardEl.innerHTML = sections.html;
      gridContainer.appendChild(cardEl);
    });
  }

  // Son 4 yıl sıralama/kontenjan tablosu — 4 sütuna hizala, eksikleri '-' ile doldur
  const rankRow = document.getElementById('modal-rank-row');
  const quotaRow = document.getElementById('modal-quota-row');
  const padTo4 = (arr) => {
    const vals = Array.isArray(arr) ? arr.slice(-4) : [];
    while (vals.length < 4) vals.unshift(null);
    return vals;
  };

  if (rankRow) {
    rankRow.innerHTML = '<td><strong>Sıralama</strong></td>' + padTo4(item.history_rankings)
      .map(r => `<td style="font-family: var(--font-mono); font-weight:700;">${r != null ? r.toLocaleString('tr-TR') : '-'}</td>`).join('');
  }
  if (quotaRow) {
    quotaRow.innerHTML = '<td><strong>Kontenjan</strong></td>' + padTo4(item.history_quotas)
      .map(q => `<td style="font-family: var(--font-mono);">${q != null ? q : '-'}</td>`).join('');
  }

  const predValueEl = document.getElementById('modal-prediction-value');
  const predRangeEl = document.getElementById('modal-prediction-range');
  const predTrendEl = document.getElementById('modal-prediction-trend');
  const pred = item.prediction;

  if (predValueEl) {
    predValueEl.textContent = pred?.tahmini_skor != null
      ? pred.tahmini_skor.toLocaleString('tr-TR')
      : '—';
  }
  if (predRangeEl) {
    predRangeEl.textContent = pred?.alt_sinir != null && pred?.ust_sinir != null
      ? `Güven aralığı: ${pred.alt_sinir.toLocaleString('tr-TR')} – ${pred.ust_sinir.toLocaleString('tr-TR')}`
      : 'Güven aralığı hesaplanamadı (yeterli geçmiş veri yok)';
  }
  if (predTrendEl) {
    const trend = pred?.trend_direction || '—';
    const egim = pred?.egim != null ? ` (eğim: ${pred.egim.toLocaleString('tr-TR')})` : '';
    predTrendEl.textContent = `Eğilim: ${trend}${egim}`;
  }

  overlay.classList.remove('hidden');
}

// ==========================================================================
// Add Program Modal — YÖK Atlas program_index üzerinden bölüm ekleme
// ==========================================================================

let programSearchCache = null;
let programIndexCache = null;
let departmentsIndexCache = null;
const METRIC_SNAPSHOT_STORAGE_KEY = 'yks_metric_snapshots_v1';
const metricHydrationInFlight = new Set();

const extractMetricSnapshot = (item) => {
  const snap = {};
  for (const [key, val] of Object.entries(item)) {
    if (val == null || val === '') continue;
    if (
      key.endsWith('_score') ||
      key.endsWith('_desc') ||
      key.includes('_data_') ||
      key === 'prediction' ||
      key === 'history_rankings' ||
      key === 'history_quotas' ||
      key === 'rating' ||
      key === 'partial_rating' ||
      key === 'last_rank' ||
      key === 'program_id' ||
      key === 'campus_key' ||
      key === 'uniar_subcategories'
    ) {
      snap[key] = val;
    }
  }
  return snap;
};

const loadMetricSnapshots = () => {
  try {
    const raw = localStorage.getItem(METRIC_SNAPSHOT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveMetricSnapshot = (item) => {
  try {
    const map = loadMetricSnapshots();
    map[itemId(item.id)] = extractMetricSnapshot(item);
    localStorage.setItem(METRIC_SNAPSHOT_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Metrik snapshot kaydedilemedi:', e);
  }
};

const applyMetricSnapshot = (item) => {
  const snap = loadMetricSnapshots()[itemId(item.id)];
  if (!snap) return enrichItemWithPrediction(item);
  const merged = { ...item, ...snap, program_id: item.program_id || snap.program_id };
  return enrichItemWithPrediction(merged);
};

const hydrateProgramMetrics = async (item) => {
  if (!item?.program_id) return false;
  const programId = String(item.program_id);
  if (getMetricScore(item, 'prestige') != null) return false;
  if (metricHydrationInFlight.has(programId)) return false;

  metricHydrationInFlight.add(programId);
  try {
    await loadProgramIndex();
    const detail = await loadProgramDetail(programId);
    if (!detail) return false;

    Object.assign(item, detail);
    item.program_id = String(item.program_id || programId);
    enrichItemWithPrediction(item);
    item.rating = app.calculateRating(item) ?? item.rating;
    await ensureCampusMetricsOnItem(item);
    applyAcademicHeuristic(item);
    saveMetricSnapshot(item);
    return true;
  } catch (e) {
    console.warn('Metrik yükleme hatası:', programId, e);
    return false;
  } finally {
    metricHydrationInFlight.delete(programId);
  }
};

const hydrateVisibleProgramMetrics = async (items, startIndex, endIndex) => {
  const slice = items.slice(startIndex, endIndex);
  const results = await Promise.all(slice.map((item) => hydrateProgramMetrics(item)));
  return results.some(Boolean);
};
let selectedAddProgramIds = new Set();
let selectedAddProgramCache = new Map();
let addProgramSearchResults = [];
let addProgramSearchTimer = null;
const MIN_SEARCH_CHARS = 1;
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
  const fallback = await loadLegacyProgramIndex();
  programSearchCache = fallback.map(p => ({
    id: p.program_id,
    t: p.full_title,
    u: p.university || '',
    d: p.department || '',
    g: p.department_group || '',
    c: p.city || '',
    s: p.score_type || '',
    b: p.scholarship_rate || '',
    o: inferInstructionType(p.full_title),
    h: trLower(`${p.full_title} ${p.university || ''} ${p.department_group || ''} ${p.city || ''}`),
  }));
  return programSearchCache;
};

const loadLegacyProgramIndex = async () => {
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
  instruction_type: entry.o || inferInstructionType(entry.t),
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

const inferInstructionType = (title = '') => {
  const upper = String(title).toUpperCase();
  if (upper.includes('AÇIKÖĞRETİM') || upper.includes('AÇIK ÖĞRETİM')) return 'Açıköğretim';
  if (upper.includes('UZAKTAN')) return 'Uzaktan Öğretim';
  if (upper.includes('UOLP')) return 'UOLP';
  return 'Örgün';
};

const matchesInstructionFilter = (title, filter) => {
  if (!filter || filter === 'all') return true;
  const type = inferInstructionType(title);
  if (filter === 'orgun') return type === 'Örgün';
  if (filter === 'acik') return type === 'Açıköğretim';
  if (filter === 'uzaktan') return type === 'Uzaktan Öğretim';
  if (filter === 'dis') return type === 'Açıköğretim' || type === 'Uzaktan Öğretim';
  return true;
};

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

const mergeUniversityMetrics = (item, matchSource) => {
  if (!matchSource) return item;
  const out = { ...item };
  const metricKeys = ['transport', 'prestige', 'academic', 'uniar'];
  for (const key of metricKeys) {
    if (getMetricScore(out, key) != null) continue;
    if (getMetricScore(matchSource, key) == null) continue;
    out[`${key}_score`] = matchSource[`${key}_score`];
    out[`${key}_desc`] = matchSource[`${key}_desc`];
    out[`${key}_data_available`] = matchSource[`${key}_data_available`];
    out[`${key}_data_note`] = matchSource[`${key}_data_note`];
  }
  if (!out.transport_desc && matchSource.transport_desc) {
    out.transport_desc = matchSource.transport_desc;
  }
  return out;
};

const buildNewProgramItemFromDb = async (program) => {
  await loadProgramIndex();
  const programId = String(program.program_id);

  let detail = null;
  try {
    detail = await loadProgramDetail(programId);
  } catch (e) {
    console.warn('Program detayı yüklenemedi:', programId, e);
  }

  const card = detail || getProgramCard(programId);
  const title = program.full_title || card?.full_name || '';
  const { university } = parseProgramTitle(title);
  const matchSource = findMatchingUniversityProgram(university);

  if (card) {
    const merged = mergeUniversityMetrics({
      ...card,
      program_id: String(card.program_id || program.program_id),
      id: String(card.id || card.program_id || program.program_id),
      isFavorite: true,
      notes: '-',
    }, matchSource);
    merged.rating = app.calculateRating(merged) ?? merged.rating;
    await ensureCampusMetricsOnItem(merged);
    applyAcademicHeuristic(merged);
    saveMetricSnapshot(merged);
    return sanitizeItem(merged);
  }

  const { university: inferredUniversity, department } = parseProgramTitle(program.full_title);
  const city = normalizeCity(program.city);
  const degree = inferDegree(program.full_title);
  const language = inferLanguage(program.full_title);
  const tuition = inferTuition(program.full_title);
  const fullName = `${inferredUniversity} - ${department}`;

  const base = {
    id: app.getNextId(),
    degree,
    score_type: program.score_type || 'SAY',
    university: inferredUniversity,
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
    last_rank: null,
    prediction: null,
    history_rankings: [],
    history_quotas: [],
    notes: '-',
    isFavorite: true,
    program_id: program.program_id,
  };

  base.rating = app.calculateRating(base);
  await ensureCampusMetricsOnItem(base);
  applyAcademicHeuristic(base);
  saveMetricSnapshot(base);
  return sanitizeItem(base);
};

const updateAddProgramSelectionBar = () => {
  const bar = document.getElementById('add-program-selection-bar');
  const countEl = document.getElementById('add-program-selection-count');
  const saveBtn = document.getElementById('btn-save-new-program');
  const count = selectedAddProgramIds.size;

  if (bar) bar.classList.toggle('hidden', count === 0);
  if (countEl) {
    countEl.textContent = count === 1 ? '1 program seçildi' : `${count} program seçildi`;
  }
  if (saveBtn) saveBtn.disabled = count === 0;
};

const resetAddProgramModal = () => {
  selectedAddProgramIds = new Set();
  selectedAddProgramCache = new Map();
  addProgramSearchResults = [];

  const searchInput = document.getElementById('search-add-program');
  const resultsContainer = document.getElementById('search-add-results');
  const selectionBar = document.getElementById('add-program-selection-bar');

  if (searchInput) searchInput.value = '';
  if (resultsContainer) {
    resultsContainer.innerHTML = '<div class="search-empty-state">Aramaya başlamak için bölüm veya üniversite adı yazın.</div>';
  }
  if (selectionBar) selectionBar.classList.add('hidden');
  updateAddProgramSelectionBar();
};

const renderAddProgramSearchResults = (programs, totalMatches = 0) => {
  addProgramSearchResults = programs;
  const container = document.getElementById('search-add-results');
  if (!container) return;

  if (programs.length === 0) {
    container.innerHTML = '<div class="search-empty-state">Sonuç bulunamadı. Farklı bir bölüm veya üniversite adı deneyin.</div>';
    updateAddProgramSelectionBar();
    return;
  }

  const truncated = typeof totalMatches === 'string' || totalMatches > programs.length;
  const countHtml = truncated
    ? `<div class="search-match-count">${totalMatches} eşleşme — ilk ${programs.length} gösteriliyor</div>`
    : `<div class="search-match-count">${programs.length} program bulundu — çoklu seçim yapabilirsiniz</div>`;

  container.innerHTML = countHtml + programs.slice(0, MAX_SEARCH_RESULTS).map(prog => {
    const programId = String(prog.program_id);
    const alreadyAdded = isProgramAlreadyAdded(prog);
    const isSelected = selectedAddProgramIds.has(programId);
    const card = getProgramCard(programId);
    const rankLabel = card?.last_rank
      ? card.last_rank.toLocaleString('tr-TR')
      : null;

    const instructionLabel = prog.instruction_type || inferInstructionType(prog.full_title);

    return `
    <button
      type="button"
      class="add-program-result-item${isSelected ? ' selected' : ''}${alreadyAdded ? ' already-added' : ''}"
      data-program-id="${ea(programId)}"
      role="option"
      aria-selected="${isSelected}"
      ${alreadyAdded ? 'disabled' : ''}
    >
      <span class="add-program-check" aria-hidden="true"></span>
      <span class="add-program-result-body">
        <span class="add-program-result-title">${eh(prog.full_title)}</span>
        <span class="add-program-result-meta">
          <span>${eh(prog.department_group || prog.department || '')}</span>
          <span>${eh(prog.city)}</span>
          <span>${eh(prog.score_type || '')}</span>
          ${instructionLabel !== 'Örgün' ? `<span>${eh(instructionLabel)}</span>` : ''}
          ${prog.scholarship_rate ? `<span>${eh(prog.scholarship_rate)}</span>` : ''}
          ${rankLabel ? `<span>Sıra: ${eh(rankLabel)}</span>` : ''}
          ${alreadyAdded ? '<span>Listede</span>' : ''}
        </span>
      </span>
    </button>
  `;
  }).join('');

  container.querySelectorAll('.add-program-result-item:not(.already-added)').forEach(btn => {
    btn.addEventListener('click', () => {
      const programId = btn.dataset.programId;
      const check = btn.querySelector('.add-program-check');
      const prog = addProgramSearchResults.find((p) => String(p.program_id) === programId);

      if (selectedAddProgramIds.has(programId)) {
        selectedAddProgramIds.delete(programId);
        selectedAddProgramCache.delete(programId);
        btn.classList.remove('selected');
        btn.setAttribute('aria-selected', 'false');
        if (check) check.textContent = '';
      } else {
        selectedAddProgramIds.add(programId);
        if (prog) selectedAddProgramCache.set(programId, prog);
        btn.classList.add('selected');
        btn.setAttribute('aria-selected', 'true');
        if (check) check.textContent = '';
      }
      updateAddProgramSelectionBar();
    });
  });

  updateAddProgramSelectionBar();
};

const searchAddPrograms = async () => {
  const rawQuery = document.getElementById('search-add-program')?.value.trim() || '';
  const query = trLower(rawQuery);
  const cityFilter = document.getElementById('add-program-city')?.value || '';
  const degreeFilter = document.getElementById('add-program-degree')?.value || 'all';
  const instructionFilter = document.getElementById('add-program-instruction')?.value || 'all';
  const container = document.getElementById('search-add-results');
  const hasSideFilter = Boolean(cityFilter) || degreeFilter !== 'all' || instructionFilter !== 'all';

  if (!query.length && !hasSideFilter) {
    if (container) {
      container.innerHTML = '<div class="search-empty-state">Aramaya başlamak için bölüm veya üniversite adı yazın.</div>';
    }
    return;
  }

  const queryTerms = query.split(/\s+/).filter(Boolean);
  if (!queryTerms.length && !hasSideFilter) {
    if (container) {
      container.innerHTML = '<div class="search-empty-state">Aramaya başlamak için bölüm veya üniversite adı yazın.</div>';
    }
    return;
  }

  const index = await loadProgramSearchIndex();
  const scored = [];

  for (const entry of index) {
    const prog = expandSearchEntry(entry);
    if (cityFilter && prog.city !== cityFilter) continue;
    if (degreeFilter === 'Lisans' && inferDegree(prog.full_title) !== 'Lisans (4Y)') continue;
    if (degreeFilter === 'Önlisans' && inferDegree(prog.full_title) !== 'Önlisans (2Y)') continue;
    if (!matchesInstructionFilter(prog.full_title, instructionFilter)) continue;

    const matchScore = queryTerms.length ? scoreSearchMatch(entry, queryTerms) : 0;
    if (matchScore >= 0) {
      scored.push({ prog, matchScore });
    }
  }

  scored.sort((a, b) => b.matchScore - a.matchScore);
  const results = scored.slice(0, MAX_SEARCH_RESULTS).map(s => s.prog);
  renderAddProgramSearchResults(results, scored.length > MAX_SEARCH_RESULTS ? `${scored.length}+` : scored.length);
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

const openAddProgramModal = () => {
  const modal = document.getElementById('add-program-modal');
  if (!modal) return;

  resetAddProgramModal();
  // Modal beklemeden açılır; veri arka planda yüklenir ki buton "çalışmıyor" gibi görünmesin
  modal.classList.remove('hidden');
  document.getElementById('search-add-program')?.focus();

  Promise.all([loadProgramSearchIndex(), populateAddProgramCityDropdown(), bootstrapDatabase()])
    .then(() => {
      app.useSupabase = isSupabaseDataEnabled();
    })
    .catch((e) => {
      console.warn('Bölüm ekle verileri yüklenirken sorun oluştu:', e);
    });
};

const addSelectedProgramsToList = async () => {
  const programs = [...selectedAddProgramCache.values()];
  if (!programs.length) {
    alert('Lütfen en az bir program seçin.');
    return;
  }

  const wasEmpty = app.data.length === 0;
  const saveBtn = document.getElementById('btn-save-new-program');
  const defaultLabel = 'Seçilenleri Tercih Listeme Ekle';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Ekleniyor...';
  }

  try {
    for (const program of programs) {
      const newItem = await buildNewProgramItemFromDb(program);
      app.addProgramItem(newItem);
      if (!app.favoriteOrder.includes(newItem.id)) {
        app.favoriteOrder.push(newItem.id);
      }
    }
    app.saveFavoriteOrder();
    if (wasEmpty && app.data.length > 0) {
      trackListCreated();
    }
    closeAddProgramModal();
    renderMasterTable();
    renderFavoritesList();
    populateDropdowns();
    renderCompareHub();
  } catch (e) {
    console.error('Program ekleme hatası:', e);
    alert('Programlar eklenirken bir hata oluştu. Lütfen tekrar deneyin.');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = defaultLabel;
    }
  }
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
  const instructionSelect = document.getElementById('add-program-instruction');
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
      if (selectedAddProgramIds.size > 0) {
        await addSelectedProgramsToList();
      } else {
        document.querySelector('.add-program-result-item:not(.already-added)')?.click();
      }
    }
  });
  citySelect?.addEventListener('change', () => {
    if ((searchInput?.value.trim().length || 0) >= MIN_SEARCH_CHARS) {
      runSearch();
    }
  });
  degreeSelect?.addEventListener('change', () => {
    if ((searchInput?.value.trim().length || 0) >= MIN_SEARCH_CHARS || instructionSelect?.value !== 'all' || citySelect?.value) {
      runSearch();
    }
  });
  instructionSelect?.addEventListener('change', () => {
    runSearch();
  });

  saveBtn?.addEventListener('click', () => addSelectedProgramsToList());
}

function setupExportModal() {
  const exportBtn = document.getElementById('btn-export-md');
  const exportModal = document.getElementById('export-modal');
  const exportCloseBtn = document.getElementById('export-close-btn');
  const scopeContainer = document.getElementById('export-scope-options');
  const formatGrid = document.getElementById('export-format-grid');
  const previewHost = document.getElementById('export-preview-host');
  const downloadBtn = document.getElementById('btn-export-download');
  const formatLabel = document.getElementById('export-preview-format-label');
  const countLabel = document.getElementById('export-preview-count');
  const emptyHint = document.getElementById('export-empty-hint');

  if (!exportModal || !scopeContainer || !formatGrid || !previewHost) return;

  let activeFormat = EXPORT_FORMATS[0].id;
  let activeScope = EXPORT_SCOPES[0].id;
  let lastPreviewContent = '';

  const getExportItems = (scope) => {
    if (scope === 'favorites') {
      return app.favoriteOrder
        .map((id) => app.data.find((x) => x.id === id))
        .filter(Boolean);
    }
    if (scope === 'all') return [...app.data];
    return app.getFilteredData();
  };

  const renderPreview = () => {
    const items = getExportItems(activeScope);
    const fmt = getExportFormat(activeFormat);
    const isEmpty = items.length === 0;

    lastPreviewContent = isEmpty ? '' : generateExportContent(activeFormat, items, activeScope);

    if (isEmpty) {
      previewHost.innerHTML = '';
    } else if (activeFormat === 'pdf') {
      previewHost.innerHTML = generatePdfHelpHtml(items.length, activeScope);
    } else {
      previewHost.innerHTML = generateExportPreviewHtml(items, activeScope);
    }

    if (formatLabel) formatLabel.textContent = fmt.label;
    if (countLabel) countLabel.textContent = `${items.length} program`;
    if (emptyHint) emptyHint.classList.toggle('hidden', !isEmpty);
    if (downloadBtn) {
      downloadBtn.disabled = isEmpty;
      downloadBtn.textContent = fmt.downloadLabel || 'İndir';
    }
  };

  EXPORT_SCOPES.forEach((scope, index) => {
    const label = document.createElement('label');
    label.className = 'export-scope-option';
    label.innerHTML = `
      <input type="radio" name="export-scope" value="${ea(scope.id)}" ${index === 0 ? 'checked' : ''}>
      <span class="export-scope-text">
        <strong>${eh(scope.label)}</strong>
        <span>${eh(scope.hint)}</span>
      </span>
    `;
    label.querySelector('input')?.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      activeScope = scope.id;
      renderPreview();
    });
    scopeContainer.appendChild(label);
  });

  EXPORT_FORMATS.forEach((format, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `export-format-btn${index === 0 ? ' active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
    btn.dataset.format = format.id;
    btn.innerHTML = `
      <span class="export-format-icon">${eh(format.icon)}</span>
      <span class="export-format-text">
        <span class="export-format-name">${eh(format.label)}</span>
        <span class="export-format-hint">${eh(format.hint)}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      activeFormat = format.id;
      formatGrid.querySelectorAll('.export-format-btn').forEach((el) => {
        const isActive = el.dataset.format === format.id;
        el.classList.toggle('active', isActive);
        el.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      renderPreview();
    });
    formatGrid.appendChild(btn);
  });

  const openExportModal = () => {
    renderPreview();
    exportModal.classList.remove('hidden');
    formatGrid.querySelector('.export-format-btn')?.focus();
  };

  const closeExportModal = () => {
    exportModal.classList.add('hidden');
  };

  exportBtn?.addEventListener('click', openExportModal);
  exportCloseBtn?.addEventListener('click', closeExportModal);

  exportModal.addEventListener('click', (e) => {
    if (e.target === exportModal) closeExportModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !exportModal.classList.contains('hidden')) {
      closeExportModal();
    }
  });

  downloadBtn?.addEventListener('click', () => {
    const items = getExportItems(activeScope);
    if (!items.length) return;

    if (activeFormat === 'pdf') {
      const defaultLabel = downloadBtn.textContent;
      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Hazırlanıyor…';
      const html = generateHtmlExport(items, activeScope);
      printExportHtml(html)
        .then(() => {
          downloadBtn.textContent = defaultLabel;
          downloadBtn.disabled = false;
        })
        .catch((err) => {
          console.error(err);
          downloadBtn.textContent = defaultLabel;
          downloadBtn.disabled = false;
          alert(err.message || 'PDF oluşturulamadı.');
        });
      return;
    }

    if (!lastPreviewContent) return;
    downloadExportFile(lastPreviewContent, activeFormat, activeScope);
  });
}

function setupModalEvents() {
  const detailModal = document.getElementById('dept-detail-modal');
  const closeBtn = document.getElementById('modal-close-btn');

  if (closeBtn) closeBtn.addEventListener('click', () => detailModal.classList.add('hidden'));

  setupExportModal();
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

// ==========================================================================
// Comparison Laboratory Feature Logic
// ==========================================================================

let activeComparePicker = null

const COMPARE_MODE_CONFIG = {
  program: {
    stateKey: 'yks_compare_programs',
    getSelection: () => app.comparePrograms,
    placeholder: 'Program seçin',
    searchPlaceholder: 'Program ara...',
    emptyHint: 'Listenizdeki programlar arasından seçin.',
  },
  university: {
    stateKey: 'yks_compare_unis',
    getSelection: () => app.compareUnis,
    placeholder: 'Üniversite seçin',
    searchPlaceholder: 'Üniversite ara...',
    emptyHint: 'Listenizdeki üniversiteler arasından seçin.',
  },
  department: {
    stateKey: 'yks_compare_depts',
    getSelection: () => app.compareDepts,
    placeholder: 'Bölüm seçin',
    searchPlaceholder: 'Bölüm ara...',
    emptyHint: 'Listenizdeki bölümler arasından seçin.',
  },
}

const getCompareCatalog = (mode) => {
  if (mode === 'program') {
    return [...app.data]
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'tr'))
      .map((p) => ({
        value: itemId(p.id),
        label: p.full_name,
        meta: [p.city, p.degree, p.language].filter(Boolean).join(' · '),
      }))
  }

  if (mode === 'university') {
    return [...new Set(app.data.map((x) => x.university))]
      .sort((a, b) => a.localeCompare(b, 'tr'))
      .map((name) => ({
        value: name,
        label: name,
        meta: `${app.data.filter((x) => x.university === name).length} program`,
      }))
  }

  return [...new Set(app.data.map((x) => x.department))]
    .sort((a, b) => a.localeCompare(b, 'tr'))
    .map((name) => ({
      value: name,
      label: name,
      meta: `${app.data.filter((x) => x.department === name).length} program`,
    }))
}

const getCompareSelectedLabel = (mode, value) => {
  if (value == null || value === '') return null
  const match = getCompareCatalog(mode).find((item) => String(item.value) === String(value))
  return match?.label || String(value)
}

const normalizeCompareRank = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

const getProgramTabanSira = (item) => (
  normalizeCompareRank(item.last_rank) ?? normalizeCompareRank(item.prediction?.tahmini_skor)
)

const getCompareRankRange = (programs) => {
  const ranks = programs.map(getProgramTabanSira).filter((n) => n != null)
  const total = programs.length
  const withData = ranks.length
  if (!ranks.length) {
    return { best: null, worst: null, total, withData, unique: 0 }
  }
  return {
    best: Math.min(...ranks),
    worst: Math.max(...ranks),
    total,
    withData,
    unique: new Set(ranks).size,
  }
}

const formatCompareRank = (value) => (
  value != null ? value.toLocaleString('tr-TR') : '-'
)

const renderCompareRankRangeHtml = (range) => {
  const { best, worst, total, withData, unique } = range
  if (best == null) {
    return '<div class="compare-desc-text">Taban sıra verisi yok.</div>'
  }

  if (unique <= 1) {
    const hint = withData < total
      ? `${withData}/${total} programda sıra verisi var.`
      : total === 1
        ? 'Listedeki tek program.'
        : `${total} program — aynı taban sıra.`
    return `
      <div style="font-family:var(--font-mono); font-size:0.8125rem; display:flex; flex-direction:column; gap:0.25rem;">
        <div>Taban sıra: <strong>${formatCompareRank(best)}</strong></div>
        <div class="compare-desc-text">${hint}</div>
      </div>
    `
  }

  return `
    <div style="font-family:var(--font-mono); font-size:0.8125rem; display:flex; flex-direction:column; gap:0.25rem;">
      <div>En iyi taban sıra: <strong>${formatCompareRank(best)}</strong></div>
      <div>En zayıf taban sıra: <strong>${formatCompareRank(worst)}</strong></div>
      <div class="compare-desc-text">${withData}/${total} programda veri.</div>
    </div>
  `
}

const setCompareSelection = (mode, slot, value) => {
  const normalized = mode === 'program' ? (value != null ? itemId(value) : null) : (value || null)
  const config = COMPARE_MODE_CONFIG[mode]
  const selection = config.getSelection()
  selection[slot] = normalized
  app.saveCompareState(config.stateKey, selection)
}

const closeComparePicker = () => {
  if (!activeComparePicker) return
  const { picker } = activeComparePicker
  const panel = picker.querySelector('.compare-picker-panel')
  const trigger = picker.querySelector('.compare-picker-trigger')
  panel?.classList.add('hidden')
  trigger?.setAttribute('aria-expanded', 'false')
  activeComparePicker = null
}

const openComparePicker = (picker) => {
  if (activeComparePicker?.picker === picker) {
    closeComparePicker()
    return
  }

  closeComparePicker()
  activeComparePicker = { picker }

  const panel = picker.querySelector('.compare-picker-panel')
  const trigger = picker.querySelector('.compare-picker-trigger')
  const searchInput = picker.querySelector('.compare-picker-search')

  panel?.classList.remove('hidden')
  trigger?.setAttribute('aria-expanded', 'true')

  renderComparePickerResults(picker, '')

  requestAnimationFrame(() => {
    searchInput?.focus()
    searchInput?.select()
  })
}

const renderComparePickerResults = (picker, rawQuery = '') => {
  const mode = picker.dataset.mode
  const slot = Number(picker.dataset.slot)
  const resultsEl = picker.querySelector('.compare-picker-results')
  if (!resultsEl || !COMPARE_MODE_CONFIG[mode]) return

  const config = COMPARE_MODE_CONFIG[mode]
  const selection = config.getSelection()
  const excludeValue = selection[slot === 0 ? 1 : 0]
  const query = trLower(rawQuery.trim())
  const catalog = getCompareCatalog(mode).filter((item) => String(item.value) !== String(excludeValue ?? ''))

  const filtered = query
    ? catalog.filter((item) => trLower(`${item.label} ${item.meta || ''}`).includes(query))
    : catalog

  const currentValue = selection[slot]

  if (catalog.length === 0) {
    resultsEl.innerHTML = '<div class="search-empty-state">Listenizde karşılaştırılacak kayıt yok. Önce tercih listesine program ekleyin.</div>'
    return
  }

  if (filtered.length === 0) {
    resultsEl.innerHTML = '<div class="search-empty-state">Eşleşen sonuç bulunamadı.</div>'
    return
  }

  const clearRow = currentValue
    ? `<button type="button" class="compare-picker-clear" data-action="clear">Seçimi temizle</button>`
    : ''

  const countHtml = !query
    ? `<div class="search-match-count">${filtered.length} seçenek — listeden tıklayarak seçin</div>`
    : ''

  resultsEl.innerHTML = clearRow + countHtml + filtered.slice(0, 120).map((item) => {
    const isSelected = String(item.value) === String(currentValue)
    return `
      <button
        type="button"
        class="add-program-result-item compare-picker-option${isSelected ? ' selected' : ''}"
        data-value="${ea(item.value)}"
        role="option"
        aria-selected="${isSelected}"
      >
        <span class="add-program-check" aria-hidden="true"></span>
        <span class="add-program-result-body">
          <span class="add-program-result-title">${eh(item.label)}</span>
          ${item.meta ? `<span class="add-program-result-meta"><span>${eh(item.meta)}</span></span>` : ''}
        </span>
      </button>
    `
  }).join('')

  resultsEl.querySelector('.compare-picker-clear')?.addEventListener('click', () => {
    setCompareSelection(mode, slot, null)
    closeComparePicker()
    renderCompareHub()
  })

  resultsEl.querySelectorAll('.compare-picker-option').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      setCompareSelection(mode, slot, btn.dataset.value)
      closeComparePicker()
      renderCompareHub()
    })
  })
}

const syncComparePickerUI = () => {
  document.querySelectorAll('.compare-picker').forEach((picker) => {
    const mode = picker.dataset.mode
    const slot = Number(picker.dataset.slot)
    const config = COMPARE_MODE_CONFIG[mode]
    if (!config) return

    const selection = config.getSelection()
    const value = selection[slot]
    const label = getCompareSelectedLabel(mode, value) || config.placeholder
    const valueEl = picker.querySelector('.compare-picker-value')
    const trigger = picker.querySelector('.compare-picker-trigger')

    if (valueEl) {
      valueEl.textContent = label
      valueEl.classList.toggle('is-placeholder', !value)
    }
    trigger?.classList.toggle('has-value', Boolean(value))

    if (activeComparePicker?.picker === picker) {
      const searchInput = picker.querySelector('.compare-picker-search')
      renderComparePickerResults(picker, searchInput?.value || '')
    }
  })
}

function setupCompareHub() {
  const modeBtns = document.querySelectorAll('[data-compare-mode]')
  modeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      closeComparePicker()
      modeBtns.forEach((b) => b.classList.remove('active'))
      btn.classList.add('active')

      const mode = btn.dataset.compareMode
      app.activeCompareMode = mode
      localStorage.setItem('yks_compare_mode', mode)

      document.querySelectorAll('.compare-pane').forEach((p) => p.classList.add('hidden'))
      const targetPane = document.getElementById(`compare-pane-${mode}`)
      if (targetPane) targetPane.classList.remove('hidden')

      renderCompareHub()
    })
  })

  document.querySelectorAll('.compare-picker').forEach((picker) => {
    const trigger = picker.querySelector('.compare-picker-trigger')
    const searchInput = picker.querySelector('.compare-picker-search')
    const mode = picker.dataset.mode
    const config = COMPARE_MODE_CONFIG[mode]

    if (searchInput && config) {
      searchInput.placeholder = config.searchPlaceholder
    }

    trigger?.addEventListener('click', (e) => {
      e.stopPropagation()
      openComparePicker(picker)
    })

    trigger?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openComparePicker(picker)
      }
    })

    searchInput?.addEventListener('input', () => {
      renderComparePickerResults(picker, searchInput.value)
    })

    searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeComparePicker()
      }
    })

    picker.querySelector('.compare-picker-panel')?.addEventListener('click', (e) => {
      e.stopPropagation()
    })
  })

  document.addEventListener('click', (e) => {
    if (!activeComparePicker) return
    if (activeComparePicker.picker.contains(e.target)) return
    closeComparePicker()
  })

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeComparePicker()
  })

  const savedMode = app.activeCompareMode
  const activeBtn = document.querySelector(`[data-compare-mode="${savedMode}"]`)
  if (activeBtn) {
    modeBtns.forEach((b) => b.classList.remove('active'))
    activeBtn.classList.add('active')
  }
  document.querySelectorAll('.compare-pane').forEach((p) => p.classList.add('hidden'))
  const activePane = document.getElementById(`compare-pane-${savedMode}`)
  if (activePane) activePane.classList.remove('hidden')
}

function renderCompareHub() {
  syncComparePickerUI()

  const mode = app.activeCompareMode
  if (mode === 'program') {
    renderProgramComparison()
  } else if (mode === 'university') {
    renderUniversityComparison()
  } else if (mode === 'department') {
    renderDepartmentComparison()
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

  const selectedItems = app.comparePrograms
    .map((id) => app.data.find((x) => itemId(x.id) === itemId(id)))
    .filter(Boolean)

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
        <div>Tahmini Sıra: <strong style="color:var(--primary);">${predR}</strong></div>
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

  html += `</tbody></table>`;
  results.innerHTML = html;
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

    const rankRange = getCompareRankRange(matches)

    return {
      name: deptName,
      count,
      avgRating: avg(matches.map(x => x.rating)),
      avgPrestige: avg(matches.map(x => x.prestige_score)),
      avgAcademic: avg(matches.map(x => x.academic_score)),
      avgTransport: avg(matches.map(x => x.transport_score)),
      avgUniar: avg(matches.map(x => x.uniar_score)),
      rankRange,
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

  html += renderRow('Sıralama Aralığı', dept => renderCompareRankRangeHtml(dept.rankRange));

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
    if (data.statsMode === 'remote') {
      footnote.textContent = 'Tüm kullanıcılar için ortak anonim sayaçlar.'
    } else {
      footnote.textContent = 'Kullanım sayaçları şu an gösterilemiyor.'
    }
  }

  if (statsRefreshTimer) clearInterval(statsRefreshTimer)
  statsRefreshTimer = setInterval(renderUsageStatsPage, 30000)
}

