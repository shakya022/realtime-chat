from fastapi import FastAPI

app = FastAPI(title="Realtime Chat API")


@app.get("/health")
def health():
    return {"status": "ok"}