---
name: ai-intelligence-dashboard
description: "Build an up-to-date AI intelligence dashboard with three blocks: recent scientific AI research papers, trustworthy AI journalism/news, and AI topic trends from developer/social/technology communities. Use when asked to monitor, research, summarize, curate, or render a dashboard/report about artificial intelligence updates, papers, models, tools, software releases, or market/tech trends."
---

# AI Intelligence Dashboard

## Overview

Create a concise, source-backed dashboard about artificial intelligence, organized into exactly three blocks:

1. **Pesquisas científicas recentes** — papers/preprints from reputable research sources.
2. **Notícias confiáveis sobre IA** — journalism/news from trustworthy outlets.
3. **Tendências em IA** — signals from social/dev communities, release notes, repositories, model hubs, forums, and product-update channels.

Default language: match the user language. For Merlo, write in Brazilian Portuguese.

## Workflow

1. **Define freshness window**
   - If the user does not specify a period, use the last 7 days for news/trends and the last 14 days for papers.
   - State the collection timestamp and timezone.

2. **Collect sources by block**
   - Search broadly first, then verify promising results with source pages.
   - Prefer primary sources for papers and releases; use reputable secondary reporting for news context.
   - See `references/source-guide.md` for recommended source categories and search patterns.

3. **Validate and filter**
   - Keep only items with a URL, publication/update date, source name, and clear AI relevance.
   - Remove duplicates and near-duplicates across outlets.
   - Avoid treating rumors, reposts, engagement bait, or unsourced social posts as facts.
   - For trends, label the signal type: `GitHub`, `Hacker News`, `Reddit`, `Hugging Face`, `X/social`, `release notes`, `community`, or `search interest`.

4. **Score each candidate**
   - `relevance`: importance to AI builders, users, researchers, or business.
   - `credibility`: source quality and whether primary evidence exists.
   - `novelty`: how new/different the item is.
   - Prefer 3–7 strong items per block unless the user asks otherwise.

5. **Summarize each item**
   - Title
   - Date and source
   - 1–2 sentence summary
   - “Por que importa” explaining practical impact
   - Tags
   - Link/citation

6. **Render the dashboard**
   - For a quick chat answer, use bullets under the three required headings.
   - For an HTML dashboard, create a JSON file following the schema in `references/dashboard-schema.json`, then run:

```bash
python3 <skill-dir>/scripts/render_dashboard.py input.json output.html
```

   - If running in OpenClaw webchat and the user wants an inline dashboard, stage the output under the active canvas document root and return an `[embed ref="..."]` directive when appropriate.

## Output standards

- Always separate the three blocks clearly.
- Include source links for every item.
- Distinguish facts from interpretation.
- Mention if a trend is only a weak signal.
- Do not overclaim benchmark results; include model/task context when available.
- Keep the top summary short: 3–5 bullets with the most important cross-cutting takeaways.

## Useful resources

- `references/source-guide.md` — source selection and search patterns.
- `references/dashboard-schema.json` — JSON input format for the renderer.
- `scripts/render_dashboard.py` — generate a clean self-contained HTML dashboard.
- `assets/dashboard.css` — stylesheet embedded by the renderer.
