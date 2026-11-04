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
from backend.ai.safety import clean_text, wrap_untrusted
from backend.core.translate import enabled

# path pattern -> title, what the page is for, what to tell users about it, and the
# elements the assistant can point at.
SITE_MAP: dict[str, dict] = {
    "/app": {
        "title": "Opportunities (the tender feed)",
        "keywords": ["opportunit", "feed", "fırsat", "firsat", "ihale listesi", "oportunit", "home", "ana sayfa", "dashboard"],
        "help": [
            "Shows open public tenders from SEAP, ranked by how well they match the company (match score 0-100).",
            "Search by words, open Filters to narrow by county, procedure, minimum value, CPV code, minimum match score or only eligible tenders, and sort by match, deadline or value.",
            "Each card has the title (English or Romanian), score, deadline and a Track button that adds it to the Bidding pipeline. Click the title to open the tender.",
            "Export saves the shown tenders as a spreadsheet file. Refresh reloads the feed (new tenders are synced every 6 hours).",
        ],
        "hooks": {
            "feed-header": "the page title and the summary figures",
            "filters-search": "the search box for tenders",
            "feed-filters": "the Filters button (opens the filter panel)",
            "filter-county": "the County filter (inside the filter panel)",
            "filter-procedure": "the Procedure type filter (inside the filter panel)",
            "filter-value": "the minimum value filter (inside the filter panel)",
            "filter-cpv": "the CPV code filter (inside the filter panel)",
            "filter-score": "the minimum match score slider (inside the filter panel)",
            "feed-sort": "the Sort control (match, deadline, value)",
            "feed-export": "the Export button",
            "feed-refresh": "the refresh button",
            "tender-card": "a tender card (title, match score, deadline, Track button)",
        },
    },
    "/app/tenders": {
        "title": "Tender analysis (the tenders the company follows, with their analysis)",
        "keywords": ["analysis", "analiz", "analiză", "analiza"],
        "help": ["Lists the tenders being tracked with score and eligibility; open one for the full analysis."],
        "hooks": {"analysis-header": "the page title", "analysis-list": "the list of tracked tenders"},
    },
    "/app/tenders/{id}": {
        "title": "One tender: summary, timeline, eligibility, match score, past winners, document preparation",
        "keywords": [],
        "help": [
            "Overview tab: a plain-language brief of the work (what it is, how it is done, key conditions, what to check, what the notice does not say), the procedure timeline, the data sheet, the match score with reasons, the eligibility analysis, past winners and renewal history.",
            "The match score is rule-based: it compares the tender's CPV code, value and county with the company profile. It is not a prediction of winning.",
            "Eligibility is checked requirement by requirement as met, not met or unclear; it appears after the tender documents are analysed in Document preparation.",
            "Past winners shows who the same buyer awarded similar contracts to, with their latest financial figures; it uses a monthly quota (shown in the sidebar).",
            "Track tender adds it to the Bidding pipeline. View on SEAP opens the official notice.",
            "Document preparation tab: tick the documents (technical offer, financial offer, DUAE) and sources, press Generate. Five agents read the tender, check the company, review legal points, write the offer and assess risks; then a dialog asks for the company's declarations and prices. Afterwards: edit the text by hand, PDF preview, review notes, download all PDFs or one ZIP with certificates and a checklist.",
            "Documents are drafts in Romanian; the company must check them and sign with its qualified electronic signature before submitting in SEAP.",
        ],
        "hooks": {
            "tender-header": "the tender title, score and status chips",
            "tender-tabs": "the Overview / Document preparation tabs",
            "tender-summary": "the summary / brief of the work",
            "tender-timeline": "the procedure timeline (published, clarification deadline, submission deadline)",
            "tender-datasheet": "the executive data sheet (authority, procedure, CPV, value, dates)",
            "score-card": "the match score and why",
            "eligibility-card": "the eligibility analysis",
            "unmet-box": "requirements that are not met",
            "requirements-card": "matched requirements",
            "tender-track": "the Track tender button (adds it to the pipeline)",
            "tender-generate": "the Generate documents button",
            "tender-seap-link": "the View on SEAP link",
            "tender-past-winners": "the Past winners card",
            "tender-renewal": "the renewal history card",
            "generate-output": "the whole Document preparation section (?tab=docs)",
            "docs-types": "the documents to generate (open with ?tab=docs)",
            "docs-sources": "the evidence documents used as sources (?tab=docs)",
            "docs-generate": "the Generate button inside Document preparation (?tab=docs)",
            "docs-agents": "the five agents and their progress (?tab=docs)",
            "docs-completeness": "the draft completeness bar (?tab=docs)",
            "docs-review": "the review notes: requirement checks, risks, what is missing (?tab=docs)",
            "docs-download": "the download buttons: all PDFs or the full ZIP package (?tab=docs)",
            "docs-view-toggle": "the Edit / PDF preview switch (?tab=docs)",
            "workspace-docs": "the list of generated documents (?tab=docs)",
            "workspace-editor": "the document editor (?tab=docs)",
        },
    },
    "/app/pipeline": {
        "title": "Bidding pipeline (kanban of tracked tenders)",
        "keywords": ["pipeline", "kanban", "bidding", "takip", "başvuru", "basvuru", "pipe"],
        "help": [
            "Four columns: New, Preparing, Submitted, Archived. Drag a card between columns to change its status; the x on a card stops tracking it.",
            "Deadline reminder e-mails are sent for tenders in Preparing, as many days before the deadline as the profile says.",
        ],
        "hooks": {
            "pipeline-header": "the page title",
            "pipeline-board": "the whole kanban board",
            "pipeline-col-new": "the New column",
            "pipeline-col-preparing": "the Preparing column (reminders are sent for these)",
            "pipeline-col-submitted": "the Submitted column",
            "pipeline-col-archived": "the Archived column",
        },
    },
    "/app/archive": {
        "title": "Archive (submitted tenders and the document vault)",
        "keywords": ["archive", "arşiv", "arsiv", "arhiv", "vault", "belge", "documents"],
        "help": [
            "Results: tenders the company submitted and whether they were awarded.",
            "Certificates and documents: the vault of the company's certificates, references and balance sheets. Add a document with the button; its details are read automatically.",
        ],
        "hooks": {
            "archive-header": "the page title",
            "archive-results": "the table of submitted tenders and results",
            "archive-certificates": "the certificates and documents vault",
            "archive-add": "the button that adds a certificate or document",
        },
    },
    "/app/profile": {
        "title": "Company profile (what the company is, can do and has)",
        "keywords": ["profile", "profil", "şirket", "sirket", "company", "companie"],
        "help": [
            "The profile drives matching, eligibility checks and the generated documents. Fill it as completely as you can; the strength bar shows what is missing.",
            "Company: legal details from ANAF, the legal representative and role (who signs offers) and the signature image placed on PDFs. The picture does not replace the qualified electronic signature SEAP requires.",
            "Reference contracts, guarantees and financial capacity, staff by role, workload, exclusion declarations, preferences and uploaded certificates each have their own section.",
            "Preferences: choose e-mail reminders for tenders you follow and how many days before the deadline to be reminded; the Save button stores everything.",
        ],
        "hooks": {
            "profile-company": "company details, legal representative and signature",
            "profile-rep-name": "the legal representative's name",
            "profile-rep-role": "the legal representative's role",
            "profile-signature": "the signature image upload",
            "profile-contracts": "reference contracts",
            "profile-guarantees": "guarantee and financial capacity",
            "profile-staff": "staff by role",
            "profile-workload": "workload",
            "profile-exclusion": "exclusion declarations (tax debt, insolvency, terminated contracts)",
            "profile-preferences": "notification, reminder and other preferences",
            "profile-reminder-lead": "how many days before a deadline to be reminded by e-mail",
            "profile-documents": "uploaded certificates and documents",
            "profile-save": "the Save button",
        },
    },
    "/app/settings": {
        "title": "Settings (basic profile fields, matching keywords, country authorizations)",
        "keywords": ["settings", "ayar", "setări", "setari", "plan", "account", "hesap"],
        "help": [
            "Quick edit of company name, CUI, capacity and certifications, plus the CPV codes used for matching and the keywords that exclude a tender.",
            "Authorizations: whether the company is registered to bid in a country.",
        ],
        "hooks": {
            "settings-header": "the page title",
            "settings-onboarding": "the reminder to finish onboarding",
            "settings-profile": "the basic company fields",
            "settings-matching": "the CPV codes and blacklist keywords used for matching",
            "settings-authorizations": "country authorizations",
            "settings-save": "the Save button",
        },
    },
    "/onboarding": {
        "title": "Onboarding wizard (seven steps that build the company profile)",
        "keywords": ["onboarding", "kurulum", "başlangıç", "baslangic"],
        "help": [
            "Step 1 Company: type the CUI and press Fill from ANAF to get the name, address, county, CAEN, VAT and turnover, and your past SEAP awards; add the website so it can be scanned for the right CPV codes; add the legal representative.",
            "Step 2 Your works (CPV), step 3 where and how (counties on a map, roles, capacity), step 4 turnover, step 5 authorizations and certificates, step 6 SEAP and team, step 7 review.",
            "CAEN is the company's registered activity code; CPV is the code of what a tender buys. To bid, the CPV work has to fit the CAEN codes.",
            "Progress is saved after each step.",
        ],
        "hooks": {
            "ob-progress": "the progress bar of the steps",
            "ob-cui": "the CUI field (step 1)",
            "ob-anaf": "the Fill from ANAF button (step 1)",
            "ob-name": "the company name field (step 1)",
            "ob-rep-name": "the legal representative field (step 1)",
            "ob-caen": "the main CAEN code field (step 1)",
            "ob-website": "the website field, scanned for CPV codes (step 1)",
            "ob-cpv-search": "the CPV code search (step 2)",
            "ob-back": "the Back button",
            "ob-next": "the Continue button",
        },
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
    "nav-quota": "the monthly past-winner lookups used",
    "language-toggle": "the EN | RO language switch (top right of every page)",
}

_AGENTS = ("spec", "eligibility", "legal", "writer", "risk")


class AssistantRequest(BaseModel):
    question: str
    pathname: str = "/app"
    tenderId: str | None = None
    dom: list[dict] = []
    history: list[dict] = []


class AssistantResponse(BaseModel):
    message: str
    highlight_selector: str | None = None
    navigate_to: str | None = None
    agent: str = "spec"


class _Plan(BaseModel):
    message: str = ""
    navigate_to: str | None = None
    highlight_hook: str | None = None
    agent: str = "spec"


def _page_key(path: str) -> str | None:
    """SITE_MAP key of a concrete path ('/app/tenders/123' -> '/app/tenders/{id}')."""
    clean = path.split("?")[0].rstrip("/") or "/"
    if re.fullmatch(r"/app/tenders/[^/]+", clean):
        return "/app/tenders/{id}"
    if clean.startswith("/onboarding"):
        return "/onboarding"
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
        for fact in page.get("help", []):
            lines.append(f"    . {fact}")
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
Other controls visible right now, each as auto-N: label (you may point at one with highlight_hook "auto-N" when the user is already on this page and no listed hook fits):
{auto}
{tender_line}
Respond with ONLY a JSON object:
{{"message": string, "navigate_to": string|null, "highlight_hook": string|null, \
"agent": one of {agents}}}

Rules:
- Answer how-the-app-works questions from the facts (lines starting with ".") under each page, even for a page the user is not on; do not invent details beyond them.
- When the user asks to go somewhere or to be shown something, set navigate_to to a \
page path from the list above (use /app/tenders/{{id}} only if a tender is open; add \
?tab=docs for the document preparation tab) and highlight_hook to ONE hook from that \
page's list, or null. If they are already on that page, set navigate_to to null.
- Only use hook names that appear in the lists above (page hooks or auto-N). Prefer a page hook; use auto-N for things not listed. Never invent a path or a hook.
- "message" says what you did or the answer, e.g. what the highlighted thing is for.
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
    auto_lines: list[str] = []
    live_auto: set[int] = set()
    for n in req.dom:
        a = n.get("auto")
        if isinstance(a, int) and 0 <= a < 400 and len(auto_lines) < 140:
            label = re.sub(r"\s+", " ", str(n.get("text") or ""))[:60]
            live_auto.add(a)
            auto_lines.append(f"auto-{a}: {n.get('role', 'control')} \"{label}\"")
    system = SYSTEM.format(
        site_map=_site_map_text(),
        here=f"{req.pathname} ({SITE_MAP[here_key]['title'] if here_key else 'unknown page'})",
        live=", ".join(live) or "none",
        auto=wrap_untrusted("\n".join(auto_lines) or "none"),
        tender_line=f"A tender is open: {req.tenderId}." if req.tenderId else "No tender is open.",
        agents=" | ".join(_AGENTS),
    )
    history = "\n".join(f"{m.get('role', 'user')}: {str(m.get('text', ''))[:300]}" for m in req.history[-8:])
    user_message = (f"Conversation so far (data):\n{wrap_untrusted(history)}\n\n" if history else "") + f"User: {question}"

    ai = ai or MetaAIClient()
    plan: _Plan | None = None
    for _ in range(2):
        try:
            raw = await ai._chat(system, user_message, json_mode=True, purpose="assistant", wrap=False)  # noqa: SLF001
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
    auto_selector: str | None = None
    m = re.fullmatch(r"auto-(\d{1,3})", plan.highlight_hook or "")
    if m and not destination and int(m.group(1)) in live_auto:
        auto_selector = f'[data-assistant-auto="{int(m.group(1))}"]'
    # On the current page the live DOM is the truth: a hook that is not rendered cannot be pointed at.
    if hook and not destination and hook not in live and not hook.startswith("nav-"):
        hook = None
    if destination and _page_key(destination) == here_key and destination.split("?")[0] == req.pathname.split("?")[0] and "tab=docs" not in destination:
        destination = None
    return AssistantResponse(
        message=clean_text(plan.message, 600),
        navigate_to=destination,
        highlight_selector=auto_selector or (f'[data-assistant="{hook}"]' if hook else None),
        agent=plan.agent if plan.agent in _AGENTS else "spec",
    )
