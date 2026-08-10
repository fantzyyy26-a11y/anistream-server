from fastapi import FastAPI, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse, Response, StreamingResponse
from starlette.concurrency import run_in_threadpool
import os
import requests
import urllib.parse
from bs4 import BeautifulSoup
import scraper
import auth
from pydantic import BaseModel

class RegisterPayload(BaseModel):
    username: str
    email: str
    password: str

class VerifyOtpPayload(BaseModel):
    email: str
    otp_code: str

class LoginPayload(BaseModel):
    username_or_email: str
    password: str

class ChangePasswordPayload(BaseModel):
    token: str
    old_password: str
    new_password: str

class ResetRequestPayload(BaseModel):
    email: str

class ResetPasswordPayload(BaseModel):
    email: str
    otp_code: str
    new_password: str

app = FastAPI(
    title="AniStream Hub Backend API",
    description="API Server untuk Aplikasi Stream Anime Android (Bstation Alternative)",
    version="1.0.0"
)

# Enable CORS agar bisa diakses dari Frontend & Mobile PWA / Android Webview
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.endswith((".js", ".css", ".html")) or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

from starlette.concurrency import run_in_threadpool

@app.get("/api/health")
async def health_check():
    return {"status": "online", "message": "AniStream Hub Backend Operating Normally"}

@app.post("/api/auth/request_otp")
async def request_otp_endpoint(payload: RegisterPayload):
    res = await run_in_threadpool(auth.request_register_otp, payload.username, payload.email, payload.password)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/auth/verify_otp")
async def verify_otp_endpoint(payload: VerifyOtpPayload):
    res = await run_in_threadpool(auth.verify_otp_and_register, payload.email, payload.otp_code)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/auth/register")
async def register_endpoint(payload: RegisterPayload):
    res = await run_in_threadpool(auth.register_user, payload.username, payload.email, payload.password)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/auth/login")
async def login_endpoint(payload: LoginPayload):
    res = await run_in_threadpool(auth.login_user, payload.username_or_email, payload.password)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/auth/change_password")
async def change_password_endpoint(payload: ChangePasswordPayload):
    res = await run_in_threadpool(auth.change_password, payload.token, payload.old_password, payload.new_password)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/auth/request_reset_password")
async def request_reset_password_endpoint(payload: ResetRequestPayload):
    res = await run_in_threadpool(auth.request_reset_password_otp, payload.email)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.post("/api/auth/reset_password")
async def reset_password_endpoint(payload: ResetPasswordPayload):
    res = await run_in_threadpool(auth.reset_password_with_otp, payload.email, payload.otp_code, payload.new_password)
    if res.get("status") == "error":
        raise HTTPException(status_code=400, detail=res.get("message"))
    return res

@app.get("/api/auth/me")
async def me_endpoint(token: str = Query("")):
    user = await run_in_threadpool(auth.verify_session, token)
    if not user:
        raise HTTPException(status_code=401, detail="Sesi login tidak valid")
    return {"status": "success", "user": user}

@app.get("/api/trending")
async def get_trending(limit: int = Query(24, ge=1, le=50)):
    """Mengambil daftar anime trending/terpopuler."""
    results = await run_in_threadpool(scraper.get_top_anime, limit)
    return {"status": "success", "count": len(results), "data": results}

@app.get("/api/seasonal")
async def get_seasonal(limit: int = Query(24, ge=1, le=50)):
    """Mengambil anime musim ini (Ongoing)."""
    results = await run_in_threadpool(scraper.get_seasonal_anime, limit)
    return {"status": "success", "count": len(results), "data": results}

@app.get("/api/otakudesu_ongoing")
async def get_otakudesu_ongoing():
    """Mengambil daftar update anime ongoing realtime langsung dari Otakudesu."""
    results = await run_in_threadpool(scraper.get_otakudesu_ongoing_anime)
    return {"status": "success", "count": len(results), "data": results}

@app.get("/api/schedule")
async def get_schedule():
    """Mengambil jadwal rilis harian (Senin - Minggu) 100% langsung dari Otakudesu."""
    results = await run_in_threadpool(scraper.get_otakudesu_schedule)
    return {"status": "success", "data": results}

@app.get("/api/genre/{genre_name}")
async def get_genre_anime(genre_name: str):
    """Mengambil anime berdasarkan kategori genre 100% langsung dari Otakudesu."""
    results = await run_in_threadpool(scraper.get_otakudesu_genre_anime, genre_name)
    return {"status": "success", "genre": genre_name, "count": len(results), "data": results}

@app.get("/api/search")
async def search_anime(q: str = Query(..., min_length=1), limit: int = Query(20, ge=1, le=50)):
    """Pencarian anime berdasarkan kata kunci."""
    results = await run_in_threadpool(scraper.search_anime, q, limit)
    return {"status": "success", "query": q, "count": len(results), "data": results}

@app.get("/api/anime/{anime_id}")
async def get_anime_details(anime_id: str, otaku_url: str = Query("")):
    """Detail lengkap anime dan daftar episode (100% Otakudesu / AniList)."""
    target = otaku_url if otaku_url else anime_id
    details = await run_in_threadpool(scraper.get_anime_details, target)
    if not details:
        raise HTTPException(status_code=404, detail="Anime tidak ditemukan")
    return {"status": "success", "data": details}

