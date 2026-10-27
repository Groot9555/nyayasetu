// Browser-only port of the NyayaSetu backend (used for static hosting, e.g. Netlify).
// Mirrors backend/app/services/*: same retrieval thresholds, extractive answers, curated topics and templates.
import { TOPICS } from './topics.js';

const TOP_K = 5;
const STRONG_DISTANCE = 0.4;
const MAX_DISTANCE = 0.7;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

export const DISCLAIMER =
  'General legal information, not legal advice. NyayaSetu can be wrong or incomplete. ' +
  'Verify with the official source and consult a qualified lawyer or the appropriate authority.';
const DRAFT_LABEL =
  'AI-generated draft — review all details and verify the appropriate authority before submission.';
const NO_EVIDENCE_MESSAGE =
  "I could not verify an answer to this from NyayaSetu's indexed legal sources, so I won't guess. " +
  'The question may be outside the acts currently indexed, or may need more detail. ' +
  'Try rephrasing with specific terms (for example the act or issue involved), check the official ' +
  'India Code portal (https://www.indiacode.nic.in), or consult a lawyer or your District Legal Services Authority.';

const GENERIC_WORDS = new Set(`
a an the and or of to in on for by with without from at as is are was were be been being am do does did done
what which who whom whose when where why how can could should would will shall may might must not no yes
i me my mine we our you your he she it its they them their this that these those there here any some all
about under into over than then also just only very more most such other another
law laws legal act acts section sections rule rules india indian court case cases right rights
punishment punish punishable penalty penalties offence offences offense fine fines provision provisions
mean means meaning define definition explain tell know need want get happen happens happened someone person
`.split(/\s+/).filter(Boolean));

export class ValidationError extends Error {}

let indexPromise;
let extractorPromise;

function loadIndex() {
  if (!indexPromise) {
    const base = import.meta.env.BASE_URL;
    indexPromise = Promise.all([
      fetch(`${base}index/chunks.json`).then((r) => r.json()),
      fetch(`${base}index/embeddings.bin`).then((r) => r.arrayBuffer()),
    ]).then(([meta, buf]) => ({ dim: meta.dim, chunks: meta.chunks, vectors: new Float32Array(buf) }));
    indexPromise.catch(() => { indexPromise = undefined; });
  }
  return indexPromise;
}

// One-time downloads (bytes), used for the progress indicator.
const WASM_FILE = 'ort-wasm-simd-threaded.jsep.wasm';
const EXPECTED_BYTES = { wasm: 21596019, model: 22972370 };
const EXPECTED_TOTAL = EXPECTED_BYTES.wasm + EXPECTED_BYTES.model;
const status = { phase: 'idle', loaded: 0, total: EXPECTED_TOTAL };
const listeners = new Set();
const fileLoaded = {};

function emit(patch) {
  Object.assign(status, patch);
  listeners.forEach((fn) => fn({ ...status }));
}

function track(name, loaded) {
  fileLoaded[name] = Math.min(loaded, EXPECTED_BYTES[name]);
  emit({ phase: 'loading', loaded: Object.values(fileLoaded).reduce((a, b) => a + b, 0) });
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ ...status });
  return () => listeners.delete(fn);
}

async function fetchWithProgress(url, name) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (!res.body) return res.arrayBuffer();
  const reader = res.body.getReader();
  const parts = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    loaded += value.length;
    track(name, loaded);
  }
  const out = new Uint8Array(loaded);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Model and ONNX runtime are self-hosted (see scripts/static-assets.mjs) so no third-party CDN is needed.
function loadExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      if (typeof WebAssembly !== 'object') throw new Error('WebAssembly is not supported by this browser.');
      const base = import.meta.env.BASE_URL;
      emit({ phase: 'loading' });
      const [{ pipeline, env }, wasmBinary] = await Promise.all([
        import('@huggingface/transformers'),
        fetchWithProgress(`${base}ort/${WASM_FILE}`, 'wasm'),
      ]);
      env.allowRemoteModels = false;
      env.allowLocalModels = true;
      env.localModelPath = `${base}models/`;
      env.backends.onnx.wasm.wasmPaths = `${base}ort/`;
      env.backends.onnx.wasm.wasmBinary = wasmBinary;
      const extractor = await pipeline('feature-extraction', MODEL_ID, {
        dtype: 'q8',
        device: 'wasm',
        progress_callback: (p) => {
          if (p.status === 'progress' && p.file?.endsWith('.onnx')) track('model', p.loaded);
        },
      });
      emit({ phase: 'ready', loaded: EXPECTED_TOTAL });
      return extractor;
    })();
    extractorPromise.catch((err) => {
      console.error('NyayaSetu engine failed to load:', err);
      extractorPromise = undefined;
      emit({ phase: 'error' });
    });
  }
  return extractorPromise;
}

export function warmup() {
  loadIndex().catch(() => {});
  loadExtractor().catch(() => {});
}

async function embed(text) {
  const extractor = await loadExtractor();
  const out = await extractor(text, { pooling: 'mean', normalize: true });
  return out.data;
}

function queryKeywords(query) {
  return new Set((query.toLowerCase().match(/[a-z][a-z-]{2,}/g) || []).filter((w) => !GENERIC_WORDS.has(w)));
}

function sharesKeyword(keywords, text) {
  const low = text.toLowerCase();
  for (const kw of keywords) if (low.includes(kw.slice(0, 5))) return true;
  return false;
}

function toSource(p, excerptChars = 600) {
  const md = p.meta;
  const excerpt = p.text.length <= excerptChars ? p.text : `${p.text.slice(0, excerptChars).trimEnd()} …`;
  return {
    doc_id: md.doc_id || '',
    title: md.title || '',
    act_name: md.act_name || '',
    section: md.section || null,
    section_title: md.section_title || null,
    url: md.url || null,
    excerpt,
    relevance: Math.round((1 - p.distance) * 1000) / 1000,
  };
}

function describePassage(p) {
  const md = p.meta;
  let ref = md.section ? `Section ${md.section}` : 'Unnumbered passage';
  if (md.section_title) ref += ` (${md.section_title})`;
  return `${md.act_name || 'Unknown act'}, ${ref}`;
}

