#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
DATA_PATH = ROOT / "data.json"
UA = {"User-Agent": "OpenClaw AI dashboard/1.0"}

SECTION_LABELS = {
    "research": "Papers Científicos",
    "news": "Notícias",
    "trends": "Tendências",
}


def load_data() -> dict[str, Any]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def save_data(data: dict[str, Any]) -> None:
    DATA_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def fetch_text(url: str, timeout: int = 18) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def fetch_json(url: str, timeout: int = 18) -> Any:
    return json.loads(fetch_text(url, timeout))


def clean(s: str | None, limit: int = 900) -> str:
    s = re.sub(r"\s+", " ", s or "").strip()
    return s[:limit].rstrip()


def item(section: str, title: str, date: str, source: str, url: str, summary: str, why: str, tags: list[str], subcategory: str, credibility="medium", signal_type: str | None = None) -> dict[str, Any]:
    out = {
        "id": url,
        "category": section,
        "subcategory": subcategory,
        "title": clean(title, 220),
        "date": date,
        "source": source,
        "url": url,
        "summary": clean(summary, 500),
        "why_it_matters": clean(why, 420),
        "tags": tags,
        "credibility": credibility,
        "deleted": False,
    }
    if signal_type:
        out["signal_type"] = signal_type
    return out


def arxiv_items() -> list[dict[str, Any]]:
    query = "cat:cs.AI OR cat:cs.CL OR cat:cs.LG OR cat:cs.CV"
    url = "http://export.arxiv.org/api/query?" + urllib.parse.urlencode({
        "search_query": query,
        "sortBy": "submittedDate",
        "sortOrder": "descending",
        "start": 0,
        "max_results": 8,
    })
    root = ET.fromstring(fetch_text(url))
    ns = {"a": "http://www.w3.org/2005/Atom"}
    out = []
    for e in root.findall("a:entry", ns):
        title = clean(e.findtext("a:title", "", ns), 220)
        published = (e.findtext("a:published", "", ns) or "")[:10]
        link = e.findtext("a:id", "", ns) or ""
        summary = clean(e.findtext("a:summary", "", ns), 500)
        low = (title + " " + summary).lower()
        if any(w in low for w in ["agent", "llm", "language model"]):
            sub = "Agentes e arquitetura" if "agent" in low else "Modelos de linguagem"
        elif any(w in low for w in ["video", "vision", "multimodal", "vlm", "image"]):
            sub = "Multimodal e VLM"
        elif any(w in low for w in ["medical", "clinical", "health"]):
            sub = "IA médica e evidências"
        else:
            sub = "Pesquisa aplicada"
        out.append(item("research", title, published, "arXiv", link, summary, "Paper recente em fonte primária; vale acompanhar contribuição, método e limitações antes de transformar em decisão de produto.", ["paper", "AI"], sub, "high"))
    return out


def gdelt_news() -> list[dict[str, Any]]:
    domains = [
        ("technologyreview.com", "MIT Technology Review"),
        ("theverge.com", "The Verge"),
        ("wired.com", "WIRED"),
        ("reuters.com", "Reuters"),
        ("bloomberg.com", "Bloomberg"),
    ]
    out = []
    for domain, source in domains:
        q = f'domain:{domain} "artificial intelligence" OR AI'
        url = "https://api.gdeltproject.org/api/v2/doc/doc?" + urllib.parse.urlencode({
            "query": q,
            "mode": "ArtList",
            "format": "json",
            "maxrecords": 3,
            "timespan": "7d",
            "sort": "hybridrel",
        })
        try:
            data = fetch_json(url, 12)
        except Exception:
            continue
        for a in data.get("articles", [])[:3]:
            title = clean(a.get("title"), 220)
            link = a.get("url") or ""
            if not title or not link:
                continue
            date = (a.get("seendate") or "")[:8]
            if len(date) == 8:
                date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
            low = title.lower()
            if any(w in low for w in ["deepfake", "privacy", "safety", "security"]):
                sub = "Privacidade e segurança"
            elif any(w in low for w in ["regulat", "law", "act", "court"]):
                sub = "Regulação e deepfakes"
            elif any(w in low for w in ["chip", "laptop", "device", "android", "hardware"]):
                sub = "Hardware e plataformas"
            elif any(w in low for w in ["jobs", "layoff", "market", "stock", "company"]):
                sub = "Mercado e trabalho"
            else:
                sub = "Notícias gerais"
            out.append(item("news", title, date, source, link, "Notícia recente capturada em fonte jornalística via GDELT; abrir o link para ler contexto completo.", "Ajuda a monitorar movimentos de mercado, regulação, produto e riscos públicos ligados a IA.", ["news", "AI"], sub, "medium"))
    return out


def github_trends() -> list[dict[str, Any]]:
    queries = [
        ("AI LLM pushed:>2026-05-13", "Agentes open-source"),
        ("AI agents created:>2026-05-01", "Agentes locais e self-hosted"),
    ]
    out = []
    for q, sub in queries:
        url = "https://api.github.com/search/repositories?" + urllib.parse.urlencode({"q": q, "sort": "stars", "order": "desc", "per_page": 5})
        try:
            data = fetch_json(url, 15)
        except Exception:
            continue
        for r in data.get("items", [])[:5]:
            name = r.get("full_name") or r.get("name") or "Repo"
            stars = r.get("stargazers_count", 0)
            pushed = (r.get("pushed_at") or r.get("created_at") or "")[:10]
            desc = clean(r.get("description"), 350)
            link = r.get("html_url") or ""
            out.append(item("trends", f"{name} — {stars:,} estrelas".replace(",", "."), pushed, "GitHub", link, desc or "Repositório com atividade recente ligado a IA.", "Sinal de adoção técnica: estrelas, atividade e repos recentes indicam onde desenvolvedores estão concentrando atenção.", ["GitHub", "open-source"], sub, "medium", "GitHub"))
    return out


