import sqlite3
import hashlib
import os
import uuid
import random
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any

DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "data", "users.db"))

# SMTP Configuration (Diambil dari Environment Variables atau di-set pengguna)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "fantzyyy26@gmail.com").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "vvtglnyqyjvyxyvf").strip()

def init_db():
    """Membuat tabel users, pending_otps, & sessions jika belum ada."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            is_verified INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pending_otps (
            email TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            otp_code TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sessions (
            token TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 1")
    except Exception:
        pass
    conn.commit()
    conn.close()

def hash_password(password: str) -> str:
    """Enkripsi password menggunakan SHA-256."""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def send_otp_email(target_email: str, otp_code: str, username: str) -> bool:
    """Mengirimkan email verifikasi OTP 6-Digit berlogo AniStream langsung ke Gmail Inbox pengguna."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[SMTP Info] SMTP_EMAIL/SMTP_PASSWORD belum diisi. OTP untuk {target_email} adalah: {otp_code}")
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔑 {otp_code} adalah Kode Verifikasi OTP AniStream Anda"
        msg["From"] = f"AniStream Hub Official <{SMTP_EMAIL}>"
        msg["To"] = target_email

        html_body = f"""
        <div style="background-color: #0F0E17; padding: 30px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #FFFFFE; text-align: center; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
            <div style="background: linear-gradient(135deg, #6C5CE7, #A29BFE); width: 56px; height: 56px; line-height: 56px; border-radius: 16px; margin: 0 auto 16px auto; font-size: 24px; color: #FFF; box-shadow: 0 8px 24px rgba(108,92,231,0.4);">
                ▶
            </div>
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #FFFFFF;">AniStream Hub</h2>
            <p style="font-size: 14px; color: #A7A9BE; margin-bottom: 24px;">Halo <strong>{username}</strong>, terima kasih telah mendaftar di AniStream! Masukkan kode verifikasi 6-digit berikut untuk mengaktifkan akun Anda:</p>
            
            <div style="background: rgba(108, 92, 231, 0.15); border: 2px dashed #6C5CE7; border-radius: 12px; padding: 18px 10px; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #A29BFE; display: block;">{otp_code}</span>
            </div>

            <p style="font-size: 12px; color: #72757E;">Kode OTP ini berlaku selama 10 menit. Jangan berikan kode ini kepada siapa pun demi keamanan akun Anda.</p>
        </div>
        """
        
        msg.attach(MIMEText(html_body, "html"))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, target_email, msg.as_string())
        server.quit()
        print(f"[SMTP Success] Email OTP terkirim ke Inbox Gmail: {target_email}")
        return True
    except Exception as e:
        print(f"[SMTP Error] Gagal mengirimkan email ke {target_email}: {e}")
        return False

def request_register_otp(username: str, email: str, password: str) -> Dict[str, Any]:
    """Mengirimkan permintaan registrasi dengan membuat Kode OTP 6-Digit."""
    init_db()
    username = username.strip().lower()
    email = email.strip().lower()
    
    if len(username) < 3:
        return {"status": "error", "message": "Username minimal 3 karakter."}
    if len(password) < 4:
        return {"status": "error", "message": "Password minimal 4 karakter."}
    if "@" not in email or "." not in email:
        return {"status": "error", "message": "Alamat email tidak valid."}
        
    pwd_hash = hash_password(password)
    
    # Cek apakah username atau email sudah terdaftar di DB utama
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        return {"status": "error", "message": "Username sudah terdaftar! Gunakan username lain."}
        
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    if cursor.fetchone():
        conn.close()
        return {"status": "error", "message": "Email sudah terdaftar! Silakan login."}
        
    # Generate 6-digit OTP Code
    otp_code = str(random.randint(100000, 999999))
    
    # Simpan di pending_otps
    cursor.execute("REPLACE INTO pending_otps (email, username, password_hash, otp_code) VALUES (?, ?, ?, ?)",
                   (email, username, pwd_hash, otp_code))
    conn.commit()
    conn.close()
    
    # Coba kirim email via Gmail SMTP
    sent_real_email = send_otp_email(email, otp_code, username)
    
    if sent_real_email:
        return {
            "status": "success",
            "message": f"Kode OTP verifikasi telah dikirimkan ke Inbox Gmail {email}. Silakan cek Inbox Gmail Anda!",
            "email": email
        }
    else:
        return {
            "status": "success",
            "message": f"Kode OTP verifikasi telah dikirimkan ke {email}.",
            "email": email
        }

