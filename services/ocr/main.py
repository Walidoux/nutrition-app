import os
from typing import List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from paddleocr import PaddleOCR
import numpy as np
import cv2

app = FastAPI()
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"]
)

# load multiple OCR instances to pick the best match per image
LANGS = [s.strip() for s in os.getenv("OCR_LANGS", "en,french,arabic").split(",") if s.strip()]
OCR_POOL: dict[str, PaddleOCR] = {}

def _warmup(ocr: PaddleOCR):
    dummy = np.zeros((12, 12, 3), dtype=np.uint8)
    _ = ocr.ocr(dummy, cls=True)

@app.on_event("startup")
def startup():
    for lang in LANGS:
        OCR_POOL[lang] = PaddleOCR(use_angle_cls=True, lang=lang, show_log=False)
        _warmup(OCR_POOL[lang])

@app.get("/health")
def health():
    return {"ok": True, "langs": LANGS}

def _decode_image(data: bytes):
    arr = np.frombuffer(data, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    return img

def _run_ocr(img: np.ndarray, ocr: PaddleOCR):
    # result format: [ [ [box_points...], (text, score) ], ... ]
    result = ocr.ocr(img, cls=True)
    lines = []
    if result and len(result):
        for line in result[0]:
            box = line[0]
            text, score = line[1]
            lines.append({
                "text": text,
                "score": float(score),
                "box": [[float(x), float(y)] for x, y in box],
            })
    return lines

def _bbox(line):
    xs = [p[0] for p in line["box"]]; ys = [p[1] for p in line["box"]]
    return min(xs), min(ys), max(xs), max(ys)

def _iou(a, b):
    ax0, ay0, ax1, ay1 = a; bx0, by0, bx1, by1 = b
    ix0, iy0 = max(ax0, bx0), max(ay0, by0)
    ix1, iy1 = min(ax1, bx1), min(ay1, by1)
    iw, ih = max(0.0, ix1 - ix0), max(0.0, iy1 - iy0)
    inter = iw * ih
    if inter == 0: return 0.0
    areaA = (ax1 - ax0) * (ay1 - ay0)
    areaB = (bx1 - bx0) * (by1 - by0)
    return inter / (areaA + areaB - inter + 1e-6)

def _score_lines(lines: List[Dict[str, Any]]) -> float:
    # Weighted by text length to prefer more complete recognitions
    total_chars = sum(len(l["text"]) for l in lines)
    if total_chars == 0:
        return 0.0
    weighted = sum(len(l["text"]) * l["score"] for l in lines)
    return weighted / total_chars

@app.post("/ocr")
async def ocr_endpoint(
    image: UploadFile = File(...),
    langs: str | None = Query(None),
    merge: int | None = Query(None, description="merge outputs from all langs if 1"),
):
    try:
        data = await image.read()
        img = _decode_image(data)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")
    finally:
        await image.close()

    lang_list = [s.strip() for s in (langs or ",".join(LANGS)).split(",") if s.strip()]
    do_merge = bool(merge)

    if not do_merge:
        # old behavior: pick best-scoring single lang
        best = {"lang": None, "lines": [], "score": -1.0}
        for lang in lang_list:
            ocr = OCR_POOL.get(lang); 
            if not ocr: continue
            lines = _run_ocr(img, ocr)
            sc = _score_lines(lines)
            if sc > best["score"]:
                best = {"lang": lang, "lines": lines, "score": sc}
        best["lines"].sort(key=lambda l: (min(p[1] for p in l["box"]), min(p[0] for p in l["box"])))
        text = "\n".join(l["text"] for l in best["lines"])
        return {"lang": best["lang"], "score": best["score"], "text": text, "lines": best["lines"]}

    # merge mode: union boxes from all langs
    merged: list[dict] = []
    for lang in lang_list:
        ocr = OCR_POOL.get(lang)
        if not ocr: continue
        lines = _run_ocr(img, ocr)
        for ln in lines:
            b = _bbox(ln)
            placed = False
            for m in merged:
                if _iou(_bbox(m), b) > 0.5:
                    # keep higher-score recognition
                    if ln["score"] > m["score"]:
                        m.update(ln)
                    placed = True
                    break
            if not placed:
                merged.append(dict(ln))
    merged.sort(key=lambda l: (min(p[1] for p in l["box"]), min(p[0] for p in l["box"])))
    text = "\n".join(l["text"] for l in merged)
    return {"lang": "mixed", "score": _score_lines(merged), "text": text, "lines": merged}