"""
FastAPI backend for the AI Chat functionality.
Provides endpoints for chat message processing with simulated AI responses.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, TypeVar
import uuid
from backend_llms import ChatBackend, get_llm_engine
ChatEngine = TypeVar('ChatEngine')
Chain = TypeVar('Chain')




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

llm = get_llm_engine()
print(f"Using: {llm} as the core LLM")

chat_backend = ChatBackend(llm, csv_file="Plan-EO_Dashboard_point_data.csv", use_simple_csv_agent=False)
print(f"Using: {type(chat_backend)} as the Chat Backend")



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

        # Generate AI response
        #ai_response_content = chat_backend.ask(message.content)
        ai_response_content = await chat_backend.ask(message.content)

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
                    content="Hello! I'm your AI assistant. How can I help you today??",
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
