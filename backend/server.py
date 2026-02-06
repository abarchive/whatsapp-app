from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import secrets
import aiohttp
import subprocess

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
WHATSAPP_SERVICE_URL = os.environ.get('WHATSAPP_SERVICE_URL', 'http://localhost:8002')

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    password_hash: str
    plain_password: Optional[str] = None  # Store plain password for admin view
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    api_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))
    role: str = "user"  # "user" or "admin"
    status: str = "active"  # "active" or "deactive"
    rate_limit: int = 30  # messages per hour

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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('sub')
        user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
        if not user:
            raise HTTPException(status_code=401, detail='User not found')
        # Check for deactive or suspended status
        if user.get('status') in ['suspended', 'deactive']:
            raise HTTPException(status_code=403, detail='Account is deactivated. Please contact administrator.')
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

async def get_admin_user(user: dict = Depends(get_current_user)):
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail='Admin access required')
    return user

async def verify_api_key(api_key: str = Header(...)):
    user = await db.users.find_one({'api_key': api_key}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API key')
    if user.get('status') in ['suspended', 'deactive']:
        raise HTTPException(status_code=403, detail='Account is deactivated')
    return user

async def log_activity(user_id: str, user_email: str, action: str, details: str, ip: Optional[str] = None):
    log = ActivityLog(
        user_id=user_id,
        user_email=user_email,
        action=action,
        details=details,
        ip_address=ip
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.activity_logs.insert_one(doc)

# Create default admin user
@app.on_event("startup")
async def create_default_admin():
    admin_exists = await db.users.find_one({'role': 'admin'})
    if not admin_exists:
        admin = User(
            email='admin@admin.com',
            password_hash=hash_password('Admin@7501'),
            role='admin',
            status='active',
            rate_limit=1000
        )
        doc = admin.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.users.insert_one(doc)
        logger.info('Default admin user created: admin@admin.com')

# Auth Endpoints
@api_router.post('/auth/register', response_model=UserResponse)
async def register(user_data: UserCreate):
    settings = await db.settings.find_one({'id': 'global_settings'})
    if settings and not settings.get('enable_registration', True):
        raise HTTPException(status_code=403, detail='Registration is currently disabled')
    
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    default_rate_limit = settings.get('default_rate_limit', 30) if settings else 30
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        rate_limit=default_rate_limit
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    await log_activity(user.id, user.email, 'USER_REGISTERED', 'New user registration')
    
    return UserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        api_key=user.api_key,
        role=user.role,
        status=user.status,
        rate_limit=user.rate_limit
    )

@api_router.post('/auth/login')
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    if user.get('status') == 'suspended':
        raise HTTPException(status_code=403, detail='Account suspended')
    
    token = create_access_token(user['id'], user['email'], user.get('role', 'user'))
    
    await log_activity(user['id'], user['email'], 'USER_LOGIN', 'User logged in')
    
    return {
        'access_token': token,
        'token_type': 'bearer',
        'user': {
            'id': user['id'],
            'email': user['email'],
            'api_key': user['api_key'],
            'role': user.get('role', 'user'),
            'status': user.get('status', 'active')
        }
    }

@api_router.get('/auth/me', response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user['id'],
        email=user['email'],
        created_at=datetime.fromisoformat(user['created_at']),
        api_key=user['api_key'],
        role=user.get('role', 'user'),
        status=user.get('status', 'active'),
        rate_limit=user.get('rate_limit', 30)
    )

# Admin - Users Management
@api_router.get('/admin/users')
async def get_all_users(admin: dict = Depends(get_admin_user), skip: int = 0, limit: int = 50):
    users = await db.users.find({}, {'_id': 0, 'password_hash': 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.users.count_documents({})
    return {'users': users, 'total': total}

@api_router.get('/admin/users/{user_id}')
async def get_user_by_id(user_id: str, admin: dict = Depends(get_admin_user)):
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    return user

@api_router.put('/admin/users/{user_id}')
async def update_user(user_id: str, updates: dict, admin: dict = Depends(get_admin_user)):
    allowed_fields = ['email', 'status', 'rate_limit', 'role']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not update_data:
        raise HTTPException(status_code=400, detail='No valid fields to update')
    
    result = await db.users.update_one({'id': user_id}, {'$set': update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='User not found')
    
    await log_activity(admin['id'], admin['email'], 'USER_UPDATED', f'Updated user {user_id}: {update_data}')
    return {'success': True, 'message': 'User updated'}

@api_router.delete('/admin/users/{user_id}')
async def delete_user(user_id: str, admin: dict = Depends(get_admin_user)):
    if user_id == admin['id']:
        raise HTTPException(status_code=400, detail='Cannot delete own account')
    
    result = await db.users.delete_one({'id': user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail='User not found')
    
    await log_activity(admin['id'], admin['email'], 'USER_DELETED', f'Deleted user {user_id}')
    return {'success': True, 'message': 'User deleted'}

@api_router.post('/admin/users')
async def create_user_by_admin(user_data: dict, admin: dict = Depends(get_admin_user)):
    email = user_data.get('email')
    password = user_data.get('password', 'Password@123')
    role = user_data.get('role', 'user')
    rate_limit = user_data.get('rate_limit', 30)
    
    if not email:
        raise HTTPException(status_code=400, detail='Email required')
    
    existing = await db.users.find_one({'email': email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already exists')
    
    user = User(
        email=email,
        password_hash=hash_password(password),
        role=role,
        rate_limit=rate_limit
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    await log_activity(admin['id'], admin['email'], 'USER_CREATED', f'Created user {email}')
    return {'success': True, 'user_id': user.id, 'email': email}

# Admin - Analytics
@api_router.get('/admin/analytics/overview')
async def get_analytics_overview(admin: dict = Depends(get_admin_user)):
    total_users = await db.users.count_documents({})
    active_users = await db.users.count_documents({'status': 'active'})
    suspended_users = await db.users.count_documents({'status': 'suspended'})
    
    total_messages = await db.message_logs.count_documents({})
    sent_messages = await db.message_logs.count_documents({'status': 'sent'})
    failed_messages = await db.message_logs.count_documents({'status': 'failed'})
    
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    messages_today = await db.message_logs.count_documents({
        'created_at': {'$gte': today.isoformat()}
    })
    
    return {
        'users': {
            'total': total_users,
            'active': active_users,
            'suspended': suspended_users
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
    
    pipeline = [
        {'$match': {'created_at': {'$gte': from_date.isoformat()}}},
        {'$group': {
            '_id': {'$substr': ['$created_at', 0, 10]},
            'total': {'$sum': 1},
            'sent': {'$sum': {'$cond': [{'$eq': ['$status', 'sent']}, 1, 0]}},
            'failed': {'$sum': {'$cond': [{'$eq': ['$status', 'failed']}, 1, 0]}}
        }},
        {'$sort': {'_id': 1}}
    ]
    
    results = await db.message_logs.aggregate(pipeline).to_list(days)
    return results

@api_router.get('/admin/analytics/users-activity')
async def get_users_activity(admin: dict = Depends(get_admin_user), days: int = 7):
    from_date = datetime.now(timezone.utc) - timedelta(days=days)
    
    pipeline = [
        {'$match': {'created_at': {'$gte': from_date.isoformat()}}},
        {'$group': {
            '_id': '$user_id',
            'message_count': {'$sum': 1}
        }},
        {'$sort': {'message_count': -1}},
        {'$limit': 10}
    ]
    
    results = await db.message_logs.aggregate(pipeline).to_list(10)
    
    # Get user emails
    for item in results:
        user = await db.users.find_one({'id': item['_id']}, {'email': 1})
        item['email'] = user['email'] if user else 'Unknown'
    
    return results

# Admin - System Status
@api_router.get('/admin/system/status')
async def get_system_status(admin: dict = Depends(get_admin_user)):
    try:
        # WhatsApp service health
        async with aiohttp.ClientSession() as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/health', timeout=aiohttp.ClientTimeout(total=5)) as response:
                whatsapp_health = await response.json()
                whatsapp_status = 'healthy' if response.status == 200 else 'unhealthy'
    except:
        whatsapp_status = 'unreachable'
        whatsapp_health = {}
    
    # Supervisor services status
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
    except:
        services = []
    
    return {
        'whatsapp_service': {
            'status': whatsapp_status,
            'health': whatsapp_health
        },
        'services': services,
        'database': 'connected',
        'timestamp': datetime.now(timezone.utc).isoformat()
    }

# Admin - WhatsApp Sessions
@api_router.get('/admin/whatsapp/sessions')
async def get_whatsapp_sessions(admin: dict = Depends(get_admin_user)):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/status') as response:
                status_data = await response.json()
    except:
        status_data = {'status': 'error', 'connected': False}
    
    return {
        'global_session': status_data,
        'note': 'Single WhatsApp connection for all users'
    }

@api_router.post('/admin/whatsapp/disconnect')
async def admin_disconnect_whatsapp(admin: dict = Depends(get_admin_user)):
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(f'{WHATSAPP_SERVICE_URL}/disconnect') as response:
                result = await response.json()
        
        await log_activity(admin['id'], admin['email'], 'WHATSAPP_DISCONNECTED', 'Admin disconnected WhatsApp')
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Admin - Settings
@api_router.get('/admin/settings')
async def get_settings(admin: dict = Depends(get_admin_user)):
    settings = await db.settings.find_one({'id': 'global_settings'}, {'_id': 0})
    if not settings:
        default_settings = Settings()
        doc = default_settings.model_dump()
        doc['updated_at'] = doc['updated_at'].isoformat()
        await db.settings.insert_one(doc)
        return default_settings.model_dump()
    return settings

@api_router.put('/admin/settings')
async def update_settings(updates: dict, admin: dict = Depends(get_admin_user)):
    updates['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {'id': 'global_settings'},
        {'$set': updates},
        upsert=True
    )
    
    await log_activity(admin['id'], admin['email'], 'SETTINGS_UPDATED', f'Updated settings: {updates}')
    return {'success': True, 'message': 'Settings updated'}

# Admin - Activity Logs
@api_router.get('/admin/logs')
async def get_activity_logs(admin: dict = Depends(get_admin_user), limit: int = 100, skip: int = 0):
    logs = await db.activity_logs.find({}, {'_id': 0}).sort('created_at', -1).limit(limit).skip(skip).to_list(limit)
    total = await db.activity_logs.count_documents({})
    return {'logs': logs, 'total': total}

# WhatsApp Endpoints (existing)
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
            
            async with session.post(f'{WHATSAPP_SERVICE_URL}/initialize') as response:
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
        async with aiohttp.ClientSession() as session:
            async with session.get(f'{WHATSAPP_SERVICE_URL}/status') as response:
                data = await response.json()
                return data
    except Exception as e:
        return {'status': 'error', 'connected': False, 'error': str(e)}

@api_router.get('/whatsapp/qr')
async def get_qr(user: dict = Depends(get_current_user)):
    async with aiohttp.ClientSession() as session:
        async with session.get(f'{WHATSAPP_SERVICE_URL}/qr') as response:
            if response.status == 200:
                data = await response.json()
                return data
            else:
                raise HTTPException(status_code=404, detail='QR code not available')

@api_router.post('/whatsapp/disconnect')
async def disconnect_whatsapp(user: dict = Depends(get_current_user)):
    async with aiohttp.ClientSession() as session:
        async with session.post(f'{WHATSAPP_SERVICE_URL}/disconnect') as response:
            data = await response.json()
            await log_activity(user['id'], user['email'], 'WHATSAPP_DISCONNECTED', 'Disconnected WhatsApp')
            return data

@api_router.post('/messages/send')
async def send_message(msg: MessageSend, user: dict = Depends(get_current_user)):
    formatted_number = msg.number
    if not formatted_number.startswith('+'):
        formatted_number = '+91' + formatted_number
    
    log = MessageLog(
        user_id=user['id'],
        receiver_number=formatted_number,
        message_body=msg.message,
        status='sending',
        source='web'
    )
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{WHATSAPP_SERVICE_URL}/send',
                json={'number': formatted_number, 'message': msg.message}
            ) as response:
                if response.status == 200:
                    log.status = 'sent'
                    doc = log.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    await db.message_logs.insert_one(doc)
                    return {'status': 'success', 'to': formatted_number, 'message': 'Message sent successfully'}
                else:
                    log.status = 'failed'
                    doc = log.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    await db.message_logs.insert_one(doc)
                    raise HTTPException(status_code=500, detail='Failed to send message')
    except Exception as e:
        log.status = 'failed'
        doc = log.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.message_logs.insert_one(doc)
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get('/send', response_model=MessageResponse)
async def send_message_api(api_key: str = Query(...), number: str = Query(...), msg: str = Query(...)):
    user = await db.users.find_one({'api_key': api_key}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API key')
    if user.get('status') == 'suspended':
        raise HTTPException(status_code=403, detail='Account suspended')
    
    formatted_number = number
    if not formatted_number.startswith('+'):
        formatted_number = '+91' + formatted_number
    
    log = MessageLog(
        user_id=user['id'],
        receiver_number=formatted_number,
        message_body=msg,
        status='sending',
        source='api'
    )
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{WHATSAPP_SERVICE_URL}/send',
                json={'number': formatted_number, 'message': msg}
            ) as response:
                if response.status == 200:
                    log.status = 'sent'
                    doc = log.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    await db.message_logs.insert_one(doc)
                    return MessageResponse(
                        status='success',
                        to=formatted_number,
                        message='Message sent.'
                    )
                else:
                    log.status = 'failed'
                    doc = log.model_dump()
                    doc['created_at'] = doc['created_at'].isoformat()
                    await db.message_logs.insert_one(doc)
                    raise HTTPException(status_code=500, detail='Failed to send message')
    except Exception as e:
        log.status = 'failed'
        doc = log.model_dump()
        doc['created_at'] = doc['created_at'].isoformat()
        await db.message_logs.insert_one(doc)
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get('/messages/logs')
async def get_message_logs(
    user: dict = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = 50
):
    query = {'user_id': user['id']}
    if status:
        query['status'] = status
    
    logs = await db.message_logs.find(query, {'_id': 0}).sort('created_at', -1).limit(limit).to_list(limit)
    return logs

@api_router.post('/keys/regenerate')
async def regenerate_api_key(user: dict = Depends(get_current_user)):
    new_key = secrets.token_urlsafe(32)
    await db.users.update_one(
        {'id': user['id']},
        {'$set': {'api_key': new_key}}
    )
    await log_activity(user['id'], user['email'], 'API_KEY_REGENERATED', 'User regenerated API key')
    return {'api_key': new_key, 'message': 'API key regenerated successfully'}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
