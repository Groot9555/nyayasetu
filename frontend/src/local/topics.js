// Generated from backend/app/services/rights_service.py TOPICS. Keep in sync.
export const TOPICS = [
  {
    "id": "consumer",
    "title": "Consumer complaints",
    "summary": "Defective goods, deficient services, unfair trade practices, refunds.",
    "description": "Problems with products or services you paid for, such as defects, poor service, misleading advertisements, or refusal of refund/replacement.",
    "doc_ids": [
      "consumer_protection_act_2019"
    ],
    "query_seed": "consumer complaint defect deficiency in service unfair trade practice",
    "clarifying_questions": [
      "What did you buy or which service did you use, and when?",
      "What exactly went wrong (defect, delay, overcharging, misleading claim)?",
      "Have you already contacted the seller/service provider in writing?",
      "Approximately how much did you pay?"
    ],
    "next_steps": [
      "Keep copies of the bill/invoice, warranty, advertisements, and all communication.",
      "Write to the seller or service provider describing the problem and the remedy you want, and keep proof of sending.",
      "You can seek help from the National Consumer Helpline before filing a formal complaint.",
      "If unresolved, consider filing a complaint with the appropriate Consumer Commission (e-Daakhil allows online filing)."
    ],
    "official_resources": [
      {
        "name": "National Consumer Helpline",
        "url": "https://consumerhelpline.gov.in",
        "note": "Helpline 1915"
      },
      {
        "name": "e-Daakhil (online consumer complaint filing)",
        "url": "https://edaakhil.nic.in"
      }
    ]
  },
  {
    "id": "cybercrime",
    "title": "Cybercrime reporting",
    "summary": "Online fraud, identity theft, hacking, harassment, and data misuse.",
    "description": "Issues such as online financial fraud, hacked accounts, impersonation, identity theft, or publication of private content without consent.",
    "doc_ids": [
      "it_act_2000",
      "bns_2023"
    ],
    "query_seed": "computer related offence identity theft cheating by personation using computer resource",
    "clarifying_questions": [
      "What happened, and on which platform or service?",
      "Did you lose money? If yes, when and through which payment method?",
      "Do you have screenshots, transaction IDs, URLs, or phone numbers involved?"
    ],
    "next_steps": [
      "For financial fraud, report as quickly as possible on the national cybercrime helpline 1930 and inform your bank.",
      "File a report on the National Cyber Crime Reporting Portal.",
      "Preserve evidence: screenshots, URLs, transaction references, emails, and messages. Do not delete them.",
      "Change passwords and enable two-factor authentication on affected accounts."
    ],
    "official_resources": [
      {
        "name": "National Cyber Crime Reporting Portal",
        "url": "https://cybercrime.gov.in",
        "note": "Helpline 1930"
      }
    ]
  },
  {
    "id": "traffic",
    "title": "Traffic-related issues",
    "summary": "Challans, licences, vehicle registration, insurance, and accidents.",
    "description": "Questions about traffic fines (challans), driving licences, vehicle documents, insurance, or road accidents.",
    "doc_ids": [
      "motor_vehicles_act_1988"
    ],
    "query_seed": "driving licence penalty offence motor vehicle insurance accident",
    "clarifying_questions": [
      "Is this about a challan, a licence/registration, insurance, or an accident?",
      "In which state did it happen?",
      "Do you have the challan number or related documents?"
    ],
    "next_steps": [
      "Check challan details and payment options on the official e-Challan portal.",
      "Keep copies of your licence, registration certificate, insurance, and PUC certificate.",
      "Penalties and procedures can vary by state notifications; confirm with the state transport department."
    ],
    "official_resources": [
      {
        "name": "e-Challan (Parivahan)",
        "url": "https://echallan.parivahan.gov.in"
      },
      {
        "name": "Parivahan Sewa",
        "url": "https://parivahan.gov.in"
      }
    ]
  },
  {
    "id": "criminal",
    "title": "Basic criminal-law information",
    "summary": "Offences, FIRs, and general criminal-law concepts.",
    "description": "General information about offences and criminal-law concepts. This is not a substitute for a lawyer; in an emergency contact the police (112).",
    "doc_ids": [
      "bns_2023"
    ],
    "query_seed": "offence punishment whoever commits",
    "clarifying_questions": [
      "What happened, in general terms?",
      "When and where did it happen?",
      "Is anyone in immediate danger? (If so, call 112.)"
    ],
    "next_steps": [
      "In an emergency, call 112.",
      "You can approach the nearest police station to report an offence.",
      "Free legal aid may be available through Legal Services Authorities (NALSA / State / District)."
    ],
    "official_resources": [
      {
        "name": "National Legal Services Authority (NALSA)",
        "url": "https://nalsa.gov.in"
      }
    ]
  },
  {
    "id": "civil",
    "title": "General civil disputes",
    "summary": "Property, money recovery, contracts, and neighbour disputes.",
    "description": "Disputes between private parties such as unpaid money, contracts, or property. NyayaSetu's indexed sources for this area are currently limited.",
    "doc_ids": [],
    "query_seed": "civil dispute",
    "clarifying_questions": [
      "What is the dispute about (money, property, contract, other)?",
      "Who are the parties involved?",
      "Do you have written agreements, receipts, or notices?"
    ],
    "next_steps": [
      "Collect all documents: agreements, receipts, notices, and correspondence.",
      "Consider mediation or Lok Adalat, which Legal Services Authorities can help with.",
      "Consult a lawyer or your District Legal Services Authority for free legal aid eligibility."
    ],
    "official_resources": [
      {
        "name": "National Legal Services Authority (NALSA)",
        "url": "https://nalsa.gov.in"
      },
      {
        "name": "eCourts Services",
        "url": "https://ecourts.gov.in"
      }
    ]
  }
];
