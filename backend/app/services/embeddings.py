import hashlib
import math
import re
from typing import Protocol


class Embedder(Protocol):
    name: str

    def embed(self, texts: list[str]) -> list[list[float]]: ...


class ChromaDefaultEmbedder:
    """all-MiniLM-L6-v2 via ChromaDB's bundled ONNX runtime (local inference, model downloaded once)."""

    name = "chroma-default-all-MiniLM-L6-v2"

    def __init__(self) -> None:
        from chromadb.utils.embedding_functions import DefaultEmbeddingFunction

        self._fn = DefaultEmbeddingFunction()

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [list(map(float, v)) for v in self._fn(texts)]


class HashEmbedder:
    """Deterministic bag-of-words hashing embedder. Offline; intended for tests only."""

    name = "hash-bow-256"
    dim = 256

    def embed(self, texts: list[str]) -> list[list[float]]:
        out = []
        for text in texts:
            vec = [0.0] * self.dim
            for tok in re.findall(r"[a-z0-9]+", text.lower()):
                h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
                vec[h % self.dim] += 1.0
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            out.append([v / norm for v in vec])
        return out


def build_embedder(backend: str) -> Embedder:
    if backend == "hash":
        return HashEmbedder()
    if backend == "default":
        return ChromaDefaultEmbedder()
    raise ValueError(f"Unknown embedding backend: {backend}")