async function search(query, { k = TOP_K, docIds = null, applyThreshold = true } = {}) {
  const [index, q] = await Promise.all([loadIndex(), embed(query)]);
  const { dim, chunks, vectors } = index;
  const scored = [];
  for (let i = 0; i < chunks.length; i++) {
    if (docIds && docIds.length && !docIds.includes(chunks[i].meta.doc_id)) continue;
    let dot = 0;
    const off = i * dim;
    for (let j = 0; j < dim; j++) dot += vectors[off + j] * q[j];
    scored.push({ ...chunks[i], distance: 1 - dot });
  }
  scored.sort((a, b) => a.distance - b.distance);
  let passages = scored.slice(0, k);
  if (applyThreshold) {
    const keywords = queryKeywords(query);
    passages = passages.filter(
      (p) =>
        p.distance <= STRONG_DISTANCE ||
        (p.distance <= MAX_DISTANCE && keywords.size > 0 &&
          sharesKeyword(keywords, `${p.meta.section_title || ''} ${p.text}`)),
    );
  }
  const seen = new Set();
  return passages.filter((p) => {
    const key = `${p.meta.doc_id}|${p.meta.section || p.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function listDocuments() {
  const { chunks } = await loadIndex();
  const docs = new Map();
  for (const { meta } of chunks) {
    if (!docs.has(meta.doc_id)) {
      const d = { chunks: 0 };
      for (const key of ['doc_id', 'title', 'act_name', 'short_name', 'jurisdiction', 'legal_status', 'url', 'date_checked', 'version'])
        d[key] = meta[key] ?? null;
      docs.set(meta.doc_id, d);
    }
    docs.get(meta.doc_id).chunks += 1;
  }
  return [...docs.values()].sort((a, b) => (a.title || '').localeCompare(b.title || ''));
}

async function getSection(section, docId) {
  const { chunks } = await loadIndex();
  return chunks
    .filter((c) => c.meta.section === section && (!docId || c.meta.doc_id === docId))
    .map((c) => ({ ...c, distance: 0 }))
    .sort((a, b) => a.meta.doc_id.localeCompare(b.meta.doc_id) || (a.meta.chunk_index || 0) - (b.meta.chunk_index || 0));
}

function parseSectionQuery(term) {
  const m = term.match(/^\s*(?:section|sec\.?|s\.)?\s*(\d{1,3}[A-Za-z]{0,3})(?:\s*\([^)]*\))*\s*$/i);
  return m ? m[1].toUpperCase() : null;
}

export async function health() {
  const [{ chunks }, docs] = await Promise.all([loadIndex(), listDocuments()]);
  return { status: 'ok', api_version: '0.1.0-static', llm_mode: 'extractive', indexed_chunks: chunks.length, indexed_documents: docs.length };
}

export async function ask(question) {
  question = (question || '').trim();
  if (question.length < 3) throw new ValidationError('Question must contain at least 3 non-space characters.');
  if (question.length > 2000) throw new ValidationError('Question is too long (max 2000 characters).');
  const passages = await search(question);
  if (!passages.length) return { answer: NO_EVIDENCE_MESSAGE, sources: [], mode: 'insufficient_evidence', disclaimer: DISCLAIMER };
  const lines = [
    'Explanation:',
    'AI summarisation is not enabled in this version, so NyayaSetu is showing the most relevant ' +
      'passages it found in its indexed legal sources instead of a written explanation. ' +
      'Read the provisions below and open the official source for the full text.',
    '',
    'Potentially relevant provisions:',
    ...passages.map((p, i) => `- [${i + 1}] ${describePassage(p)}`),
    '',
    'Please verify:',
    'Whether a provision applies depends on the facts of your situation. Check the official text, ' +
      'and consult a lawyer or legal services authority before acting.',
  ];
  return { answer: lines.join('\n'), sources: passages.map((p) => toSource(p)), mode: 'extractive', disclaimer: DISCLAIMER };
}

export async function decode(term, act) {
  term = (term || '').trim();
  if (!term) throw new ValidationError('Term must not be blank.');
  const base = { term, conditions: [], disclaimer: DISCLAIMER };
  const section = parseSectionQuery(term);
  let passages = [];
  let status = 'not_found';
  if (section) {
    passages = await getSection(section, act);
    if (!passages.length) {
      return { ...base, original_text: null, sources: [], verification_status: 'not_found', mode: 'insufficient_evidence',
        explanation: `Section ${section} could not be verified in ${act ? 'the selected act' : 'any indexed act'}. ` +
          'NyayaSetu will not guess its contents. Check the section number and act, or consult India Code (https://www.indiacode.nic.in).' };
    }
    const docs = new Set(passages.map((p) => p.meta.doc_id));
    if (docs.size > 1 && !act) {
      const names = [...new Set(passages.map((p) => p.meta.act_name))].sort();
      return { ...base, original_text: null, verification_status: 'related_passages', mode: 'insufficient_evidence',
        explanation: `Section ${section} exists in more than one indexed act (${names.join('; ')}). Please choose the act to see the correct provision.`,
        sources: passages.filter((p) => (p.meta.chunk_index || 0) === 0).map((p) => toSource(p, 300)) };
    }
    status = 'verified_section';
  } else {
    const semantic = await search(`meaning and definition of ${term}`, { k: 5, docIds: act ? [act] : null });
    const low = term.toLowerCase();
    const literal = semantic.filter((p) => p.text.toLowerCase().includes(low));
    passages = literal.length ? literal : semantic;
    if (passages.length) status = 'related_passages';
  }
  if (!passages.length) {
    return { ...base, original_text: null, sources: [], verification_status: 'not_found', mode: 'insufficient_evidence',
      explanation: `NyayaSetu could not find "${term}" in its indexed legal sources, so it cannot give a verified explanation. ` +
        'Try a different spelling, a section number, or another act.' };
  }
  const refs = passages.slice(0, 3).map(describePassage).join('; ');
  const verified = status === 'verified_section';
  return {
    ...base,
    original_text: verified ? passages.slice(0, 3).map((p) => p.text).join('\n') : null,
    explanation: verified
      ? `Plain-language summarisation is not enabled in this version. The provision text shown here was retrieved from: ${refs}. Read it carefully and open the official source.`
      : `No exact section match. These indexed passages mention or relate to "${term}": ${refs}.`,
    sources: passages.map((p) => toSource(p)),
    verification_status: status,
    mode: 'extractive',
  };
}

async function topicModel(t) {
  const indexed = new Set((await listDocuments()).map((d) => d.doc_id));
  const { doc_ids, query_seed, next_steps, ...rest } = t; // eslint-disable-line no-unused-vars
  return { topic: { ...rest, support_level: doc_ids.some((d) => indexed.has(d)) ? 'indexed' : 'limited' }, indexed };
}

export async function rightsTopics() {
  return Promise.all(TOPICS.map(async (t) => (await topicModel(t)).topic));
}

export async function navigateRights(topicId, description) {
  const t = TOPICS.find((x) => x.id === topicId);
  if (!t) throw new ValidationError('Unknown topic.');
  const { topic, indexed } = await topicModel(t);
  const docIds = t.doc_ids.filter((d) => indexed.has(d));
  description = (description || '').trim();
  const common = { topic, next_steps: t.next_steps, disclaimer: DISCLAIMER,
    next_steps_basis: 'General practical steps curated by NyayaSetu (not legal advice, not derived from the AI).' };
  if (description.length < 25) {
    const passages = docIds.length ? await search(t.query_seed, { k: 3, docIds }) : [];
    const intro = 'Your description is too short to find specific information. Please answer the clarifying questions above in your description.';
    return { ...common, status: 'needs_more_detail', sources: passages.map((p) => toSource(p)),
      explanation: passages.length ? `${intro.slice(0, -1)}. Meanwhile, here is general information from the indexed sources for this topic.` : intro,
      uncertainty: 'Without more details NyayaSetu cannot tell which provisions, if any, may be relevant.' };
  }
  const passages = await search(`${description} ${t.query_seed}`, { docIds: docIds.length ? docIds : null });
  if (!passages.length) {
    return { ...common, status: 'insufficient_evidence', sources: [],
      explanation: 'NyayaSetu could not find indexed legal passages that clearly relate to this description, so it will not guess which law applies. The official resources and general steps below may still help.',
      uncertainty: 'No sufficiently relevant passage was found in the indexed sources.' };
  }
  const refs = passages.slice(0, 4).map(describePassage).join('; ');
  return { ...common, status: 'ok', sources: passages.map((p) => toSource(p)),
    explanation: `AI summarisation is not enabled, so here are the indexed provisions that appear most related to your description: ${refs}. Review them below; they may or may not apply.`,
    uncertainty: 'Relevance was determined by text similarity only. Whether any provision applies depends on the full facts.' };
}

const TYPE_LABELS = { complaint: 'Complaint', application: 'Application', grievance_letter: 'Grievance Letter' };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export async function generateComplaint(req) {
  const missing = [];
  const val = (v, placeholder) => {
    v = (v || '').trim();
    if (v) return v;
    missing.push(placeholder);
    return placeholder;
  };
  const label = TYPE_LABELS[req.document_type] || TYPE_LABELS.complaint;
  const name = val(req.applicant_name, '[APPLICANT FULL NAME]');
  const contact = val(req.applicant_contact, '[APPLICANT ADDRESS / PHONE / EMAIL]');
  const recipient = val(req.recipient, '[NAME / DESIGNATION OF THE AUTHORITY]');
  const category = val(req.issue_category, '[ISSUE CATEGORY]');
  const incidentDate = val(req.incident_date, '[DATE OF INCIDENT]');
  const description = val(req.incident_description, '[DESCRIBE WHAT HAPPENED, IN ORDER, WITH DATES]');
  const action = val(req.requested_action, '[STATE THE ACTION OR REMEDY YOU ARE REQUESTING]');
  const d = new Date();
  const today = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const lines = ['To,', recipient, '[ADDRESS OF THE AUTHORITY]', '', `Date: ${today}`, '', `Subject: ${label} regarding ${category}`, '',
    'Respected Sir/Madam,', '', `I, ${name}, respectfully submit this ${label.toLowerCase()} for your kind consideration.`, '',
    'Facts as stated by the applicant:', `Date of incident: ${incidentDate}`, description];
  if ((req.optional_details || '').trim()) lines.push('', 'Additional details provided by the applicant:', req.optional_details.trim());
  lines.push('', 'Request:', action, '',
    'I state that the facts mentioned above are true to the best of my knowledge. Copies of relevant documents are enclosed.', '',
    'Enclosures:', '1. [LIST SUPPORTING DOCUMENTS, e.g. receipts, screenshots, correspondence]', '',
    'Yours faithfully,', '', name, contact, '[SIGNATURE]');
  missing.push('[ADDRESS OF THE AUTHORITY]', '[LIST SUPPORTING DOCUMENTS, e.g. receipts, screenshots, correspondence]', '[SIGNATURE]');
  let sources = [];
  if ((req.incident_description || '').trim()) {
    const query = `${req.issue_category || ''} ${req.incident_description}`.slice(0, 1500);
    sources = (await search(query, { k: 3 })).map((p) => toSource(p, 400));
  }
  return {
    draft: lines.join('\n'), placeholders: [...new Set(missing)], sources, label: DRAFT_LABEL,
    disclaimer: 'This draft is a starting template. It is not legal advice and has not been submitted anywhere. ' +
      'Check every fact, fill all placeholders, and confirm the correct authority before use.',
  };
}

const LATIN1_MAP = { '\u2014': '-', '\u2013': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u20b9': 'Rs. ' };
// eslint-disable-next-line no-control-regex
const toLatin1 = (s) => s.replace(/[\u2014\u2013\u2018\u2019\u201c\u201d\u2026\u20b9]/g, (c) => LATIN1_MAP[c]).replace(/[^\x09\x0a\x0d\x20-\x7e\xa0-\xff]/g, '?');

export async function complaintPdf(draft, title) {
  if (!(draft || '').trim()) throw new ValidationError('Draft is empty.');
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: toLatin1(title || 'Draft'), author: 'NyayaSetu (AI-generated draft)' });
  const left = 20, width = 170, bottom = 279;
  let y = 18;
  const write = (text, size, color = [0, 0, 0], bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lh = size * 0.3528 * 1.35;
    for (const line of doc.splitTextToSize(text, width)) {
      if (y + lh > bottom) { doc.addPage(); y = 18; }
      y += lh;
      doc.text(line, left, y);
    }
  };
  write(toLatin1(DRAFT_LABEL), 8.5, [122, 75, 0]);
  y += 6;
  if (title) { write(toLatin1(title), 11, [0, 0, 0], true); y += 4; }
  // eslint-disable-next-line no-control-regex
  for (const line of draft.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').split('\n')) {
    if (line.trim()) write(toLatin1(line), 11);
    else y += 4;
  }
  return doc.output('blob');
}

export async function searchSources(q, act) {
  const passages = await search(q.trim(), { k: 8, docIds: act ? [act] : null });
  return { query: q, results: passages.map((p) => toSource(p, 400)) };
}

export async function listSources() {
  return { documents: await listDocuments() };
}
