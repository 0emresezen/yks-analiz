import { predictYKSRanking } from './engine.js'

const toInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};

export const getRankingsFromItem = (item) => {
  if (!item) return [];

  const fromHistory = (item.history_rankings || [])
    .map(toInt)
    .filter((n) => n != null);

  if (fromHistory.length >= 2) return fromHistory;

  const fromFields = [
    item.rank_y4,
    item.rank_y3,
    item.rank_y2,
    item.rank_y1,
    item.last_rank,
  ]
    .map(toInt)
    .filter((n) => n != null);

  if (fromFields.length >= 2) return fromFields;
  if (fromHistory.length) return fromHistory;
  if (toInt(item.last_rank)) return [toInt(item.last_rank)];
  return [];
};

export const resolveQuotaPair = (item) => {
  const quotas = (item?.history_quotas || [])
    .map(toInt)
    .filter((n) => n != null);

  if (quotas.length >= 2) {
    return {
      oldQuota: quotas[quotas.length - 2],
      newQuota: quotas[quotas.length - 1],
    };
  }

  if (quotas.length === 1) {
    return { oldQuota: quotas[0], newQuota: quotas[0] };
  }

  const newQuota = toInt(item?.quota_current) || toInt(item?.quota_y1) || 60;
  const oldQuota = toInt(item?.quota_prev) || newQuota;
  return { oldQuota, newQuota };
};

export const buildPredictionFromItem = (item) => {
  const rankings = getRankingsFromItem(item);
  if (rankings.length < 2) return null;

  const { oldQuota, newQuota } = resolveQuotaPair(item);
  const result = predictYKSRanking(rankings, oldQuota, newQuota);

  if (result.error || result.tahminiSira === '-') return null;

  return {
    tahmini_skor: result.tahminiSira,
    predicted_rank: result.tahminiSira,
    alt_sinir: result.altSinir,
    ust_sinir: result.ustSinir,
    egim: result.egim,
    k_carpan: result.kCarpan,
    trend_direction: result.trendDirection,
    is_plateau: result.isPlateau,
    prediction_model: 'linear_regression_elastic_quota',
    last_rank: rankings[rankings.length - 1],
    message: result.message,
  };
};

export const enrichItemWithPrediction = (item) => {
  if (!item) return item;

  const prediction = buildPredictionFromItem(item);
  if (prediction) {
    item.prediction = prediction;
  }

  return item;
};
