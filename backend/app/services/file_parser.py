"""Extract plain text from an uploaded syllabus file."""

from __future__ import annotations

import io

from pypdf import PdfReader


def extract_text(filename: str, content: bytes) -> str:
    name = filename.lower()
    if name.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
    if name.endswith(".pdf"):
        reader = PdfReader(io.BytesIO(content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages).strip()
        if not text:
            raise ValueError("could not extract text from PDF (it may be scanned/image-based)")
        return text
    raise ValueError(f"unsupported syllabus file type: {filename}")
