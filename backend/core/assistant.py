"""The in-app assistant: answers questions, opens the page the user asks for and
points at the thing they asked about.

The model never produces code or free-form selectors. It chooses a path from
SITE_MAP and a hook name from that page's list; the server checks both and the
browser only ever scrolls to and outlines `[data-assistant="<hook>"]`.
"""

import json
import re

from pydantic import BaseModel, ValidationError

from backend.ai.client import MetaAIClient
from backend.core.translate import enabled

# path pattern -> title, what the page is for, and the elements the assistant can point at.
SITE_MAP: dict[str, dict] = {
    "/app": {
        "title": "Opportunities (the tender feed)",
        "keywords": ["opportunit", "feed", "fırsat", "firsat", "ihale listesi", "oportunit", "home", "ana sayfa", "dashboard"],
        "hooks": {
            "filters-search": "the search box for tenders",
            "feed-filters": "the Filters button (county, procedure, value, minimum match, eligibility)",
            "feed-refresh": "the refresh button",
            "tender-card": "a tender card (title, match score, deadline, track button)",
        },
    },
    "/app/tenders": {
        "title": "Tender analysis (list of tenders to analyse)",
        "keywords": ["analysis", "analiz", "analiză"],
        "hooks": {},
    },
    "/app/tenders/{id}": {
        "title": "One tender: summary, timeline, eligibility, match score, document preparation",
        "keywords": [],
        "hooks": {
            "score-card": "the match score and why",
            "eligibility-card": "the eligibility analysis",
            "unmet-box": "requirements that are not met",
            "requirements-card": "matched requirements",
            "tender-track": "the Track tender button (adds it to the pipeline)",
            "tender-generate": "the Generate documents button",
            "docs-generate": "the Generate button inside Document preparation (open with ?tab=docs)",
            "workspace-docs": "the list of generated documents (?tab=docs)",
            "workspace-editor": "the document editor (?tab=docs)",
            "workspace-ask-ai": "the Ask AI to edit button (?tab=docs)",
        },
    },
    "/app/pipeline": {
        "title": "Bidding pipeline (kanban of tracked tenders: New, Preparing, Submitted, Archived)",
        "keywords": ["pipeline", "kanban", "bidding", "takip", "başvuru", "basvuru", "pipe"],
        "hooks": {"pipeline-board": "the kanban board"},
    },
    "/app/archive": {
        "title": "Archive (document vault: certificates, references, past tenders)",
        "keywords": ["archive", "arşiv", "arsiv", "arhiv", "vault", "belge", "documents"],
        "hooks": {},
    },
    "/app/profile": {
        "title": "Company profile (what the company is, can do and has)",
        "keywords": ["profile", "profil", "şirket", "sirket", "company", "companie"],
        "hooks": {
            "profile-company": "company details, legal representative and signature",
            "profile-contracts": "reference contracts",
            "profile-guarantees": "guarantee and financial capacity",
            "profile-staff": "staff by role",
            "profile-workload": "workload",
            "profile-exclusion": "exclusion declarations",
            "profile-preferences": "notification and reminder settings (e-mail reminders before a deadline)",
            "profile-documents": "uploaded certificates and documents",
            "profile-signature": "the signature image used on documents",
        },
    },
    "/app/settings": {
        "title": "Settings (account, plan, usage)",
        "keywords": ["settings", "ayar", "setări", "setari", "plan", "account", "hesap"],
        "hooks": {},
    },
}

NAV_HOOKS = {
    "nav-opportunities": "sidebar link: Opportunities",
    "nav-analysis": "sidebar link: Tender analysis",
    "nav-pipeline": "sidebar link: Bidding pipeline",
    "nav-archive": "sidebar link: Archive",
    "nav-profile": "sidebar link: Profile",
    "nav-settings": "sidebar link: Settings",
    "nav-collapse": "the small round button that collapses the sidebar",
}

_AGENTS = ("spec", "eligibility", "legal", "writer", "risk")


class AssistantRequest(BaseModel):
    question: str
    pathname: str = "/app"
    tenderId: str | None = None
    dom: list[dict] = []
    history: list[dict] = []
    doc: dict | None = None


class Revision(BaseModel):
    target: str = ""
    before: str = ""
    after: str


class AssistantResponse(BaseModel):
    message: str
    highlight_selector: str | None = None
    navigate_to: str | None = None
    agent: str = "spec"
    revision: Revision | None = None


class _Plan(BaseModel):
    message: str = ""
    navigate_to: str | None = None
    highlight_hook: str | None = None
    agent: str = "spec"
    revision: Revision | None = None


def _page_key(path: str) -> str | None:
    """SITE_MAP key of a concrete path ('/app/tenders/123' -> '/app/tenders/{id}')."""
    clean = path.split("?")[0].rstrip("/") or "/"
    if re.fullmatch(r"/app/tenders/[^/]+", clean):
        return "/app/tenders/{id}"
    return clean if clean in SITE_MAP else None


def _resolve_destination(raw: str | None, tender_id: str | None) -> str | None:
    """A path the app really has: a SITE_MAP page, with {id} filled by the open tender."""
    if not raw:
        return None
    path, _, query = raw.partition("?")
    path = path.rstrip("/") or "/"
    if "{id}" in path:
        if not tender_id or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", tender_id):
            return None
        path = path.replace("{id}", tender_id)
    if _page_key(path) is None:
        return None
    return f"{path}?tab=docs" if query == "tab=docs" and path.startswith("/app/tenders/") else path


