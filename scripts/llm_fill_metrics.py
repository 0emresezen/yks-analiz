#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Resmî verisi olmayan metrikleri LLM ile doldur — varlık bazlı batch mimarisi.

Mimari:
  - 21.493 program için LLM ÇAĞRILMAZ. Metrikler 3 varlık düzeyinde üretilir:
      * Üniversite (~228): akademik, araştırma, uluslararası, sanayi,
        girişimcilik, staj, AI fırsatları, kariyer
      * Kampüs = üniversite+şehir+ilçe (~853): ulaşım, barınma
      * Şehir (~84): yaşam maliyeti
  - Chunk'lı prompt (12 varlık / istek) → toplam ~100 istek.
  - Sağlayıcı zinciri: Gemini ücretsiz kota → OpenRouter (deepseek-v4-flash,
    en ucuz/zeki; reasoning düşük eforda → çıktı tokeni ucuz kalır).
  - Checkpoint/resume: her chunk sonrası çıktı dosyasına yazılır; script
    tekrar çalıştırılırsa mevcut kayıtlar atlanır.

Çıktılar (pipeline/llm_lookup.py bunları enrich sırasında uygular):
  validated/llm_metrics/universities.json
  validated/llm_metrics/campuses.json
  validated/llm_metrics/cities.json

Kullanım:
  .venv/bin/python scripts/llm_fill_metrics.py --dry-run
  .venv/bin/python scripts/llm_fill_metrics.py --only cities --limit 12
  .venv/bin/python scripts/llm_fill_metrics.py            # tam çalıştırma
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from pipeline.campus_key import normalize_token  # noqa: E402

OUT_DIR = os.path.join(ROOT, "validated", "llm_metrics")
PARQUET = os.path.join(ROOT, "processed", "yok", "2026.parquet")

GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"]
OPENROUTER_MODEL = "deepseek/deepseek-v4-flash"

CHUNK_SIZE = 12
MAX_RETRIES_PER_CHUNK = 6

UNI_METRICS = [
    "academic", "research", "international", "industry",
    "startup", "internship", "ai_opportunity", "career",
]
CAMPUS_METRICS = ["transport", "housing"]
CITY_METRICS = ["cost"]

SYSTEM_PROMPT = (
    "Sen Türkiye yükseköğretim sistemi, şehirleri ve kampüsleri hakkında derin bilgiye "
    "sahip bir analiz uzmanısın. Sana verilen varlıklar için 0-10 arası skorlar üretirsin "
    "(10 = mükemmel). Bilgin 2025-2026 dönemine dayanır. Emin olmadığında Türkiye "
    "ortalamasına yakın temkinli skor ver ve confidence değerini düşür. "
    "SADECE geçerli JSON döndür, başka hiçbir metin yazma."
)


