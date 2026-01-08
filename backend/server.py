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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    api_key: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

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

class MessageLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    receiver_number: str
    message_body: str
    status: str  # sent, delivered, failed
    source: str  # web, api
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageSend(BaseModel):
    number: str
    message: str

class MessageResponse(BaseModel):
    status: str
    to: str
    message: str

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
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
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Invalid token')

async def verify_api_key(api_key: str = Header(...)):
    user = await db.users.find_one({'api_key': api_key}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API key')
    return user

@api_router.post('/auth/register', response_model=UserResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({'email': user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    
    user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password)
    )
    
    doc = user.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    
    return UserResponse(
        id=user.id,
        email=user.email,
        created_at=user.created_at,
        api_key=user.api_key
    )

@api_router.post('/auth/login')
async def login(credentials: UserLogin):
    user = await db.users.find_one({'email': credentials.email}, {'_id': 0})
    if not user or not verify_password(credentials.password, user['password_hash']):
        raise HTTPException(status_code=401, detail='Invalid credentials')
    
    token = create_access_token(user['id'], user['email'])
    return {
        'access_token': token,
        'token_type': 'bearer',
        'user': {
            'id': user['id'],
            'email': user['email'],
            'api_key': user['api_key']
        }
    }

@api_router.get('/auth/me', response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return UserResponse(
        id=user['id'],
        email=user['email'],
        created_at=datetime.fromisoformat(user['created_at']),
        api_key=user['api_key']
    )

@api_router.post('/whatsapp/initialize')
async def initialize_whatsapp(user: dict = Depends(get_current_user)):
    async with aiohttp.ClientSession() as session:
        async with session.post(f'{WHATSAPP_SERVICE_URL}/initialize') as response:
            data = await response.json()
            return data

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
    # Verify API key from query parameter
    user = await db.users.find_one({'api_key': api_key}, {'_id': 0, 'password_hash': 0})
    if not user:
        raise HTTPException(status_code=401, detail='Invalid API key')
    
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