def _hooks_for(path: str) -> dict[str, str]:
    key = _page_key(path)
    return {**NAV_HOOKS, **(SITE_MAP[key]["hooks"] if key else {})}


def _site_map_text() -> str:
    lines = []
    for path, page in SITE_MAP.items():
        lines.append(f"- {path}: {page['title']}")
        for hook, what in page["hooks"].items():
            lines.append(f"    * {hook}: {what}")
    lines.append("- On every page: " + ", ".join(NAV_HOOKS))
    return "\n".join(lines)


SYSTEM = """\
You are the assistant inside Licits, a tool that helps Romanian contractors find, \
check and bid on public tenders. You help with this app only. Reply in the language \
the user wrote in (Turkish, English or Romanian), in one to three short sentences, \
plainly, never inventing features.

You can open a page and point at one element on it. Pages and the elements you may \
point at:
{site_map}

The user is now on: {here}
Elements visible right now: {live}
{tender_line}
{doc_block}
Respond with ONLY a JSON object:
{{"message": string, "navigate_to": string|null, "highlight_hook": string|null, \
"agent": one of {agents}, "revision": null | {{"target": string, "before": string, "after": string}}}}

Rules:
- When the user asks to go somewhere or to be shown something, set navigate_to to a \
page path from the list above (use /app/tenders/{{id}} only if a tender is open; add \
?tab=docs for the document preparation tab) and highlight_hook to ONE hook from that \
page's list, or null. If they are already on that page, set navigate_to to null.
- Only use hook names that appear in the list. Never invent a path or a hook.
- "message" says what you did or the answer, e.g. what the highlighted thing is for.
- "revision" only when a document is open and the user asks to change its text: \
"target" is a short exact snippet of the paragraph to replace (empty to append), \
"before" that paragraph, "after" the new text. Otherwise null.
- If you do not know, say so briefly.
"""


def _fallback(req: AssistantRequest) -> AssistantResponse:
    """Without a model: open a page when the question names one."""
    q = req.question.lower()
    for path, page in SITE_MAP.items():
        if "{id}" in path:
            continue
        if any(k in q for k in page["keywords"]):
            here = _page_key(req.pathname)
            return AssistantResponse(
                message=f"Opening: {page['title']}." if here != path else f"You are already on: {page['title']}.",
                navigate_to=path if here != path else None,
                highlight_selector=None,
            )
    return AssistantResponse(
        message="I can open Opportunities, Pipeline, Archive, Profile or Settings. Ask me to take you to one of them.",
    )


async def reply(req: AssistantRequest, *, ai: MetaAIClient | None = None) -> AssistantResponse:
    question = req.question.strip()[:500]
    req = req.model_copy(update={"question": question})
    if not question:
        return AssistantResponse(message="")
    if not enabled():
        return _fallback(req)

    here_key = _page_key(req.pathname)
    live = sorted({str(n.get("hook")) for n in req.dom if n.get("hook") and re.fullmatch(r"[a-z0-9-]{2,40}", str(n.get("hook")), re.I)})
    doc_block = ""
    if req.doc:
        paras = [str(p)[:400] for p in (req.doc.get("paragraphs") or [])[:30]]
        doc_block = f"A document is open for editing: {req.doc.get('title', '')}. Its paragraphs:\n" + "\n".join(f"  [{i}] {p}" for i, p in enumerate(paras))
    system = SYSTEM.format(
        site_map=_site_map_text(),
        here=f"{req.pathname} ({SITE_MAP[here_key]['title'] if here_key else 'unknown page'})",
        live=", ".join(live) or "none",
        tender_line=f"A tender is open: {req.tenderId}." if req.tenderId else "No tender is open.",
        doc_block=doc_block,
        agents=" | ".join(_AGENTS),
    )
    history = "\n".join(f"{m.get('role', 'user')}: {str(m.get('text', ''))[:300]}" for m in req.history[-8:])
    user_message = (f"Conversation so far:\n{history}\n\n" if history else "") + f"User: {question}"

    ai = ai or MetaAIClient()
    plan: _Plan | None = None
    for _ in range(2):
        try:
            raw = await ai._chat(system, user_message, json_mode=True, purpose="assistant")  # noqa: SLF001
            plan = _Plan.model_validate(json.loads(raw))
            break
        except (json.JSONDecodeError, ValidationError, ValueError):
            continue
        except Exception:  # noqa: BLE001 - a model outage must not become a 500 in the chat
            break
    if plan is None or not plan.message.strip():
        return _fallback(req)

    destination = _resolve_destination(plan.navigate_to, req.tenderId)
    target_path = destination or req.pathname
    hook = plan.highlight_hook if plan.highlight_hook in _hooks_for(target_path) else None
    # On the current page the live DOM is the truth: a hook that is not rendered cannot be pointed at.
    if hook and not destination and hook not in live and not hook.startswith("nav-"):
        hook = None
    if destination and _page_key(destination) == here_key and destination.split("?")[0] == req.pathname.split("?")[0] and "tab=docs" not in destination:
        destination = None
    revision = plan.revision if req.doc and plan.revision and plan.revision.after.strip() else None
    return AssistantResponse(
        message=plan.message.strip()[:600],
        navigate_to=destination,
        highlight_selector=f'[data-assistant="{hook}"]' if hook else None,
        agent=plan.agent if plan.agent in _AGENTS else "spec",
        revision=revision,
    )
