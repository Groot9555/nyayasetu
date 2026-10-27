import io
import re
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from ..schemas.complaint import DRAFT_LABEL

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def safe_filename(name: str | None, default: str = "nyayasetu-draft") -> str:
    base = (name or default).rsplit(".pdf", 1)[0]
    base = re.sub(r"[^A-Za-z0-9_-]+", "-", base).strip("-_")[:60]
    return f"{base or default}.pdf"


def _to_latin1(text: str) -> str:
    # Built-in PDF fonts only cover Latin-1; replace common typographic chars, drop the rest safely.
    table = {"\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2026": "...", "\u20b9": "Rs. "}
    for k, v in table.items():
        text = text.replace(k, v)
    return text.encode("latin-1", "replace").decode("latin-1")


def render_pdf(draft: str, title: str | None = None) -> bytes:
    draft = _CONTROL_CHARS.sub("", draft)
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
                            topMargin=18 * mm, bottomMargin=18 * mm, title=_to_latin1(title or "Draft"),
                            author="NyayaSetu (AI-generated draft)")
    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica", fontSize=11, leading=15)
    label = ParagraphStyle("label", parent=body, fontSize=8.5, textColor="#7a4b00", leading=11)

    story = [Paragraph(escape(_to_latin1(DRAFT_LABEL)), label), Spacer(1, 6 * mm)]
    if title:
        story += [Paragraph(f"<b>{escape(_to_latin1(title))}</b>", body), Spacer(1, 4 * mm)]
    for line in draft.splitlines():
        if line.strip():
            story.append(Paragraph(escape(_to_latin1(line)), body))
        else:
            story.append(Spacer(1, 4 * mm))
    doc.build(story)
    return buf.getvalue()
