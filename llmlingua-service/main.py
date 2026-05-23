"""
Prompt Shaper — LLMLingua Microservice
---------------------------------------
Runs on port 3006 as a local AI compression worker.
The Node.js Express backend calls this service at POST /compress.

First run: downloads ~400MB model from HuggingFace (one-time only).
Subsequent runs: 100% offline, instant startup.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import logging
import time
import tiktoken

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager

# ── Global compressor instance (set by lifespan on startup) ──────────────────
compressor = None

# ── Tiktoken encoder — matches Node.js backend exactly (cl100k_base) ──────────
tokenizer = tiktoken.get_encoding('cl100k_base')

def count_tokens(text: str) -> int:
    """Exact token count using tiktoken cl100k_base — same as Node.js backend."""
    return len(tokenizer.encode(text))

@asynccontextmanager
async def lifespan(app: FastAPI):
    global compressor
    logger.info("🔄 Loading LLMLingua model... (first run may download ~400MB)")
    start = time.time()
    try:
        from llmlingua import PromptCompressor
        compressor = PromptCompressor(
            model_name="microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
            use_llmlingua2=True,
            device_map="cpu"
        )
        elapsed = time.time() - start
        logger.info(f"✅ LLMLingua model loaded in {elapsed:.1f}s")
    except Exception as e:
        logger.error(f"❌ Failed to load LLMLingua model: {e}")
        logger.warning("⚠️  Falling back to basic compression mode")
        compressor = None
    yield  # Server runs here
    # Cleanup on shutdown (nothing needed)

app = FastAPI(
    title="Prompt Shaper — LLMLingua Worker",
    description="Local AI-powered prompt compression microservice",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request / Response models ─────────────────────────────────────────────────
class CompressRequest(BaseModel):
    prompt: str
    ratio: float = 0.6  # Keep 60% of tokens by default — less aggressive, preserves structure
    target_token: int = -1  # Optional hard token limit (-1 = use ratio)


class CompressResponse(BaseModel):
    compressed_prompt: str
    origin_tokens: int
    compressed_tokens: int
    tokens_saved: int
    percent_saved: float
    method: str  # "llmlingua" or "fallback"


# ── Basic fallback compression (if model fails to load) ──────────────────────
def fallback_compress(text: str) -> str:
    import re
    fillers = [
        r'\bplease\b', r'\bcan you\b', r'\bcould you\b',
        r'\bwould you mind\b', r'\bI was wondering if\b',
        r'\bI would like you to\b', r'\bmake sure to\b',
        r'\bit would be great if\b', r'\bkindly\b',
        r'\bif you don\'t mind\b', r'\bif possible\b',
    ]
    for filler in fillers:
        text = re.sub(filler, '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


def count_tokens_approx(text: str) -> int:
    """Kept for compatibility — now delegates to exact tiktoken count."""
    return count_tokens(text)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": compressor is not None,
        "mode": "llmlingua" if compressor else "fallback"
    }


# ── Main compression endpoint ─────────────────────────────────────────────────
@app.post("/compress", response_model=CompressResponse)
async def compress(req: CompressRequest):
    if not req.prompt or not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    origin_tokens = count_tokens_approx(req.prompt)

    if compressor is not None:
        try:
            # LLMLingua2 uses 'rate' (not 'ratio') and takes the full text as 'text'
            result = compressor.compress_prompt_llmlingua2(
                req.prompt,
                rate=req.ratio,
                return_word_label=False
            )
            compressed = result["compressed_prompt"]

            import re
            # LLMLingua uses \n as chunk separators, not real line breaks.
            # Convert single \n → space, keep \n\n as paragraph breaks.
            compressed = re.sub(r'(?<!\n)\n(?!\n)', ' ', compressed)  # single \n → space
            compressed = re.sub(r'\n{2,}', '\n\n', compressed)       # normalize paragraph breaks
            compressed = re.sub(r'[ \t]{2,}', ' ', compressed)        # collapse extra spaces
            compressed = compressed.strip()

            method = "llmlingua"
            logger.info(f"✅ LLMLingua compressed {origin_tokens} → {count_tokens_approx(compressed)} tokens")
        except Exception as e:
            logger.warning(f"LLMLingua compression failed: {e}. Using fallback.")
            compressed = fallback_compress(req.prompt)
            method = "fallback"
    else:
        compressed = fallback_compress(req.prompt)
        method = "fallback"

    compressed_tokens = count_tokens_approx(compressed)
    tokens_saved = max(0, origin_tokens - compressed_tokens)
    percent_saved = round((tokens_saved / origin_tokens) * 100, 1) if origin_tokens > 0 else 0.0

    return CompressResponse(
        compressed_prompt=compressed,
        origin_tokens=origin_tokens,
        compressed_tokens=compressed_tokens,
        tokens_saved=tokens_saved,
        percent_saved=percent_saved,
        method=method
    )


# ── Streaming compression endpoint ───────────────────────────────────────────
@app.post("/compress/stream")
async def compress_stream(req: CompressRequest):
    import asyncio, json

    async def generate():
        loop = asyncio.get_event_loop()
        try:
            if compressor is not None:
                # Run LLMLingua in thread so async loop stays responsive
                result = await loop.run_in_executor(
                    None,
                    lambda: compressor.compress_prompt_llmlingua2(
                        req.prompt,
                        rate=req.ratio,
                        return_word_label=False
                    )
                )
                import re
                compressed = result["compressed_prompt"]
                compressed = re.sub(r'(?<!\n)\n(?!\n)', ' ', compressed)
                compressed = re.sub(r'\n{2,}', '\n\n', compressed)
                compressed = re.sub(r'[ \t]{2,}', ' ', compressed)
                compressed = compressed.strip()
                method = "llmlingua"
            else:
                compressed = fallback_compress(req.prompt)
                method = "fallback"

            # Stream word by word
            words = compressed.split(' ')
            for i, word in enumerate(words):
                chunk = word if i == 0 else ' ' + word
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
                await asyncio.sleep(0.025)

            # Final done event with stats
            origin_tokens = count_tokens_approx(req.prompt)
            comp_tokens   = count_tokens_approx(compressed)
            saved         = max(0, origin_tokens - comp_tokens)
            pct           = round((saved / origin_tokens) * 100, 1) if origin_tokens > 0 else 0.0
            yield f"data: {json.dumps({'type': 'done', 'method': method, 'originalTokens': origin_tokens, 'optimizedTokens': comp_tokens, 'tokensSaved': saved, 'percentSaved': pct, 'optimizedPrompt': compressed})}\n\n"

        except Exception as e:
            logger.error(f"Stream error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"}
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=3006, reload=False)
