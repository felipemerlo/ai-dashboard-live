#!/usr/bin/env python3
"""Render an AI intelligence dashboard from JSON to self-contained HTML."""

from __future__ import annotations

import json
import sys
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any

SECTION_LABELS = {
    "research": "1. Pesquisas científicas recentes",
    "news": "2. Notícias confiáveis sobre IA",
    "trends": "3. Tendências em IA",
}


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict):
        raise SystemExit("Input JSON must be an object.")
    return data


def e(value: Any) -> str:
    return escape(str(value or ""), quote=True)


def render_tags(tags: list[Any] | None) -> str:
    if not tags:
        return ""
    return '<div class="tags">' + "".join(f'<span class="tag">{e(tag)}</span>' for tag in tags) + "</div>"


def render_item(item: dict[str, Any]) -> str:
    title = e(item.get("title", "Sem título"))
    url = e(item.get("url", ""))
    source = e(item.get("source", "Fonte não informada"))
    date = e(item.get("date", "Data não informada"))
    credibility = e(item.get("credibility", "medium")).lower()
    signal = item.get("signal_type")
    summary = e(item.get("summary", ""))
    why = e(item.get("why_it_matters", ""))
    tags = render_tags(item.get("tags") if isinstance(item.get("tags"), list) else [])
    title_html = f'<a href="{url}" target="_blank" rel="noopener noreferrer">{title}</a>' if url else title
    signal_html = f' · Sinal: {e(signal)}' if signal else ""
    return f"""
      <article class="card">
        <h3>{title_html}</h3>
        <div class="item-meta">{date} · {source}{signal_html} · <span class="badge {credibility}">{credibility}</span></div>
        <p>{summary}</p>
        <p class="why"><strong>Por que importa:</strong> {why}</p>
        {tags}
      </article>
    """


def render_section(key: str, items: list[Any]) -> str:
    cards = []
    for item in items:
        if isinstance(item, dict):
            cards.append(render_item(item))
    if not cards:
        cards.append('<article class="card"><p>Nenhum item validado para este bloco.</p></article>')
    return f"""
    <section>
      <h2>{SECTION_LABELS.get(key, e(key))}</h2>
      {''.join(cards)}
    </section>
    """


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: render_dashboard.py input.json output.html", file=sys.stderr)
        return 2

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    data = load_json(input_path)

    css_path = Path(__file__).resolve().parents[1] / "assets" / "dashboard.css"
    css = css_path.read_text(encoding="utf-8") if css_path.exists() else ""

    title = e(data.get("title", "Dashboard de Inteligência Artificial"))
    generated_at = e(data.get("generated_at", datetime.now().isoformat(timespec="minutes")))
    period = e(data.get("period", "Período não informado"))
    takeaways = data.get("takeaways") if isinstance(data.get("takeaways"), list) else []
    takeaways_html = "".join(f"<li>{e(t)}</li>" for t in takeaways)
    sections = data.get("sections") if isinstance(data.get("sections"), dict) else {}

    html = f"""<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <style>{css}</style>
</head>
<body>
  <main>
    <header>
      <h1>{title}</h1>
      <p class="meta">Gerado em {generated_at} · {period}</p>
    </header>
    <aside class="takeaways">
      <h2>Resumo executivo</h2>
      <ul>{takeaways_html}</ul>
    </aside>
    <div class="section-grid">
      {render_section('research', sections.get('research', []))}
      {render_section('news', sections.get('news', []))}
      {render_section('trends', sections.get('trends', []))}
    </div>
  </main>
</body>
</html>
"""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(html, encoding="utf-8")
    print(output_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
