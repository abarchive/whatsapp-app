from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import asyncpg
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
import aiohttp
import subprocess
from contextlib import asynccontextmanager
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# PostgreSQL connection settings
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://botwave_user:BotWave@SecurePass123@localhost:5432/botwave')

# Socket.IO Server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# User session tracking: {user_id: set(sid1, sid2, ...)}
user_sessions: Dict[str, set] = {}
# SID to user mapping: {sid: user_id}
sid_to_user: Dict[str, str] = {}

# Global connection pool
db_pool = None

async def get_db_pool():
    global db_pool
    if db_pool is None:
        db_pool = await asyncpg.create_pool(
            DATABASE_URL,
            min_size=2,
            max_size=10,
            command_timeout=60
        )
    return db_pool

async def close_db_pool():
    global db_pool
    if db_pool:
        await db_pool.close()
        db_pool = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await get_db_pool()
    await create_default_admin()
    logger.info("Database pool initialized")
    yield
    # Shutdown
    await close_db_pool()
    logger.info("Database pool closed")

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Health check endpoint
@api_router.get("/health")
async def health_check():
    """Health check endpoint for monitoring and load balancers"""
    try:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.fetchval('SELECT 1')
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return {
        "status": "ok",
        "service": "whatsapp-automation-api",
        "database": db_status,
        "database_type": "postgresql",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
WHATSAPP_SERVICE_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://localhost:8002')

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    plain_password: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    api_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    role: str = "user"
    status: str = "active"
    rate_limit: int = 30

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime
    api_key: str
    role: str = "user"
    status: str = "active"
    rate_limit: int = 30
    force_password_change: bool = False

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class PasswordResetResponse(BaseModel):
    success: bool
    message: str
    temporary_password: str

class MessageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    receiver_number: str
    message_body: str
    status: str
    source: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActivityLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_email: str
    action: str
    details: str
    ip_address: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageSend(BaseModel):
    number: str
    message: str

class MessageResponse(BaseModel):
    status: str
    to: str
    message: str

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "global_settings"
    default_rate_limit: int = 30
    max_rate_limit: int = 100
    enable_registration: bool = True
    maintenance_mode: bool = False
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, email: str, role: str = "user") -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Helper function to convert asyncpg Record to dict
def record_to_dict(record):
    if record is None:
        return None
    return dict(record)

def records_to_list(records):
    return [dict(r) for r in records]

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            user = await conn.fetchrow(
                'SELECT id, email, api_key, role, status, rate_limit, force_password_change, created_at FROM users WHERE id = $1',
                uuid.UUID(user_id)
            )
        
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        
        user_dict = record_to_dict(user)
        user_dict['id'] = str(user_dict['id'])
        
        if user_dict.get('status') in ['suspended', 'deactive']:
            raise HTTPException(status_code=403, detail='Account is deactivated. Please contact administrator.')
        return user_dict
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

async def verify_api_key(api_key: str = Header(...)):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            'SELECT id, email, api_key, role, status, rate_limit FROM users WHERE api_key = $1',
            api_key
        )
    
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API key')
    
    user_dict = record_to_dict(user)
    user_dict['id'] = str(user_dict['id'])
    
    if user_dict.get('status') in ['suspended', 'deactive']:
        raise HTTPException(status_code=403, detail='Account is deactivated')
    return user_dict

async def log_activity(user_id: str, user_email: str, action: str, details: str, ip: Optional[str] = None):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            '''INSERT INTO activity_logs (id, user_id, user_email, action, details, ip_address, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)''',
            uuid.uuid4(), uuid.UUID(user_id), user_email, action, details, ip, datetime.now(timezone.utc)
        )

# Create default admin user
async def create_default_admin():
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        admin_exists = await conn.fetchrow("SELECT id FROM users WHERE role = 'admin'")
        if not admin_exists:
            admin_id = uuid.uuid4()
            await conn.execute(
                '''INSERT INTO users (id, email, password_hash, plain_password, api_key, role, status, rate_limit, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)''',
                admin_id,
                'admin@admin.com',
                hash_password('Admin@7501'),
                'Admin@7501',
                secrets.token_urlsafe(32),
                'admin',
                'active',
                1000,
                datetime.now(timezone.utc)
            )
            logger.info('Default admin user created: admin@admin.com')

