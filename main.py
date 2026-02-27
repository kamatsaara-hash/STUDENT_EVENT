# main.py

import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

app = FastAPI()

# ================= CORS =================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all domains
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# ================= CONFIG =================
MONGO_URI = os.getenv("MONGO_URI")

# ================= DATABASE =================
client = AsyncIOMotorClient(MONGO_URI)
db = client.get_default_database()

users_collection = db["users"]
events_collection = db["events"]
registrations_collection = db["registrations"]


# ================= SEED EVENTS =================
async def seed_events():
    events = [
        {"name": "Hackathon", "category": "Tech"},
        {"name": "Coding Contest", "category": "Tech"},
        {"name": "AI Workshop", "category": "Tech"},
        {"name": "Dance", "category": "Cultural"},
        {"name": "Music", "category": "Cultural"},
        {"name": "Drama", "category": "Cultural"},
        {"name": "Football", "category": "Sports"},
        {"name": "Cricket", "category": "Sports"},
        {"name": "Basketball", "category": "Sports"},
        {"name": "Photography", "category": "Other"},
        {"name": "Quiz", "category": "Other"},
        {"name": "Debate", "category": "Other"},
    ]

    for event in events:
        await events_collection.update_one(
            {"name": event["name"]},
            {"$set": event},
            upsert=True
        )

@app.on_event("startup")
async def startup_event():
    await seed_events()


# ================= ROUTES =================

# REGISTER USER (no password hashing now)
@app.post("/api/register")
async def register(data: dict):
    username = data.get("username")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")

    existing_user = await users_collection.find_one({
        "$or": [{"username": username}, {"email": email}]
    })

    if existing_user:
        raise HTTPException(status_code=400, detail="Username or Email already exists")

    user = {
        "username": username,
        "email": email,
        "phone": phone,
        "password": password,
        "createdAt": datetime.utcnow()
    }

    result = await users_collection.insert_one(user)

    return {
        "message": "User registered successfully",
        "id": str(result.inserted_id)
    }


# GET ALL EVENTS (open route)
@app.get("/api/events")
async def get_events():
    events = []
    async for event in events_collection.find():
        event["_id"] = str(event["_id"])
        events.append(event)

    return events


# REGISTER FOR EVENT (user_id must be sent manually)
@app.post("/api/register-event/{event_id}")
async def register_event(event_id: str, data: dict):

    user_id = data.get("user_id")

    existing = await registrations_collection.find_one({
        "user": user_id,
        "event": event_id
    })

    if existing:
        raise HTTPException(status_code=400, detail="Already registered for this event")

    registration = {
        "user": user_id,
        "event": event_id,
        "registeredAt": datetime.utcnow()
    }

    result = await registrations_collection.insert_one(registration)

    return {
        "message": "Event registered successfully",
        "id": str(result.inserted_id)
    }


# GET MY EVENTS (user_id passed manually)
@app.get("/api/my-events/{user_id}")
async def my_events(user_id: str):
    registrations = []

    async for reg in registrations_collection.find({"user": user_id}):
        event = await events_collection.find_one({"_id": ObjectId(reg["event"])})
        reg["_id"] = str(reg["_id"])
        reg["event"] = {
            "name": event["name"],
            "category": event["category"]
        }
        registrations.append(reg)

    return registrations


# ================= RUN SERVER =================
# Run using:
# uvicorn main:app --reload