"""
run.py — Project Launch Entry Point.
Runs the FastAPI application and serves both the REST API and the interactive clinical dashboard.
"""
import sys
import argparse
import webbrowser
from pathlib import Path
import uvicorn

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

def main():
    parser = argparse.ArgumentParser(description="PK-ML Clinical Dashboard Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port number (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable live auto-reload")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    args = parser.parse_args()

    url = f"http://{args.host}:{args.port}"
    print("=" * 70)
    print("   PK-ML Clinical Dashboard — Pharmacokinetic Machine Learning Suite")
    print(f"   Dashboard URL: {url}")
    print(f"   API Docs (Swagger): {url}/docs")
    print("   Scientific Research Prototype — Not for Clinical Dosing")
    print("=" * 70)

    if not args.no_browser:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    uvicorn.run("backend.main:app", host=args.host, port=args.port, reload=args.reload)

if __name__ == "__main__":
    main()
