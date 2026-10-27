from app.services.pdf_service import safe_filename
from app.services.text_processing import chunk_text, clean_pages, parse_section_query, split_sections

SAMPLE = """THE SAMPLE ACT
ARRANGEMENT OF SECTIONS
1. Short title.
2. Definitions.
1. Short title.—This Act may be called the Sample Act.
2. Definitions.—In this Act, unless the context otherwise requires,—
(a) "thing" means a thing.
1. Ins. by Act 10 of 2009, s. 4 (w.e.f. 27-10-2009).
3. 4[Penalty for things].—Whoever does a thing shall be liable.
"""


def test_split_sections_skips_toc_and_footnotes():
    secs = split_sections(clean_pages([SAMPLE]))
    numbered = [(s.number, s.title) for s in secs if s.number]
    assert numbered == [("1", "Short title"), ("2", "Definitions"), ("3", "Penalty for things")]
    assert "Ins. by Act" not in secs[-2].text


def test_chunk_overlap():
    text = ("word " * 600).strip()
    chunks = chunk_text(text, max_chars=1000, overlap=200)
    assert len(chunks) >= 3 and all(len(c) <= 1000 for c in chunks)


def test_parse_section_query():
    assert parse_section_query("Section 66C") == "66C"
    assert parse_section_query("s. 2(1)(k)") == "2"
    assert parse_section_query("129") == "129"
    assert parse_section_query("electronic record") is None


def test_safe_filename():
    assert safe_filename("../../etc/passwd") == "etc-passwd.pdf"
    assert safe_filename(None) == "nyayasetu-draft.pdf"
