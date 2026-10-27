from typing import Literal, Optional

from pydantic import BaseModel, Field

from .common import SourceReference

DRAFT_LABEL = "AI-generated draft — review all details and verify the appropriate authority before submission."

DocumentType = Literal["complaint", "application", "grievance_letter"]


class ComplaintRequest(BaseModel):
    document_type: DocumentType = "complaint"
    applicant_name: Optional[str] = Field(default=None, max_length=120)
    applicant_contact: Optional[str] = Field(default=None, max_length=300)
    recipient: Optional[str] = Field(default=None, max_length=200)
    issue_category: Optional[str] = Field(default=None, max_length=100)
    incident_date: Optional[str] = Field(default=None, max_length=40)
    incident_description: str = Field(default="", max_length=5000)
    requested_action: Optional[str] = Field(default=None, max_length=1500)
    optional_details: Optional[str] = Field(default=None, max_length=2000)


class ComplaintResponse(BaseModel):
    draft: str
    placeholders: list[str]
    sources: list[SourceReference]
    label: str = DRAFT_LABEL
    disclaimer: str = (
        "This draft is a starting template. It is not legal advice and has not been submitted anywhere. "
        "Check every fact, fill all placeholders, and confirm the correct authority before use."
    )


class PdfRequest(BaseModel):
    draft: str = Field(..., min_length=1, max_length=20000)
    title: Optional[str] = Field(default=None, max_length=120)
    filename: Optional[str] = Field(default=None, max_length=80)
