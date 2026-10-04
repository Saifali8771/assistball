from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64

app = FastAPI(title="AssistBall API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    question: str
    image_base64: str

def analyze_with_vision_model(question: str, image_bytes: bytes) -> str:
    return (
        "I received your screenshot and question.\n\n"
        f"Your question: {question}\n\n"
        "This is the AssistBall demo response. "
        "Connect a vision-capable LLM inside analyze_with_vision_model() "
        "to get real screen-aware answers."
    )

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/analyze")
def analyze(request: AnalyzeRequest):
    try:
        image_bytes = base64.b64decode(request.image_base64)
        answer = analyze_with_vision_model(request.question, image_bytes)
        return {"ok": True, "answer": answer}
    except Exception as exc:
        return {"ok": False, "answer": f"Analysis failed: {exc}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