def load_env() -> None:
    env_path = os.path.join(ROOT, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            os.environ.setdefault(key.strip(), val.strip().strip('"').strip("'"))


# ---------------------------------------------------------------------------
# Varlık çıkarımı
# ---------------------------------------------------------------------------

def extract_entities() -> Tuple[List[Dict], List[Dict], List[Dict]]:
    import pandas as pd

    df = pd.read_parquet(PARQUET)
    df = df.where(df.notna(), None)

    unis = (
        df.groupby("university")
        .agg(
            city=("city", lambda s: s.mode().iat[0] if len(s.mode()) else ""),
            university_type=("university_type", lambda s: s.mode().iat[0] if len(s.mode()) else ""),
            program_count=("program_id", "count"),
        )
        .reset_index()
        .to_dict(orient="records")
    )

    campuses = (
        df.groupby(["university", "city", "district"])
        .agg(program_count=("program_id", "count"))
        .reset_index()
        .to_dict(orient="records")
    )

    cities = (
        df.groupby("city")
        .agg(program_count=("program_id", "count"))
        .reset_index()
        .to_dict(orient="records")
    )

    return unis, campuses, cities


def uni_key(name: str) -> str:
    return normalize_token(name)


def campus_key_of(rec: Dict) -> str:
    return f"{normalize_token(rec['university'])}|{normalize_token(rec['city'])}|{normalize_token(rec['district'])}"


def city_key(name: str) -> str:
    return normalize_token(name)


# ---------------------------------------------------------------------------
# Prompt üretimi
# ---------------------------------------------------------------------------

def build_uni_prompt(chunk: List[Dict]) -> str:
    lines = [
        "Aşağıdaki Türk üniversiteleri için şu metrikleri 0-10 arası skorla:",
        "- academic: akademik kadro kalitesi (hoca/öğrenci oranı, kadro derinliği)",
        "- research: araştırma gücü (yayın, TÜBİTAK projeleri, URAP konumu)",
        "- international: uluslararasılaşma (Erasmus, yabancı öğrenci, İngilizce program)",
        "- industry: sanayi bağlantısı (staj/proje ortaklıkları, sektör yakınlığı)",
        "- startup: girişimcilik ekosistemi (teknokent, kuluçka merkezi)",
        "- internship: staj olanakları (çevre sanayi/ofis yoğunluğu)",
        "- ai_opportunity: AI/teknoloji sektörü fırsatları (şehir ve üniversite ekosistemi)",
        "- career: mezunların iş bulma hızı ve işveren itibarı",
        "",
        "Üniversiteler:",
    ]
    for i, u in enumerate(chunk):
        lines.append(
            f'{i + 1}. id="{uni_key(u["university"])}" | {u["university"]} | '
            f'tür: {u.get("university_type") or "?"} | ana şehir: {u.get("city") or "?"}'
        )
    lines += [
        "",
        'JSON formatı: {"results": [{"id": "...", "academic": 7.5, "research": 6.0, '
        '"international": 5.5, "industry": 6.5, "startup": 5.0, "internship": 6.0, '
        '"ai_opportunity": 5.5, "career": 6.5, "note": "<en fazla 15 kelime genel özet>", '
        '"confidence": 0.8}]}',
        "Her üniversite için bir obje döndür. Skorlar 0.5 hassasiyetinde olsun.",
    ]
    return "\n".join(lines)


def build_campus_prompt(chunk: List[Dict]) -> str:
    lines = [
        "Aşağıdaki üniversite kampüsleri (şehir + ilçe konumu) için şu metrikleri 0-10 arası skorla:",
        "- transport: kampüse toplu taşıma erişimi (metro/tramvay/otobüs, şehir merkezine mesafe, KYK yurtlarından erişim)",
        "- housing: barınma olanakları (KYK ve özel yurt kapasitesi, kampüs çevresi kira erişilebilirliği)",
        "",
        "Kampüsler:",
    ]
    for i, c in enumerate(chunk):
        lines.append(
            f'{i + 1}. id="{campus_key_of(c)}" | {c["university"]} | '
            f'şehir: {c["city"]} | ilçe: {c["district"] or "Merkez"}'
        )
    lines += [
        "",
        'JSON formatı: {"results": [{"id": "...", "transport": 7.0, '
        '"transport_desc": "<en fazla 18 kelime, somut: metro hattı/otobüs/mesafe>", '
        '"housing": 6.5, "housing_desc": "<en fazla 15 kelime>", "confidence": 0.7}]}',
        "İlçenin şehir merkezine uzaklığını ve bilinen kampüs konumlarını dikkate al.",
    ]
    return "\n".join(lines)


def build_city_prompt(chunk: List[Dict]) -> str:
    lines = [
        "Aşağıdaki şehirler için öğrenci gözünden yaşam maliyeti uygunluğunu 0-10 arası skorla",
        "(10 = çok uygun/ucuz, 0 = çok pahalı). Kira, ulaşım, yeme-içme dikkate al.",
        "",
        "Şehirler:",
    ]
    for i, c in enumerate(chunk):
        lines.append(f'{i + 1}. id="{city_key(c["city"])}" | {c["city"]}')
    lines += [
        "",
        'JSON formatı: {"results": [{"id": "...", "cost": 6.5, '
        '"cost_desc": "<en fazla 15 kelime>", "confidence": 0.85}]}',
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Sağlayıcılar
# ---------------------------------------------------------------------------

class ProviderExhausted(Exception):
    pass


class GeminiProvider:
    name = "gemini"

    # Ücretsiz kota ~10 istek/dk → kendimizi ~8 istek/dk'ya kısıtla
    MIN_INTERVAL_S = 7.5

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model_idx = 0
        self.consecutive_quota_errors = 0
        self._last_call_ts = 0.0

    @property
    def model(self) -> str:
        return GEMINI_MODELS[self.model_idx]

    def call(self, prompt: str) -> str:
        wait = self.MIN_INTERVAL_S - (time.time() - self._last_call_ts)
        if wait > 0:
            time.sleep(wait)
        self._last_call_ts = time.time()
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent"
        )
        body = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
                "maxOutputTokens": 8192,
            },
        }
        resp = requests.post(
            url,
            params={"key": self.api_key},
            json=body,
            timeout=180,
        )
        if resp.status_code == 429:
            self.consecutive_quota_errors += 1
            # RPM limiti geçicidir; günlük kota dolduysa uzun beklemeler de 429 verir.
            if self.consecutive_quota_errors >= 5:
                if self.model_idx + 1 < len(GEMINI_MODELS):
                    self.model_idx += 1
                    self.consecutive_quota_errors = 0
                    print(f"  [gemini] kota doldu → {self.model} modeline geçiliyor")
                    raise RuntimeError("rate limited, model switched")
                raise ProviderExhausted("Gemini ücretsiz kota tükendi")
            time.sleep(30 * self.consecutive_quota_errors)
            raise RuntimeError("rate limited")
        if resp.status_code in (401, 403):
            raise ProviderExhausted(f"Gemini auth hatası: {resp.status_code}")
        resp.raise_for_status()
        self.consecutive_quota_errors = 0
        data = resp.json()
        try:
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError):
            raise RuntimeError(f"Gemini beklenmedik yanıt: {str(data)[:200]}")