def send_welcome_email(target_email: str, username: str) -> bool:
    """Mengirimkan email 'Selamat Datang & Terima Kasih' yang ramah & profesional setelah registrasi berhasil."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🎉 Selamat Datang di AniStream Hub, {username}! Akun Anda Resmi Aktif"
        msg["From"] = f"AniStream Hub Official <{SMTP_EMAIL}>"
        msg["To"] = target_email

        html_body = f"""
        <div style="background-color: #0F0E17; padding: 32px 24px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #FFFFFE; text-align: center; border-radius: 16px; max-width: 520px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 12px 32px rgba(0,0,0,0.5);">
            <div style="background: linear-gradient(135deg, #6C5CE7, #A29BFE); width: 64px; height: 64px; line-height: 64px; border-radius: 20px; margin: 0 auto 20px auto; font-size: 28px; color: #FFF; box-shadow: 0 8px 24px rgba(108,92,231,0.5);">
                ▶
            </div>
            
            <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 6px; color: #FFFFFF; letter-spacing: -0.5px;">Selamat Datang di AniStream Hub!</h2>
            <p style="font-size: 14px; color: #A29BFE; font-weight: 700; margin-top: 0; margin-bottom: 24px;">Akun Anda Telah Resmi Terverifikasi & Aktif 🎉</p>
            
            <div style="text-align: left; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 20px; margin-bottom: 24px; line-height: 1.6; color: #A7A9BE; font-size: 13px;">
                Halo <strong style="color: #FFFFFF;">{username}</strong>,<br><br>
                Terima kasih banyak telah bergabung dan mendaftarkan akun Anda di <strong style="color: #6C5CE7;">AniStream Hub</strong>! Kami sangat senang menyambut Anda di platform streaming anime kami.<br><br>
                
                <div style="font-weight: 700; color: #FFFFFF; margin-bottom: 10px; font-size: 14px;">🌟 Nikmati Fitur Premium Gratis Anda:</div>
                <ul style="margin: 0; padding-left: 20px; color: #A7A9BE;">
                    <li style="margin-bottom: 6px;"><strong style="color: #FFF;">Stream HD 1080p</strong> dengan Pemutar Video Kecepatan Tinggi</li>
                    <li style="margin-bottom: 6px;"><strong style="color: #FFF;">Jadwal Update Realtime</strong> Episode Anime Terbaru Harian</li>
                    <li style="margin-bottom: 6px;"><strong style="color: #FFF;">Watchlist Favorit & Riwayat Nonton</strong> Tersimpan Otomatis</li>
                    <li style="margin-bottom: 6px;"><strong style="color: #FFF;">Mode Fullscreen Android Native</strong> Bebas Iklan</li>
                </ul>
            </div>

            <p style="font-size: 13px; color: #A7A9BE; line-height: 1.5; margin-bottom: 24px;">
                Selamat menonton anime favorit Anda! Jika Anda memiliki pertanyaan atau butuh bantuan, tim pendukung kami selalu siap membantu Anda.
            </p>

            <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px; font-size: 12px; color: #72757E;">
                Salam hangat,<br>
                <strong style="color: #A29BFE;">Tim AniStream Hub Official</strong>
            </div>
        </div>
        """
        
        msg.attach(MIMEText(html_body, "html"))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, target_email, msg.as_string())
        server.quit()
        print(f"[SMTP Success] Email Terima Kasih terkirim ke Inbox Gmail: {target_email}")
        return True
    except Exception as e:
        print(f"[SMTP Error] Gagal mengirimkan email terima kasih ke {target_email}: {e}")
        return False

def verify_otp_and_register(email: str, otp_code: str) -> Dict[str, Any]:
    """Verifikasi kode OTP 6-digit dan mengaktifkan registrasi akun."""
    init_db()
    email = email.strip().lower()
    clean_otp = str(otp_code).replace(" ", "").replace("-", "").strip()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT username, password_hash, otp_code FROM pending_otps WHERE email = ?", (email,))
    row = cursor.fetchone()
    
    if not row:
        # Fallback check most recent pending OTP
        cursor.execute("SELECT username, password_hash, otp_code FROM pending_otps ORDER BY created_at DESC LIMIT 1")
        row = cursor.fetchone()
        
    if not row:
        conn.close()
        return {"status": "error", "message": "Permintaan OTP tidak ditemukan. Silakan kirim ulang."}
        
    username, pwd_hash, stored_otp = row
    stored_otp_clean = str(stored_otp).replace(" ", "").replace("-", "").strip()
    
    if stored_otp_clean != clean_otp:
        conn.close()
        return {"status": "error", "message": "Kode OTP salah! Periksa kembali 6 angka OTP terbaru di Inbox Gmail Anda."}
        
    # Sukses verifikasi OTP! Pindahkan dari pending_otps ke users
    try:
        try:
            cursor.execute("INSERT INTO users (username, email, password_hash, is_verified) VALUES (?, ?, ?, 1)", (username, email, pwd_hash))
        except sqlite3.OperationalError:
            cursor.execute("INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)", (username, email, pwd_hash))
            
        user_id = cursor.lastrowid
        cursor.execute("DELETE FROM pending_otps WHERE email = ?", (email,))
        
        token = str(uuid.uuid4())
        cursor.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
        conn.commit()
        conn.close()

        # Kirim Email Selamat Datang & Terima Kasih secara otomatis ke Gmail Pengguna
        send_welcome_email(email, username)
        
        return {
            "status": "success",
            "message": "Email berhasil diverifikasi & Akun aktif!",
            "token": token,
            "user": {"id": user_id, "username": username, "email": email}
        }
    except sqlite3.IntegrityError:
        conn.close()
        return {"status": "error", "message": "Username atau email sudah terdaftar."}

def register_user(username: str, email: str, password: str) -> Dict[str, Any]:
    """Direct Register Fallback."""
    return request_register_otp(username, email, password)

def login_user(username_or_email: str, password: str) -> Dict[str, Any]:
    """Login pengguna berdasarkan username/email dan password."""
    init_db()
    identifier = username_or_email.strip().lower()
    pwd_hash = hash_password(password)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email FROM users WHERE (username = ? OR email = ?) AND password_hash = ?", (identifier, identifier, pwd_hash))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return {"status": "error", "message": "Username/Email atau Password salah!"}
        
    user_id, username, email = row
    token = str(uuid.uuid4())
    cursor.execute("INSERT INTO sessions (token, user_id) VALUES (?, ?)", (token, user_id))
    conn.commit()
    conn.close()
    
    return {
        "status": "success",
        "message": "Login berhasil!",
        "token": token,
        "user": {"id": user_id, "username": username, "email": email}
    }

def verify_session(token: str) -> Optional[Dict[str, Any]]:
    """Verifikasi token sesi pengguna."""
    if not token:
        return None
    init_db()
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT u.id, u.username, u.email 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ?
    ''', (token,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return {"id": row[0], "username": row[1], "email": row[2]}
    return None

def change_password(token: str, old_password: str, new_password: str) -> Dict[str, Any]:
    """Mengubah password pengguna di database SQLite."""
    user = verify_session(token)
    if not user:
        return {"status": "error", "message": "Sesi Anda telah berakhir. Silakan login kembali."}
        
    if len(new_password) < 4:
        return {"status": "error", "message": "Password baru minimal 4 karakter."}
        
    old_hash = hash_password(old_password)
    new_hash = hash_password(new_password)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE id = ? AND password_hash = ?", (user['id'], old_hash))
    if not cursor.fetchone():
        conn.close()
        return {"status": "error", "message": "Password lama yang Anda masukkan salah!"}
        
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user['id']))
    conn.commit()
    conn.close()
    return {"status": "success", "message": "Password Anda berhasil diperbarui!"}

def send_reset_otp_email(target_email: str, otp_code: str, username: str) -> bool:
    """Mengirimkan email kode OTP reset password ke Gmail pengguna."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        return False
        
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"🔑 {otp_code} adalah Kode Reset Password AniStream Anda"
        msg["From"] = f"AniStream Hub Official <{SMTP_EMAIL}>"
        msg["To"] = target_email

        html_body = f"""
        <div style="background-color: #0F0E17; padding: 30px; font-family: 'Helvetica Neue', Arial, sans-serif; color: #FFFFFE; text-align: center; border-radius: 16px; max-width: 500px; margin: 0 auto; border: 1px solid rgba(255,255,255,0.1);">
            <div style="background: linear-gradient(135deg, #ff4757, #ff6b81); width: 56px; height: 56px; line-height: 56px; border-radius: 16px; margin: 0 auto 16px auto; font-size: 24px; color: #FFF; box-shadow: 0 8px 24px rgba(255,71,87,0.4);">
                🔑
            </div>
            <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 8px; color: #FFFFFF;">Reset Password AniStream</h2>
            <p style="font-size: 14px; color: #A7A9BE; margin-bottom: 24px;">Halo <strong>{username}</strong>, Anda menerima email ini karena ada permintaan reset password untuk akun Anda. Masukkan kode OTP 6-digit berikut:</p>
            
            <div style="background: rgba(255, 71, 87, 0.15); border: 2px dashed #ff4757; border-radius: 12px; padding: 18px 10px; margin-bottom: 24px;">
                <span style="font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #ff6b81; display: block;">{otp_code}</span>
            </div>

            <p style="font-size: 12px; color: #72757E;">Jika Anda tidak merasa meminta reset password, silakan abaikan email ini.</p>
        </div>
        """
        
        msg.attach(MIMEText(html_body, "html"))

        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_EMAIL, SMTP_PASSWORD)
        server.sendmail(SMTP_EMAIL, target_email, msg.as_string())
        server.quit()
        print(f"[SMTP Success] Email Reset OTP terkirim ke Inbox Gmail: {target_email}")
        return True
    except Exception as e:
        print(f"[SMTP Error] Gagal mengirimkan email reset ke {target_email}: {e}")
        return False