# Auth Endpoints
@api_router.post('/auth/register', response_model=UserResponse)
async def register(user_data: UserCreate):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        settings = await conn.fetchrow("SELECT * FROM settings WHERE id = 'global_settings'")
        if settings and not settings['enable_registration']:
            raise HTTPException(status_code=403, detail='Registration is currently disabled')
        
        existing = await conn.fetchrow('SELECT id FROM users WHERE email = $1', user_data.email)
        if existing:
            raise HTTPException(status_code=400, detail='Email already registered')
        
        default_rate_limit = settings['default_rate_limit'] if settings else 30
        user_id = uuid.uuid4()
        api_key = secrets.token_urlsafe(32)
        created_at = datetime.now(timezone.utc)
        
        await conn.execute(
            '''INSERT INTO users (id, email, password_hash, plain_password, api_key, role, status, rate_limit, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)''',
            user_id,
            user_data.email,
            hash_password(user_data.password),
            user_data.password,
            api_key,
            'user',
            'active',
            default_rate_limit,
            created_at
        )
    
    await log_activity(str(user_id), user_data.email, 'USER_REGISTERED', 'New user registration')
    
    return UserResponse(
        id=str(user_id),
        email=user_data.email,
        created_at=created_at,
        api_key=api_key,
        role='user',
        status='active',
        rate_limit=default_rate_limit
    )

@api_router.post('/auth/login')
async def login(credentials: UserLogin):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow('SELECT * FROM users WHERE email = $1', credentials.email)
    
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    user_dict = record_to_dict(user)
    user_dict['id'] = str(user_dict['id'])
    
    if user_dict.get('status') in ['suspended', 'deactive']:
        raise HTTPException(status_code=403, detail='Account is deactivated. Please contact administrator.')
    
    # Check maintenance mode (skip for admin users)
    if user_dict.get('role') != 'admin':
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            settings = await conn.fetchrow("SELECT * FROM settings WHERE id = 'global_settings'")
        if settings and settings['maintenance_mode']:
            raise HTTPException(status_code=503, detail='System is under maintenance. Please try again later.')
    
    token = create_access_token(user_dict['id'], user_dict['email'], user_dict.get('role', 'user'))
    
    await log_activity(user_dict['id'], user_dict['email'], 'USER_LOGIN', 'User logged in')
    
    return {
        'access_token': token,
        'token_type': 'bearer',
        'user': {
            'id': user_dict['id'],
            'email': user_dict['email'],
            'api_key': user_dict['api_key'],
            'role': user_dict.get('role', 'user'),
            'status': user_dict.get('status', 'active'),
            'force_password_change': user_dict.get('force_password_change', False)
        }
    }

@api_router.get('/auth/me', response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user['id'],
        email=user['email'],
        created_at=user['created_at'],
        api_key=user['api_key'],
        role=user.get('role', 'user'),
        status=user.get('status', 'active'),
        rate_limit=user.get('rate_limit', 30),
        force_password_change=user.get('force_password_change', False)
    )

# Admin - Users Management
@api_router.get('/admin/users')
async def get_all_users(admin: dict = Depends(get_admin_user), skip: int = 0, limit: int = 50):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        users = await conn.fetch(
            'SELECT id, email, api_key, role, status, rate_limit, plain_password, created_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            limit, skip
        )
        total = await conn.fetchval('SELECT COUNT(*) FROM users')
    
    users_list = []
    for u in users:
        user_dict = record_to_dict(u)
        user_dict['id'] = str(user_dict['id'])
        users_list.append(user_dict)
    
    return {'users': users_list, 'total': total}

@api_router.get('/admin/users/{user_id}')
async def get_user_by_id(user_id: str, admin: dict = Depends(get_admin_user)):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow(
            'SELECT id, email, api_key, role, status, rate_limit, plain_password, created_at FROM users WHERE id = $1',
            uuid.UUID(user_id)
        )
    
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    
    user_dict = record_to_dict(user)
    user_dict['id'] = str(user_dict['id'])
    return user_dict