class OpenRouterProvider:
    name = "openrouter"

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.supports_reasoning_param = True

    def call(self, prompt: str) -> str:
        body: Dict[str, Any] = {
            "model": OPENROUTER_MODEL,
            "temperature": 0,
            "max_tokens": 8192,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        }
        if self.supports_reasoning_param:
            # deepseek-v4-flash varsayılan thinking modda; düşünme tokenleri
            # çıktı fiyatından yazılıyor → düşük efor maliyeti kısar.
            body["reasoning"] = {"effort": "low"}

        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": "https://yks-kiyas.vercel.app",
                "X-Title": "YKS Metric Fill",
            },
            json=body,
            timeout=300,
        )
        if resp.status_code == 400 and self.supports_reasoning_param:
            self.supports_reasoning_param = False
            raise RuntimeError("reasoning param reddedildi, tekrar denenecek")
        if resp.status_code == 429:
            time.sleep(15)
            raise RuntimeError("rate limited")
        if resp.status_code in (401, 402, 403):
            raise ProviderExhausted(f"OpenRouter hata: {resp.status_code} {resp.text[:200]}")
        resp.raise_for_status()
        data = resp.json()
        if data.get("error"):
            raise RuntimeError(f"OpenRouter hata: {str(data['error'])[:200]}")
        return data["choices"][0]["message"]["content"]


def build_provider_chain(preference: str) -> List[Any]:
    load_env()
    chain: List[Any] = []
    gem_key = os.environ.get("GEMINI_API_KEY", "")
    or_key = os.environ.get("OPENROUTER_API_KEY", "")

    if preference in ("auto", "gemini") and gem_key:
        chain.append(GeminiProvider(gem_key))
    if preference in ("auto", "openrouter") and or_key:
        chain.append(OpenRouterProvider(or_key))
    if not chain:
        raise SystemExit("API anahtarı bulunamadı (.env: GEMINI_API_KEY / OPENROUTER_API_KEY)")
    return chain


# ---------------------------------------------------------------------------
# JSON ayrıştırma + çalıştırma döngüsü
# ---------------------------------------------------------------------------

def parse_results(raw: str) -> List[Dict]:
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    doc = json.loads(text)
    if isinstance(doc, dict) and isinstance(doc.get("results"), list):
        return doc["results"]
    if isinstance(doc, list):
        return doc
    raise ValueError("JSON içinde 'results' listesi yok")


def load_output(path: str) -> Dict[str, Any]:
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            doc = json.load(f)
            return doc.get("metrics", {})
    return {}


