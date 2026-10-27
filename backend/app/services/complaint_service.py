"""Deterministic complaint/application drafting. User facts are inserted verbatim; nothing is invented."""

from datetime import date

from ..schemas.complaint import ComplaintRequest, ComplaintResponse
from .retrieval_service import RetrievalService

TYPE_LABELS = {
    "complaint": "Complaint",
    "application": "Application",
    "grievance_letter": "Grievance Letter",
}


def _val(value: str | None, placeholder: str, missing: list[str]) -> str:
    value = (value or "").strip()
    if value:
        return value
    missing.append(placeholder)
    return placeholder


class ComplaintService:
    def __init__(self, retrieval: RetrievalService | None):
        self.retrieval = retrieval

    def generate(self, req: ComplaintRequest) -> ComplaintResponse:
        missing: list[str] = []
        label = TYPE_LABELS[req.document_type]
        name = _val(req.applicant_name, "[APPLICANT FULL NAME]", missing)
        contact = _val(req.applicant_contact, "[APPLICANT ADDRESS / PHONE / EMAIL]", missing)
        recipient = _val(req.recipient, "[NAME / DESIGNATION OF THE AUTHORITY]", missing)
        category = _val(req.issue_category, "[ISSUE CATEGORY]", missing)
        incident_date = _val(req.incident_date, "[DATE OF INCIDENT]", missing)
        description = _val(req.incident_description, "[DESCRIBE WHAT HAPPENED, IN ORDER, WITH DATES]", missing)
        action = _val(req.requested_action, "[STATE THE ACTION OR REMEDY YOU ARE REQUESTING]", missing)

        lines = [
            "To,",
            recipient,
            "[ADDRESS OF THE AUTHORITY]",
            "",
            f"Date: {date.today().strftime('%d %B %Y')}",
            "",
            f"Subject: {label} regarding {category}",
            "",
            "Respected Sir/Madam,",
            "",
            f"I, {name}, respectfully submit this {label.lower()} for your kind consideration.",
            "",
            "Facts as stated by the applicant:",
            f"Date of incident: {incident_date}",
            description,
        ]
        if req.optional_details and req.optional_details.strip():
            lines += ["", "Additional details provided by the applicant:", req.optional_details.strip()]
        lines += [
            "",
            "Request:",
            action,
            "",
            "I state that the facts mentioned above are true to the best of my knowledge. Copies of relevant "
            "documents are enclosed.",
            "",
            "Enclosures:",
            "1. [LIST SUPPORTING DOCUMENTS, e.g. receipts, screenshots, correspondence]",
            "",
            "Yours faithfully,",
            "",
            name,
            contact,
            "[SIGNATURE]",
        ]
        missing += ["[ADDRESS OF THE AUTHORITY]", "[LIST SUPPORTING DOCUMENTS, e.g. receipts, screenshots, correspondence]",
                    "[SIGNATURE]"]

        sources = []
        if self.retrieval and req.incident_description.strip():
            query = f"{req.issue_category or ''} {req.incident_description}"[:1500]
            sources = [p.to_source(400) for p in self.retrieval.search(query, k=3)]

        return ComplaintResponse(draft="\n".join(lines), placeholders=list(dict.fromkeys(missing)), sources=sources)