@api_router.put('/admin/users/{user_id}')
async def update_user(user_id: str, updates: dict, admin: dict = Depends(get_admin_user)):
    allowed_fields = ['email', 'status', 'rate_limit', 'role']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail='No valid fields to update')
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        target_user = await conn.fetchrow('SELECT email FROM users WHERE id = $1', uuid.UUID(user_id))
        if not target_user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Build dynamic update query
        set_clauses = []
        values = []
        for i, (key, value) in enumerate(update_data.items(), start=1):
            set_clauses.append(f"{key} = ${i}")
            values.append(value)
        
        values.append(uuid.UUID(user_id))
        query = f"UPDATE users SET {', '.join(set_clauses)} WHERE id = ${len(values)}"
        await conn.execute(query, *values)
    
    await log_activity(admin['id'], admin['email'], 'USER_UPDATED', f'Updated user {target_user["email"]}: {update_data}')
    return {'success': True, 'message': 'User updated'}

@api_router.delete('/admin/users/{user_id}')
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    if user_id == admin['id']:
        raise HTTPException(status_code=400, detail='Cannot delete own account')
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        target_user = await conn.fetchrow('SELECT email FROM users WHERE id = $1', uuid.UUID(user_id))
        if not target_user:
            raise HTTPException(status_code=404, detail='User not found')
        
        await conn.execute('DELETE FROM users WHERE id = $1', uuid.UUID(user_id))
    
    await log_activity(admin['id'], admin['email'], 'USER_DELETED', f'Deleted user {target_user["email"]}')
    return {'success': True, 'message': 'User deleted'}

@api_router.post('/admin/users')
async def create_user_by_admin(user_data: dict, admin: dict = Depends(get_admin_user)):
    email = user_data.get('email')
    password = user_data.get('password', 'Password@123')
    role = user_data.get('role', 'user')
    rate_limit = user_data.get('rate_limit', 30)
    status = user_data.get('status', 'active')
    
    if not email:
        raise HTTPException(status_code=400, detail='Email required')
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        existing = await conn.fetchrow('SELECT id FROM users WHERE email = $1', email)
        if existing:
            raise HTTPException(status_code=400, detail='Email already exists')
        
        user_id = uuid.uuid4()
        api_key = secrets.token_urlsafe(32)
        
        await conn.execute(
            '''INSERT INTO users (id, email, password_hash, plain_password, api_key, role, status, rate_limit, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)''',
            user_id, email, hash_password(password), password, api_key, role, status, rate_limit, datetime.now(timezone.utc)
        )
    
    await log_activity(admin['id'], admin['email'], 'USER_CREATED', f'Created user {email}')
    return {'success': True, 'user_id': str(user_id), 'email': email}

# Generate strong random password
def generate_strong_password(length: int = 14) -> str:
    """Generate a strong random password with uppercase, lowercase, numbers, and special chars"""
    import string
    # Ensure at least one of each type
    password = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice('!@#$%^&*')
    ]
    # Fill rest with random chars
    all_chars = string.ascii_letters + string.digits + '!@#$%^&*'
    password.extend(secrets.choice(all_chars) for _ in range(length - 4))
    # Shuffle to avoid predictable pattern
    secrets.SystemRandom().shuffle(password)
    return ''.join(password)