@app.get("/api/embed_proxy/{anime_id}/{ep_number}", response_class=HTMLResponse)
async def get_embed_proxy(anime_id: str, ep_number: int, server: str = Query("1"), mal: str = Query("")):
    """Proxy HTML Embed Player."""
    target_slug = anime_id.replace('otaku-', '').strip('/')
    mal_clean = mal.replace('otaku-', '').strip('/') if mal else target_slug
    
    if target_slug in ['20', 'naruto', 'naruto-shippuden']:
        mal_clean = '20'
    elif target_slug in ['131', 'dragon-ball-super']:
        mal_clean = '30694'
    elif target_slug in ['37', 'death-note']:
        mal_clean = '1535'

    if server == "2":
        target_url = f"https://vidsrc.me/embed/anime/{mal_clean}/{ep_number}"
    elif server == "3":
        target_url = f"https://vidsrc.cc/v2/embed/anime?mal={mal_clean}&ep={ep_number}"
    elif server == "4":
        target_url = f"https://www.2embed.cc/embed/anime/{mal_clean}/{ep_number}"
    else:
        target_url = f"https://vidsrc.pm/embed/anime/{mal_clean}/{ep_number}"

    html_content = f"""<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="referrer" content="no-referrer">
    <style>
        html, body {{ margin: 0; padding: 0; width: 100%; height: 100%; background: #000; overflow: hidden; }}
        iframe {{ width: 100%; height: 100%; border: 0; }}
    </style>
</head>
<body>
    <iframe src="{target_url}" allowfullscreen allow="autoplay; encrypted-media" referrerpolicy="no-referrer"></iframe>
</body>
</html>
"""
    return HTMLResponse(content=html_content)

@app.get("/api/proxy_media")
async def proxy_media(url: str, request: Request):
    """Proxy direct video stream chunks (MP4/HLS) to bypass IP and referer restrictions."""
    try:
        target_url = urllib.parse.unquote(url)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://otakudesu.blog/"
        }
        range_header = request.headers.get("range")
        if range_header:
            headers["Range"] = range_header
            
        r = requests.get(target_url, headers=headers, stream=True, timeout=10)
        
        def iterfile():
            for chunk in r.iter_content(chunk_size=64 * 1024):
                if chunk:
                    yield chunk
                    
        response_headers = {
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*"
        }
        if "Content-Length" in r.headers:
            response_headers["Content-Length"] = r.headers["Content-Length"]
        if "Content-Range" in r.headers:
            response_headers["Content-Range"] = r.headers["Content-Range"]
            
        return StreamingResponse(
            iterfile(),
            status_code=r.status_code,
            media_type=r.headers.get("Content-Type", "video/mp4"),
            headers=response_headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/proxy_embed")
async def proxy_embed(url: str):
    """Proxy embed player page or Otakudesu episode page with clean layout and ad removal."""
    try:
        req_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://otakudesu.blog/"
        }
        res = await run_in_threadpool(requests.get, url, headers=req_headers, timeout=6)
        
        content = res.text
        content = content.replace("height: 90vh;", "width: 100%; height: 100vh; object-fit: contain;")
        content = content.replace("height:90vh;", "width: 100%; height: 100vh; object-fit: contain;")
        
        # Rewrite media source tags to use /api/proxy_media
        try:
            soup = BeautifulSoup(content, 'html.parser')
            for src_tag in soup.find_all(['source', 'video']):
                src_val = src_tag.get('src')
                if src_val and (src_val.startswith('http') or src_val.startswith('//')):
                    if src_val.startswith('//'):
                        src_val = 'https:' + src_val
                    proxied_media = f"/api/proxy_media?url={urllib.parse.quote(src_val)}"
                    src_tag['src'] = proxied_media
            content = str(soup)
        except Exception:
            pass
        
        custom_style = """
        <style>
            html, body { width: 100% !important; height: 100% !important; margin: 0 !important; padding: 0 !important; background: #0b0c10 !important; color: #fff !important; font-family: system-ui, -apple-system, sans-serif !important; }
            .navbar, footer, #sidebar, .ads300px, .fb-root, .fb-page, #footzer, .hanamenu { display: none !important; }
            iframe { width: 100% !important; height: 420px !important; border: none !important; border-radius: 8px !important; }
            video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
            .mirrorstream { background: #1f2833 !important; padding: 12px !important; border-radius: 8px !important; margin-top: 10px !important; }
            a { color: #66fcf1 !important; text-decoration: none !important; }
        </style>
        """
        if "<head>" in content:
            content = content.replace("<head>", f"<head>{custom_style}<base href='{url}'>")
        else:
            content = custom_style + content
            
        return Response(content=content, media_type="text/html")
    except Exception as e:
        return Response(content=f"<div style='color:white;background:black;padding:20px;text-align:center;'><h3>Gagal memuat player: {str(e)}</h3></div>", media_type="text/html")

@app.get("/api/stream/{mal_id}/{ep_number}")
async def get_stream_sources(mal_id: str, ep_number: int, slug: str = Query(""), mal: str = Query(""), title: str = Query(""), otaku_url: str = Query("")):
    """Mengambil link streaming video multi-server untuk episode tertentu secara realtime."""
    stream_data = await run_in_threadpool(scraper.get_stream_servers, mal_id, ep_number, slug, mal, title, otaku_url)
    return {"status": "success", "data": stream_data}

# Mount static files dari folder frontend jika ada
frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