def hf_trends() -> list[dict[str, Any]]:
    out = []
    try:
        data = fetch_json("https://huggingface.co/api/models?search=llm&sort=downloads&direction=-1&limit=8", 15)
    except Exception:
        return out
    for m in data[:6]:
        mid = m.get("id") or "Modelo Hugging Face"
        downloads = m.get("downloads", 0)
        likes = m.get("likes", 0)
        out.append(item("trends", f"{mid} — {downloads:,} downloads".replace(",", "."), (m.get("lastModified") or datetime.now().date().isoformat())[:10], "Hugging Face", "https://huggingface.co/" + mid, f"Modelo listado entre os mais baixados para a busca LLM; likes: {likes}.", "Downloads e likes são sinais de uso comunitário; devem ser lidos como tendência, não como validação técnica completa.", ["Hugging Face", "models"], "Modelos e comunidade", "medium", "Hugging Face"))
    return out


def hn_trends() -> list[dict[str, Any]]:
    start = int((datetime.now(timezone.utc) - timedelta(days=7)).timestamp())
    url = f"https://hn.algolia.com/api/v1/search_by_date?query=AI%20LLM%20agent&tags=story&numericFilters=created_at_i>{start}&hitsPerPage=8"
    out = []
    try:
        data = fetch_json(url, 15)
    except Exception:
        return out
    for h in data.get("hits", [])[:6]:
        title = h.get("title") or h.get("story_title") or "Discussão HN"
        link = h.get("url") or f"https://news.ycombinator.com/item?id={h.get('objectID')}"
        date = (h.get("created_at") or "")[:10]
        points = h.get("points") or 0
        comments = h.get("num_comments") or 0
        out.append(item("trends", title, date, "Hacker News", link, f"Discussão recente com {points} pontos e {comments} comentários.", "HN é útil para captar preocupações e interesses de builders; sinal fraco quando há pouco engajamento.", ["HN", "community"], "Discussões de builders", "low" if points < 10 else "medium", "Hacker News"))
    return out


def collect_new_items() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for fn in [arxiv_items, gdelt_news, github_trends, hf_trends, hn_trends]:
        try:
            items.extend(fn())
        except Exception as e:
            print(f"collector error {fn.__name__}: {e}")
    return items


def merge_update(data: dict[str, Any]) -> dict[str, Any]:
    deleted = set(data.get("deleted_urls", []))
    existing = {}
    for section, items in data.get("sections", {}).items():
        for it in items:
            key = it.get("url") or it.get("id") or it.get("title")
            existing[key] = it
    added = 0
    for it in collect_new_items():
        key = it.get("url") or it.get("id") or it.get("title")
        if not key or key in deleted or key in existing:
            continue
        section = it.get("category") or "trends"
        data.setdefault("sections", {}).setdefault(section, []).append(it)
        existing[key] = it
        added += 1
    data["generated_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
    data["last_update"] = {"added": added, "at": data["generated_at"]}
    return data


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes, ctype: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path in ["/", "/index.html"]:
            return self._send(200, (ROOT / "index.html").read_bytes(), "text/html; charset=utf-8")
        if path == "/mobile" or path == "/mobile.html":
            return self._send(200, (ROOT / "mobile.html").read_bytes(), "text/html; charset=utf-8")
        if path in ["/styles.css", "/mobile.css"]:
            return self._send(200, (ROOT / path.lstrip("/")).read_bytes(), "text/css; charset=utf-8")
        if path in ["/app.js", "/mobile.js"]:
            return self._send(200, (ROOT / path.lstrip("/")).read_bytes(), "text/javascript; charset=utf-8")
        if path == "/api/data":
            return self._send(200, DATA_PATH.read_bytes())
        self._send(404, b'{"error":"not found"}')

    def read_json(self) -> dict[str, Any]:
        n = int(self.headers.get("Content-Length", "0") or 0)
        if n <= 0:
            return {}
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/api/delete":
            payload = self.read_json()
            url = payload.get("url") or payload.get("id")
            data = load_data()
            if url:
                deleted = set(data.get("deleted_urls", []))
                deleted.add(url)
                data["deleted_urls"] = sorted(deleted)
                for items in data.get("sections", {}).values():
                    for it in items:
                        if (it.get("url") or it.get("id")) == url:
                            it["deleted"] = True
                save_data(data)
            return self._send(200, json.dumps({"ok": True}).encode())
        if path == "/api/update":
            data = merge_update(load_data())
            save_data(data)
            return self._send(200, json.dumps(data, ensure_ascii=False).encode())
        self._send(404, b'{"error":"not found"}')

    def log_message(self, fmt, *args):
        print("dashboard:", fmt % args)


if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8765
    print(f"Dashboard em http://127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