# Admin - Reset User Password
@api_router.post('/admin/reset-password/{user_id}', response_model=PasswordResetResponse)
async def admin_reset_password(user_id: str, admin: dict = Depends(get_admin_user)):
    """
    Admin-only endpoint to reset a user's password.
    Generates a strong random password and sets force_password_change = TRUE.
    Returns the temporary password ONLY in the response (not stored as plain text).
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Check if user exists
        target_user = await conn.fetchrow('SELECT id, email FROM users WHERE id = $1', uuid.UUID(user_id))
        if not target_user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Generate new strong password
        new_password = generate_strong_password(14)
        password_hash = hash_password(new_password)
        
        # Update user: set new password hash and force_password_change = TRUE
        # NOTE: We do NOT store the plain password for security
        await conn.execute(
            '''UPDATE users 
               SET password_hash = $1, plain_password = NULL, force_password_change = TRUE 
               WHERE id = $2''',
            password_hash, uuid.UUID(user_id)
        )
    
    await log_activity(
        admin['id'], 
        admin['email'], 
        'PASSWORD_RESET', 
        f'Admin reset password for user {target_user["email"]}'
    )
    
    return PasswordResetResponse(
        success=True,
        message=f'Password reset successful for {target_user["email"]}. User will be required to change password on next login.',
        temporary_password=new_password
    )

# User - Change Password (for force_password_change flow)
@api_router.post('/auth/change-password')
async def change_password(password_data: PasswordChangeRequest, user: dict = Depends(get_current_user)):
    """
    User endpoint to change their own password.
    If force_password_change is TRUE, this will also set it to FALSE after successful change.
    """
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Get current password hash
        current_user = await conn.fetchrow(
            'SELECT password_hash FROM users WHERE id = $1',
            uuid.UUID(user['id'])
        )
        
        if not current_user:
            raise HTTPException(status_code=404, detail='User not found')
        
        # Verify current password
        if not verify_password(password_data.current_password, current_user['password_hash']):
            raise HTTPException(status_code=400, detail='Current password is incorrect')
        
        # Validate new password strength
        new_pass = password_data.new_password
        if len(new_pass) < 8:
            raise HTTPException(status_code=400, detail='New password must be at least 8 characters')
        if not any(c.isupper() for c in new_pass):
            raise HTTPException(status_code=400, detail='New password must contain at least one uppercase letter')
        if not any(c.islower() for c in new_pass):
            raise HTTPException(status_code=400, detail='New password must contain at least one lowercase letter')
        if not any(c.isdigit() for c in new_pass):
            raise HTTPException(status_code=400, detail='New password must contain at least one number')
        
        # Update password and clear force_password_change flag
        new_hash = hash_password(new_pass)
        await conn.execute(
            '''UPDATE users 
               SET password_hash = $1, plain_password = NULL, force_password_change = FALSE 
               WHERE id = $2''',
            new_hash, uuid.UUID(user['id'])
        )
    
    await log_activity(user['id'], user['email'], 'PASSWORD_CHANGED', 'User changed their password')
    
    return {'success': True, 'message': 'Password changed successfully'}

# Admin - Analytics
@api_router.get('/admin/analytics/overview')
async def get_analytics_overview(admin: dict = Depends(get_admin_user)):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        total_users = await conn.fetchval('SELECT COUNT(*) FROM users')
        active_users = await conn.fetchval("SELECT COUNT(*) FROM users WHERE status = 'active'")
        deactive_users = await conn.fetchval("SELECT COUNT(*) FROM users WHERE status IN ('suspended', 'deactive')")
        
        total_messages = await conn.fetchval('SELECT COUNT(*) FROM message_logs')
        sent_messages = await conn.fetchval("SELECT COUNT(*) FROM message_logs WHERE status = 'sent'")
        failed_messages = await conn.fetchval("SELECT COUNT(*) FROM message_logs WHERE status = 'failed'")
        
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        messages_today = await conn.fetchval(
            'SELECT COUNT(*) FROM message_logs WHERE created_at >= $1',
            today
        )
    
    return {
        'users': {
            'total': total_users,
            'active': active_users,
            'deactive': deactive_users
        },
        'messages': {
            'total': total_messages,
            'sent': sent_messages,
            'failed': failed_messages,
            'today': messages_today,
            'success_rate': round((sent_messages / total_messages * 100) if total_messages > 0 else 0, 2)
        }
    }

@api_router.get('/admin/analytics/messages')
async def get_message_analytics(admin: dict = Depends(get_admin_user), days: int = 7):
    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        results = await conn.fetch('''
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
            FROM message_logs 
            WHERE created_at >= $1
            GROUP BY DATE(created_at)
            ORDER BY date
        ''', from_date)
    
    return [{'_id': str(r['date']), 'total': r['total'], 'sent': r['sent'], 'failed': r['failed']} for r in results]

@api_router.get('/admin/analytics/users-activity')
async def get_users_activity(admin: dict = Depends(get_admin_user), days: int = 7):
    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        results = await conn.fetch('''
            SELECT ml.user_id, COUNT(*) as message_count, u.email
            FROM message_logs ml
            LEFT JOIN users u ON ml.user_id = u.id
            WHERE ml.created_at >= $1
            GROUP BY ml.user_id, u.email
            ORDER BY message_count DESC
            LIMIT 10
        ''', from_date)
    
    return [{'_id': str(r['user_id']), 'message_count': r['message_count'], 'email': r['email'] or 'Unknown'} for r in results]

# Admin - System Status
@api_router.get('/admin/system/status')
async def get_system_status(admin: dict = Depends(get_admin_user)):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/health', timeout=aiohttp.ClientTimeout(total=5)) as response:
                whatsapp_health = await response.json()
                whatsapp_status = 'healthy' if response.status == 200 else 'unhealthy'
    except Exception:
        whatsapp_status = 'unreachable'
        whatsapp_health = {}
    
    try:
        result = subprocess.run(['supervisorctl', 'status'], capture_output=True, text=True, timeout=5)
        services = []
        for line in result.stdout.split('\n'):
            if line.strip():
                parts = line.split()
                if len(parts) >= 2:
                    services.append({
                        'name': parts[0],
                        'status': parts[1],
                        'uptime': ' '.join(parts[4:]) if len(parts) > 4 else 'N/A'
                    })
    except Exception:
        services = []
    
    return {
        'whatsapp_service': {
            'status': whatsapp_status,
            'health': whatsapp_health
        },
        'services': services,
        'database': 'postgresql',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }

# Admin - WhatsApp Sessions
@api_router.get('/admin/whatsapp/sessions')
async def get_whatsapp_sessions(admin: dict = Depends(get_admin_user)):
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/admin/sessions') as response:
                data = await response.json()
                
                pool = await get_db_pool()
                enriched_sessions = []
                for sess in data.get('sessions', []):
                    user_id = sess.get('userId') or sess.get('odlUserId')
                    if user_id:
                        async with pool.acquire() as conn:
                            user = await conn.fetchrow('SELECT email FROM users WHERE id = $1', uuid.UUID(user_id))
                        sess['userEmail'] = user['email'] if user else 'Unknown'
                    enriched_sessions.append(sess)
                
                return {
                    'sessions': enriched_sessions,
                    'total': len(enriched_sessions)
                }
    except aiohttp.ClientError:
        return {'sessions': [], 'total': 0, 'error': 'WhatsApp service unavailable'}
    except Exception as e:
        return {'sessions': [], 'total': 0, 'error': str(e)}

@api_router.post('/admin/whatsapp/disconnect/{user_id}')
async def admin_disconnect_user_whatsapp(user_id: str, admin: dict = Depends(get_admin_user)):
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f'{WHATSAPP_SERVICE_URL}/disconnect', json={'userId': user_id}) as response:
                result = await response.json()
        
        await log_activity(admin['id'], admin['email'], 'WHATSAPP_DISCONNECTED', f'Admin disconnected WhatsApp for user {user_id}')
        return result
    except aiohttp.ClientError:
        raise HTTPException(status_code=503, detail='WhatsApp service unavailable')
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post('/admin/whatsapp/disconnect')
async def admin_disconnect_whatsapp(admin: dict = Depends(get_admin_user)):
    return {'message': 'Use /admin/whatsapp/disconnect/{user_id} for per-user disconnect'}

# Admin - Settings
@api_router.get('/admin/settings')
async def get_settings(admin: dict = Depends(get_admin_user)):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        settings = await conn.fetchrow("SELECT * FROM settings WHERE id = 'global_settings'")
    
    if not settings:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                '''INSERT INTO settings (id, default_rate_limit, max_rate_limit, enable_registration, maintenance_mode, updated_at)
                   VALUES ($1, $2, $3, $4, $5, $6)''',
                'global_settings', 30, 100, True, False, datetime.now(timezone.utc)
            )
            settings = await conn.fetchrow("SELECT * FROM settings WHERE id = 'global_settings'")
    
    return record_to_dict(settings)

@api_router.put('/admin/settings')
async def update_settings(updates: dict, admin: dict = Depends(get_admin_user)):
    allowed_fields = ['default_rate_limit', 'max_rate_limit', 'enable_registration', 'maintenance_mode']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail='No valid fields to update')
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        # Build dynamic update query
        set_clauses = ['updated_at = $1']
        values = [datetime.now(timezone.utc)]
        
        for i, (key, value) in enumerate(update_data.items(), start=2):
            set_clauses.append(f"{key} = ${i}")
            values.append(value)
        
        query = f"UPDATE settings SET {', '.join(set_clauses)} WHERE id = 'global_settings'"
        await conn.execute(query, *values)
    
    await log_activity(admin['id'], admin['email'], 'SETTINGS_UPDATED', f'Updated settings: {update_data}')
    return {'success': True, 'message': 'Settings updated'}

# Admin - Activity Logs
@api_router.get('/admin/logs')
async def get_activity_logs(admin: dict = Depends(get_admin_user), limit: int = 100, skip: int = 0):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        logs = await conn.fetch(
            'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
            limit, skip
        )
        total = await conn.fetchval('SELECT COUNT(*) FROM activity_logs')
    
    logs_list = []
    for log in logs:
        log_dict = record_to_dict(log)
        log_dict['id'] = str(log_dict['id'])
        log_dict['user_id'] = str(log_dict['user_id'])
        logs_list.append(log_dict)
    
    return {'logs': logs_list, 'total': total}

# WhatsApp Endpoints
@api_router.post('/whatsapp/initialize')
async def initialize_whatsapp(user: dict = Depends(get_current_user)):
    try:
        async with aiohttp.ClientSession() as session:
            try:
                async with session.get(f'{WHATSAPP_SERVICE_URL}/health', timeout=aiohttp.ClientTimeout(total=5)) as health_response:
                    if health_response.status != 200:
                        raise HTTPException(status_code=503, detail='WhatsApp service is not healthy')
            except Exception as e:
                raise HTTPException(status_code=503, detail=f'WhatsApp service is unavailable: {str(e)}')
            
            async with session.post(f'{WHATSAPP_SERVICE_URL}/initialize', json={'userId': user['id']}) as response:
                data = await response.json()
                await log_activity(user['id'], user['email'], 'WHATSAPP_INITIALIZED', 'Initialized WhatsApp connection')
                return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get('/whatsapp/status')
async def whatsapp_status(user: dict = Depends(get_current_user)):
    try:
        timeout = aiohttp.ClientTimeout(total=5)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/status?userId={user["id"]}') as response:
                data = await response.json()
                return data
    except aiohttp.ClientError:
        return {'status': 'disconnected', 'connected': False, 'error': 'WhatsApp service unavailable'}
    except Exception as e:
        return {'status': 'error', 'connected': False, 'error': str(e)}

@api_router.get('/whatsapp/qr')
async def get_qr(user: dict = Depends(get_current_user)):
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/qr?userId={user["id"]}') as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    raise HTTPException(status_code=404, detail='QR code not available')
    except aiohttp.ClientError:
        raise HTTPException(status_code=503, detail='WhatsApp service unavailable')

@api_router.post('/whatsapp/disconnect')
async def disconnect_whatsapp(user: dict = Depends(get_current_user)):
    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(f'{WHATSAPP_SERVICE_URL}/disconnect', json={'userId': user['id']}) as response:
                data = await response.json()
                await log_activity(user['id'], user['email'], 'WHATSAPP_DISCONNECTED', 'Disconnected WhatsApp')
                return data
    except aiohttp.ClientError:
        raise HTTPException(status_code=503, detail='WhatsApp service unavailable')

@api_router.post('/messages/send')
async def send_message(msg: MessageSend, user: dict = Depends(get_current_user)):
    formatted_number = msg.number
    if not formatted_number.startswith('+'):
        formatted_number = '+91' + formatted_number
    
    message_id = uuid.uuid4()
    
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f'{WHATSAPP_SERVICE_URL}/send',
                json={'userId': user['id'], 'number': formatted_number, 'message': msg.message}
            ) as response:
                result = await response.json()
                
                pool = await get_db_pool()
                async with pool.acquire() as conn:
                    if response.status == 200 and result.get('success'):
                        await conn.execute(
                            '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                            message_id, uuid.UUID(user['id']), formatted_number, msg.message, 'sent', 'web', datetime.now(timezone.utc)
                        )
                        return {'status': 'success', 'to': formatted_number, 'message': 'Message sent successfully'}
                    else:
                        await conn.execute(
                            '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                            message_id, uuid.UUID(user['id']), formatted_number, msg.message, 'failed', 'web', datetime.now(timezone.utc)
                        )
                        error_msg = result.get('error', 'Failed to send message')
                        raise HTTPException(status_code=400, detail=error_msg)
    except aiohttp.ClientError:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                message_id, uuid.UUID(user['id']), formatted_number, msg.message, 'failed', 'web', datetime.now(timezone.utc)
            )
        raise HTTPException(status_code=503, detail='WhatsApp service unavailable')
    except HTTPException:
        raise
    except Exception as e:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                message_id, uuid.UUID(user['id']), formatted_number, msg.message, 'failed', 'web', datetime.now(timezone.utc)
            )
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get('/send', response_model=MessageResponse)
async def send_message_api(api_key: str = Query(...), number: str = Query(...), msg: str = Query(...)):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        user = await conn.fetchrow('SELECT id, email, status FROM users WHERE api_key = $1', api_key)
    
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API key')
    
    user_dict = record_to_dict(user)
    user_dict['id'] = str(user_dict['id'])
    
    if user_dict.get('status') in ['suspended', 'deactive']:
        raise HTTPException(status_code=403, detail='Account is deactivated')
    
    formatted_number = number
    if not formatted_number.startswith('+'):
        formatted_number = '+91' + formatted_number
    
    message_id = uuid.uuid4()
    
    try:
        timeout = aiohttp.ClientTimeout(total=30)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(
                f'{WHATSAPP_SERVICE_URL}/send',
                json={'userId': user_dict['id'], 'number': formatted_number, 'message': msg}
            ) as response:
                result = await response.json()
                
                pool = await get_db_pool()
                async with pool.acquire() as conn:
                    if response.status == 200 and result.get('success'):
                        await conn.execute(
                            '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                            message_id, uuid.UUID(user_dict['id']), formatted_number, msg, 'sent', 'api', datetime.now(timezone.utc)
                        )
                        return MessageResponse(status='success', to=formatted_number, message='Message sent.')
                    else:
                        await conn.execute(
                            '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                               VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                            message_id, uuid.UUID(user_dict['id']), formatted_number, msg, 'failed', 'api', datetime.now(timezone.utc)
                        )
                        error_msg = result.get('error', 'Failed to send message')
                        raise HTTPException(status_code=400, detail=error_msg)
    except aiohttp.ClientError:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                message_id, uuid.UUID(user_dict['id']), formatted_number, msg, 'failed', 'api', datetime.now(timezone.utc)
            )
        raise HTTPException(status_code=503, detail='WhatsApp service unavailable')
    except HTTPException:
        raise
    except Exception as e:
        pool = await get_db_pool()
        async with pool.acquire() as conn:
            await conn.execute(
                '''INSERT INTO message_logs (id, user_id, receiver_number, message_body, status, source, created_at)
                   VALUES ($1, $2, $3, $4, $5, $6, $7)''',
                message_id, uuid.UUID(user_dict['id']), formatted_number, msg, 'failed', 'api', datetime.now(timezone.utc)
            )
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get('/messages/logs')
async def get_message_logs(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50
):
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        if status:
            logs = await conn.fetch(
                'SELECT * FROM message_logs WHERE user_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT $3',
                uuid.UUID(user['id']), status, limit
            )
        else:
            logs = await conn.fetch(
                'SELECT * FROM message_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
                uuid.UUID(user['id']), limit
            )
    
    logs_list = []
    for log in logs:
        log_dict = record_to_dict(log)
        log_dict['id'] = str(log_dict['id'])
        log_dict['user_id'] = str(log_dict['user_id'])
        logs_list.append(log_dict)
    
    return logs_list

@api_router.post('/keys/regenerate')
async def regenerate_api_key(user: dict = Depends(get_current_user)):
    new_key = secrets.token_urlsafe(32)
    
    pool = await get_db_pool()
    async with pool.acquire() as conn:
        await conn.execute('UPDATE users SET api_key = $1 WHERE id = $2', new_key, uuid.UUID(user['id']))
    
    await log_activity(user['id'], user['email'], 'API_KEY_REGENERATED', 'User regenerated API key')
    return {'api_key': new_key, 'message': 'API key regenerated successfully'}

# ============================================
# Socket.IO Event Handlers
# ============================================

@sio.event
async def connect(sid, environ):
    """Handle new socket connection"""
    logger.info(f"[Socket.IO] Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """Handle socket disconnection"""
    logger.info(f"[Socket.IO] Client disconnected: {sid}")
    # Clean up user session
    if sid in sid_to_user:
        user_id = sid_to_user[sid]
        del sid_to_user[sid]
        if user_id in user_sessions:
            user_sessions[user_id].discard(sid)
            if not user_sessions[user_id]:
                del user_sessions[user_id]

@sio.event
async def authenticate(sid, data):
    """Authenticate socket connection with JWT token"""
    try:
        token = data.get('token')
        if not token:
            await sio.emit('auth_error', {'error': 'Token required'}, room=sid)
            return
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        
        # Store user-sid mapping
        sid_to_user[sid] = user_id
        if user_id not in user_sessions:
            user_sessions[user_id] = set()
        user_sessions[user_id].add(sid)
        
        # Join user-specific room
        sio.enter_room(sid, f'user_{user_id}')
        
        logger.info(f"[Socket.IO] User {user_id} authenticated (sid: {sid})")
        await sio.emit('authenticated', {'userId': user_id, 'message': 'Authenticated successfully'}, room=sid)
        
    except jwt.ExpiredSignatureError:
        await sio.emit('auth_error', {'error': 'Token expired'}, room=sid)
    except jwt.InvalidTokenError:
        await sio.emit('auth_error', {'error': 'Invalid token'}, room=sid)
    except Exception as e:
        logger.error(f"[Socket.IO] Auth error: {e}")
        await sio.emit('auth_error', {'error': str(e)}, room=sid)

# Helper function to emit events to specific user
async def emit_to_user(user_id: str, event: str, data: dict):
    """Emit event to all sockets of a specific user"""
    room = f'user_{user_id}'
    await sio.emit(event, data, room=room)
    logger.info(f"[Socket.IO] Emitted '{event}' to user {user_id}")

# Internal API endpoint for WhatsApp service to send events
@api_router.post('/internal/ws-event')
async def receive_whatsapp_event(event_data: dict):
    """
    Receive events from WhatsApp service and broadcast via Socket.IO
    Events: qr_code, whatsapp_connected, whatsapp_disconnected
    """
    event_type = event_data.get('event')
    user_id = event_data.get('userId')
    data = event_data.get('data', {})
    
    if not event_type or not user_id:
        raise HTTPException(status_code=400, detail='Missing event or userId')
    
    # Emit to user's room via Socket.IO
    await emit_to_user(user_id, event_type, data)
    
    return {'success': True, 'event': event_type, 'userId': user_id}

# Include router
app.include_router(api_router)

# Add CORS middleware to FastAPI app BEFORE wrapping with Socket.IO
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Socket.IO ASGI app wrapping FastAPI
# Use /api/socket.io path for Kubernetes ingress compatibility
socket_app = socketio.ASGIApp(sio, app, socketio_path='/api/socket.io')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
