"""
FastAPI backend for the AI Chat functionality.
Provides endpoints for chat message processing with simulated AI responses.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any
import asyncio
import random
import uuid

app = FastAPI(
    title="Mine DD Chat API",
    description="AI Chat backend for the Mine DD Dashboard",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000","https://mine-dd.github.io/dashboard"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class ChatMessage(BaseModel):
    content: str
    timestamp: datetime = None

    def __init__(self, **data):
        if data.get('timestamp') is None:
            data['timestamp'] = datetime.now()
        super().__init__(**data)

class ChatResponse(BaseModel):
    id: str
    type: str
    content: str
    timestamp: datetime

class ChatSession(BaseModel):
    session_id: str
    messages: List[ChatResponse] = []

# In-memory storage for demo purposes
chat_sessions: Dict[str, ChatSession] = {}

# Predefined responses based on content analysis
SAMPLE_RESPONSES = [
    "Thanks for your message! This is a placeholder response. In the future, I'll be able to help you with questions about the data and analysis.",
    "I can help you understand the pathogen distribution data shown on the map. What specific information are you looking for?",
    "The dashboard displays epidemiological data including pathogen prevalence, age groups, and geographical distribution. How can I assist you with interpreting this data?",
    "I notice you're interested in the Mine DD data. I can help explain the different filters and visualization options available. What would you like to know?",
    "This dashboard contains valuable epidemiological insights. I can help you navigate through the different data layers and understand the patterns. What's your specific question?",
    "The data shows various pathogens across different geographical regions. I can help you understand the prevalence patterns and risk factors. What would you like to explore?",
]

def get_contextual_response(message_content: str) -> str:
    """
    Generate a contextual response based on the user's message.
    This is a simplified version - in production, this would connect to an LLM.
    """
    content_lower = message_content.lower()

    # Check for specific keywords and provide relevant responses
    if any(word in content_lower for word in ['hello', 'hi', 'hey', 'greeting']):
        return "Hello! I'm your AI assistant for the Mine DD dashboard. I can help you understand the epidemiological data, explain the visualizations, and answer questions about pathogen distribution patterns. What would you like to know?"

    elif any(word in content_lower for word in ['pathogen', 'bacteria', 'virus', 'disease']):
        return "I can help you understand the pathogen data displayed on the map. The dashboard shows prevalence data for various pathogens across different geographical locations. You can filter by specific pathogens using the sidebar controls. What specific pathogen information are you looking for?"

    elif any(word in content_lower for word in ['map', 'location', 'geographical', 'region']):
        return "The map displays geographical distribution of epidemiological data points. Each point represents a study location with associated pathogen prevalence data. You can zoom, pan, and click on points to see detailed information. Would you like me to explain any specific aspect of the map visualization?"

    elif any(word in content_lower for word in ['filter', 'search', 'age', 'syndrome']):
        return "The dashboard provides several filtering options in the sidebar: you can filter by pathogen type, age groups, syndromes, and other parameters. These filters help you focus on specific subsets of the data. Which filter would you like to learn more about?"

    elif any(word in content_lower for word in ['data', 'statistics', 'prevalence', 'analysis']):
        return "The dataset contains epidemiological study results including prevalence rates, sample sizes, age distributions, and geographical coordinates. Each data point represents a scientific study with associated metadata. What specific aspect of the data analysis interests you?"

    elif any(word in content_lower for word in ['help', 'how', 'what', 'explain']):
        return "I'm here to help you navigate and understand the Mine DD dashboard. I can explain the data visualizations, help you use the filtering options, interpret the prevalence data, and answer questions about the epidemiological patterns shown. What specific area would you like assistance with?"

    else:
        # Return a random response for general messages
        return random.choice(SAMPLE_RESPONSES)

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Mine DD Chat API is running"}

@app.post("/chat/{session_id}/message", response_model=ChatResponse)
async def send_message(session_id: str, message: ChatMessage):
    """
    Send a message to the chat session and get an AI response.
    """
    try:
        # Create session if it doesn't exist
        if session_id not in chat_sessions:
            chat_sessions[session_id] = ChatSession(
                session_id=session_id,
                messages=[
                    ChatResponse(
                        id=str(uuid.uuid4()),
                        type="bot",
                        content="Hello! I'm your AI assistant. How can I help you today?",
                        timestamp=datetime.now()
                    )
                ]
            )

        session = chat_sessions[session_id]

        # Add user message to session
        user_message = ChatResponse(
            id=str(uuid.uuid4()),
            type="user",
            content=message.content,
            timestamp=message.timestamp or datetime.now()
        )
        session.messages.append(user_message)

        # Simulate thinking time (1-3 seconds)
        await asyncio.sleep(random.uniform(1.0, 3.0))

        # Generate AI response
        ai_response_content = get_contextual_response(message.content)

        ai_response = ChatResponse(
            id=str(uuid.uuid4()),
            type="bot",
            content=ai_response_content,
            timestamp=datetime.now()
        )

        session.messages.append(ai_response)

        return ai_response

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")

@app.get("/chat/{session_id}/messages", response_model=List[ChatResponse])
async def get_messages(session_id: str):
    """
    Get all messages for a chat session.
    """
    if session_id not in chat_sessions:
        # Create new session with welcome message
        chat_sessions[session_id] = ChatSession(
            session_id=session_id,
            messages=[
                ChatResponse(
                    id=str(uuid.uuid4()),
                    type="bot",
                    content="Hello! I'm your AI assistant. How can I help you today?",
                    timestamp=datetime.now()
                )
            ]
        )

    return chat_sessions[session_id].messages

@app.delete("/chat/{session_id}")
async def clear_session(session_id: str):
    """
    Clear a chat session.
    """
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        return {"status": "success", "message": f"Session {session_id} cleared"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.get("/chat/sessions")
async def get_sessions():
    """
    Get all active chat sessions (for debugging).
    """
    return {
        "active_sessions": len(chat_sessions),
        "sessions": list(chat_sessions.keys())
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4040)
