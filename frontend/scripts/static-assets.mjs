// Self-hosts the ONNX runtime and embedding model for the static build (avoids huggingface.co / jsDelivr at runtime).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const ORT_DIR = 'node_modules/@huggingface/transformers/dist';
mkdirSync('public/ort', { recursive: true });
for (const f of ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']) copyFileSync(`${ORT_DIR}/${f}`, `public/ort/${f}`);

const MODEL = 'Xenova/all-MiniLM-L6-v2';
const FILES = ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx'];
for (const f of FILES) {
  const out = `public/models/${MODEL}/${f}`;
  if (existsSync(out)) continue;
  const res = await fetch(`https://huggingface.co/${MODEL}/resolve/main/${f}`);
  if (!res.ok) throw new Error(`Failed to download ${f}: HTTP ${res.status}`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
}
console.log('static assets ready (ort + model)');