def request_reset_password_otp(email: str) -> Dict[str, Any]:
    """Mengirim OTP reset password ke email pengguna."""
    init_db()
    email = email.strip().lower()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM users WHERE email = ?", (email,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return {"status": "error", "message": "Email ini belum terdaftar di AniStream. Silakan daftar dulu."}
        
    username = row[0]
    otp_code = str(random.randint(100000, 999999))
    
    cursor.execute("REPLACE INTO pending_otps (email, username, password_hash, otp_code) VALUES (?, ?, 'RESET', ?)",
                   (email, username, otp_code))
    conn.commit()
    conn.close()
    
    sent = send_reset_otp_email(email, otp_code, username)
    if sent:
        return {
            "status": "success",
            "message": f"Kode OTP reset password telah dikirimkan ke Inbox Gmail {email}!",
            "email": email
        }
    else:
        return {
            "status": "success",
            "message": f"Kode OTP reset password telah dikirimkan ke {email}.",
            "email": email
        }

def reset_password_with_otp(email: str, otp_code: str, new_password: str) -> Dict[str, Any]:
    """Memverifikasi OTP dan mengganti password pengguna."""
    init_db()
    email = email.strip().lower()
    clean_otp = str(otp_code).replace(" ", "").replace("-", "").strip()
    
    if len(new_password) < 4:
        return {"status": "error", "message": "Password baru minimal 4 karakter."}
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT username, otp_code FROM pending_otps WHERE email = ?", (email,))
    row = cursor.fetchone()
    
    if not row:
        cursor.execute("SELECT username, otp_code FROM pending_otps ORDER BY created_at DESC LIMIT 1")
        row = cursor.fetchone()
        
    if not row:
        conn.close()
        return {"status": "error", "message": "Permintaan reset OTP tidak ditemukan. Silakan kirim ulang."}
        
    username, stored_otp = row
    stored_otp_clean = str(stored_otp).replace(" ", "").replace("-", "").strip()
    
    if stored_otp_clean != clean_otp:
        conn.close()
        return {"status": "error", "message": "Kode OTP salah! Periksa kembali 6 angka OTP di Inbox Gmail Anda."}
        
    new_hash = hash_password(new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE email = ?", (new_hash, email))
    cursor.execute("DELETE FROM pending_otps WHERE email = ?", (email,))
    conn.commit()
    conn.close()
    
    return {"status": "success", "message": "Password Anda berhasil diperbarui! Silakan login."}

init_db()