def save_output(path: str, metrics: Dict[str, Any], entity_type: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc = {
        "version": 1,
        "entity_type": entity_type,
        "count": len(metrics),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "metrics": metrics,
    }
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    os.replace(tmp, path)


def clamp_score(val: Any) -> Optional[float]:
    try:
        return round(max(0.0, min(10.0, float(val))), 1)
    except (TypeError, ValueError):
        return None


def normalize_result(entity_type: str, rec: Dict, model: str) -> Optional[Dict]:
    rid = str(rec.get("id") or "").strip()
    if not rid:
        return None
    out: Dict[str, Any] = {
        "model": model,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "confidence": clamp_score(rec.get("confidence")) or 0.6,
    }
    if entity_type == "universities":
        for m in UNI_METRICS:
            score = clamp_score(rec.get(m))
            if score is not None:
                out[f"{m}_score"] = score
        if rec.get("note"):
            out["note"] = str(rec["note"])[:220]
    elif entity_type == "campuses":
        for m in CAMPUS_METRICS:
            score = clamp_score(rec.get(m))
            if score is not None:
                out[f"{m}_score"] = score
            desc = rec.get(f"{m}_desc")
            if desc:
                out[f"{m}_desc"] = str(desc)[:260]
    else:
        score = clamp_score(rec.get("cost"))
        if score is not None:
            out["cost_score"] = score
        if rec.get("cost_desc"):
            out["cost_desc"] = str(rec["cost_desc"])[:260]
    return {"id": rid, "data": out}


def run_entity_type(
    entity_type: str,
    entities: List[Dict],
    key_fn,
    prompt_fn,
    providers: List[Any],
    chunk_size: int,
    limit: Optional[int],
    dry_run: bool,
) -> None:
    out_path = os.path.join(OUT_DIR, f"{entity_type}.json")
    existing = load_output(out_path)

    pending = [e for e in entities if key_fn(e) not in existing]
    if limit is not None:
        pending = pending[:limit]

    print(f"\n=== {entity_type}: toplam {len(entities)}, mevcut {len(existing)}, işlenecek {len(pending)} ===")
    if not pending:
        return

    chunks = [pending[i:i + chunk_size] for i in range(0, len(pending), chunk_size)]
    if dry_run:
        print(f"  {len(chunks)} istek atılacak (chunk={chunk_size}). Örnek prompt:")
        print("-" * 60)
        print(prompt_fn(chunks[0])[:1200])
        print("-" * 60)
        return

    active = list(providers)
    for ci, chunk in enumerate(chunks):
        prompt = prompt_fn(chunk)
        chunk_keys = {key_fn(e) for e in chunk}
        success = False

        while active and not success:
            provider = active[0]
            model_label = getattr(provider, "model", OPENROUTER_MODEL)
            for attempt in range(MAX_RETRIES_PER_CHUNK):
                try:
                    raw = provider.call(prompt)
                    results = parse_results(raw)
                    added = 0
                    for rec in results:
                        norm = normalize_result(entity_type, rec, f"{provider.name}:{model_label}")
                        if norm and norm["id"] in chunk_keys:
                            existing[norm["id"]] = norm["data"]
                            added += 1
                    save_output(out_path, existing, entity_type)
                    print(f"  [{ci + 1}/{len(chunks)}] {provider.name} → {added}/{len(chunk)} kayıt")
                    success = True
                    break
                except ProviderExhausted as e:
                    print(f"  [{provider.name}] devre dışı: {e}")
                    active.pop(0)
                    break
                except Exception as e:
                    wait = 5 * (attempt + 1)
                    print(f"  [{ci + 1}/{len(chunks)}] {provider.name} hata ({attempt + 1}/{MAX_RETRIES_PER_CHUNK}): {str(e)[:120]} — {wait}s bekleniyor")
                    time.sleep(wait)
            else:
                # 3 deneme de başarısız → sıradaki sağlayıcı
                print(f"  [{provider.name}] chunk başarısız, sıradaki sağlayıcıya geçiliyor")
                active.pop(0)

        if not active and not success:
            print("  TÜM SAĞLAYICILAR TÜKENDİ — checkpoint kaydedildi, script tekrar çalıştırılabilir.")
            return



def main() -> None:
    parser = argparse.ArgumentParser(description="LLM ile metrik doldurma (varlık bazlı batch)")
    parser.add_argument("--only", choices=["universities", "campuses", "cities"], default=None)
    parser.add_argument("--limit", type=int, default=None, help="Varlık sayısı sınırı (test için)")
    parser.add_argument("--chunk-size", type=int, default=CHUNK_SIZE)
    parser.add_argument("--provider", choices=["auto", "gemini", "openrouter"], default="auto")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    unis, campuses, cities = extract_entities()
    providers = [] if args.dry_run else build_provider_chain(args.provider)

    jobs = [
        ("universities", unis, lambda u: uni_key(u["university"]), build_uni_prompt),
        ("campuses", campuses, campus_key_of, build_campus_prompt),
        ("cities", cities, lambda c: city_key(c["city"]), build_city_prompt),
    ]
    for entity_type, entities, key_fn, prompt_fn in jobs:
        if args.only and args.only != entity_type:
            continue
        run_entity_type(
            entity_type, entities, key_fn, prompt_fn,
            providers, args.chunk_size, args.limit, args.dry_run,
        )

    print("\nBitti. Çıktılar:", OUT_DIR)
    print("Sonraki adım: .venv/bin/python build_analysis_database.py  (LLM verileri enrich'e işlenir)")


if __name__ == "__main__":
    main()
