"""Text cleaning and section-aware chunking for Indian statute PDFs."""

import re
from collections import Counter
from dataclasses import dataclass

# e.g. "66C. Punishment for identity theft.—Whoever ..."  (em/en dash or hyphen after heading)
SECTION_RE = re.compile(
    r"(?m)^\s*(?:\d{1,2}\[)?(?P<num>\d{1,3}[A-Z]{0,3})\.\s+(?P<title>(?:\d{1,2}\[)?[A-Z][^\n]{2,200}?)\.?\s*[—–-]{1,2}\s*"
)
PAGE_NUM_RE = re.compile(r"^\s*\d{1,4}\s*$")
# India Code amendment footnotes, e.g. "3. Ins. by Act 10 of 2009, s. 4, ibid."
FOOTNOTE_RE = re.compile(
    r"^\d{1,3}\.\s*(Ins\.|Subs\.|Omitted|Omit|Rep\.|The words|Added|Inserted|Substituted|Renumbered|Vide|"
    r"Clause|Cl\.|Clauses|Sub-section|Words|Proviso|Certain words|Now see|See |Section|Sections|S\.|Ss\.|Explanation|"
    r"Letters|Figures|Brackets|Item|Entry|Entries|Amended|Re-numbered|Lettered|Chapter|Schedule)"
    r"|by Act \d+ of \d{4}|\bibid\b|\bw\.e\.f\b"
)


@dataclass
class Section:
    number: str | None
    title: str | None
    text: str


@dataclass
class Chunk:
    section: str | None
    section_title: str | None
    text: str
    index: int


def clean_pages(pages: list[str]) -> str:
    """Drop page numbers and lines repeated on many pages (running headers/footers)."""
    line_counts: Counter[str] = Counter()
    for page in pages:
        for line in {ln.strip() for ln in page.splitlines() if ln.strip()}:
            line_counts[line] += 1
    threshold = max(3, int(len(pages) * 0.3))
    repeated = {ln for ln, c in line_counts.items() if c >= threshold and len(ln) < 120}

    cleaned = []
    for page in pages:
        keep = []
        for ln in page.splitlines():
            s = ln.strip()
            if not s or PAGE_NUM_RE.match(s) or s in repeated or (re.match(r"^\d{1,3}\.", s) and FOOTNOTE_RE.search(s)):
                continue
            keep.append(s)
        cleaned.append("\n".join(keep))
    text = "\n".join(cleaned)
    text = re.sub(r"[ \t]+", " ", text)
    return text


def _section_sort_key(num: str) -> tuple[int, str]:
    m = re.match(r"(\d+)([A-Z]*)", num)
    return (int(m.group(1)), m.group(2)) if m else (0, "")


def split_sections(text: str) -> list[Section]:
    """Split statute text at section headings, keeping only a monotonically increasing sequence
    so that cross-references and the arrangement-of-sections table don't create false sections."""
    matches = list(SECTION_RE.finditer(text))
    accepted = []
    last_key = (0, "")
    for m in matches:
        key = _section_sort_key(m.group("num"))
        if key > last_key and key[0] - last_key[0] <= 25:
            accepted.append(m)
            last_key = key

    if not accepted:
        return [Section(number=None, title=None, text=text.strip())] if text.strip() else []

    sections: list[Section] = []
    preamble = text[: accepted[0].start()].strip()
    if preamble:
        sections.append(Section(number=None, title="Preliminary text", text=preamble))
    for i, m in enumerate(accepted):
        end = accepted[i + 1].start() if i + 1 < len(accepted) else len(text)
        body = text[m.start() : end].strip()
        title = re.sub(r"\d{1,2}\[|\]", "", m.group("title"))
        title = re.sub(r"\s+", " ", title).strip().rstrip(".")
        sections.append(Section(number=m.group("num"), title=title, text=body))
    return sections


def chunk_text(text: str, max_chars: int = 1200, overlap: int = 200) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text] if text else []
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars)
        if end < len(text):
            # prefer breaking on a sentence / clause boundary
            window = text[start:end]
            cut = max(window.rfind("\n"), window.rfind("; "), window.rfind(". "))
            if cut > max_chars * 0.5:
                end = start + cut + 1
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - overlap, start + 1)
    return [c for c in chunks if c]


def chunk_sections(sections: list[Section], max_chars: int = 1200, overlap: int = 200) -> list[Chunk]:
    out: list[Chunk] = []
    for sec in sections:
        for i, piece in enumerate(chunk_text(sec.text, max_chars, overlap)):
            prefix = ""
            if i > 0 and sec.number:
                prefix = f"[Section {sec.number} — {sec.title}, continued]\n"
            out.append(Chunk(section=sec.number, section_title=sec.title, text=prefix + piece, index=i))
    return out


def parse_section_query(term: str) -> str | None:
    """Return a section number if the term looks like a section reference, e.g. 'Section 66C', 's. 2', '35'."""
    m = re.match(r"^\s*(?:section|sec\.?|s\.)?\s*(\d{1,3}[A-Za-z]{0,3})(?:\s*\([^)]*\))*\s*$", term, re.I)
    return m.group(1).upper() if m else None
