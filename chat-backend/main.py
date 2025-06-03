"""
FastAPI backend for the AI Chat functionality.
Provides endpoints for chat message processing with simulated AI responses.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, TypeVar
import asyncio
import random
import uuid
ChatEngine = TypeVar('ChatEngine')
Chain = TypeVar('Chain')
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate


document_chunks = [
    "(89%) showed an inverse correlation with at least one climatological variable (18 studies, or 69% statistically significant), compared with 10 (39%) showing a positive correlation (six studies, or 23% statistically significant) with at least one climatological variable (Table 1). According to the pooled GEE analysis, low values of all climatological variables predicted increased monthly incidence of rotavirus disease in patients with gastroenteritis.",
    "According to the pooled GEE analysis, low values of all climatological variables predicted increased monthly incidence of rotavirus disease in patients with gastroenteritis. Using data on the total number of monthly rotavirus cases, rather than proportion of diarrhoea patients testing positive for rotavirus, avoided the potential for reporting on patterns driven by seasonal changes in other diarrhoea pathogens. However, we should note that similar results were found with both approaches (total case count and proportion of diarrhoea cases testing positive for rotavirus).",
    "diarrhoea pathogens. However, we should note that similar results were found with both approaches (total case count and proportion of diarrhoea cases testing positive for rotavirus). The effect of seasonal changes on rotavirus incidence seen here is not as extreme in the tropics as it is in temperate areas of the world. Rotavirus is found year-round in the tropics with peaks and valleys, whereas incidence often goes to zero in some months in temperate areas. One explanation for this phenomenon is that less climatic variability exists in tropical climates and zones, so variations in climatological variables are not large enough to cause the observed effect. Still, the",
    "climatic variability exists in tropical climates and zones, so variations in climatological variables are not large enough to cause the observed effect. Still, the fact that rotavirus persists year-round in tropical areas of the world, and that rotavirus responds to climatic changes in many different climatic zones throughout the world, suggests that it is not an absolute temperature or humidity level that favors rotavirus transmission, but rather a relative change in climatic conditions. We see a large amount of hete",
    "in many different climatic zones throughout the world, suggests that it is not an absolute temperature or humidity level that favors rotavirus transmission, but rather a relative change in climatic conditions. We see a large amount of heterogeneity both within and between studies in the pooled analysis. The significant unexplained variation is a limitation of the study. The heterogeneity suggests that we would expect to see a stronger effect, and therefore have greater predictive power, if we could reduce some of the sources of variation between the different studies reviewed, such as socioeconomic status of patients, age of patients, sampling scheme, diagnostic methods used,",
    "if we could reduce some of the sources of variation between the different studies reviewed, such as socioeconomic status of patients, age of patients, sampling scheme, diagnostic methods used, lengths of studies, numbers of participants sampled, populations of study regions and differing climatic conditions at each study location. Most studies included only children while others included patients",
    "of all ages. Also, the majority of studies reviewed were carried out for 2 years or less, which is a relatively short period of time to capture the effects of seasonality; studies of longer duration are preferable for establishing the relationship between climate and rotavirus disease. While all studies lie within the latitudes defined as the tropics, various climatic regimes (e.g. rainforest vs semi-arid)",
    "ing the relationship between climate and rotavirus disease. While all studies lie within the latitudes defined as the tropics, various climatic regimes (e.g. rainforest vs semi-arid) prevail in the different settings and at different altitudes, potentially confounding the results. We were unable to account for these differences in our analysis of potential covariates. Understanding rotavirus transmission The heterogeneity in effect observed in the pooled analysis is not surprising given that this analysis did not take into account additional factors potentially",
    "analysis is not surprising given that this analysis did not take into account additional factors potentially affecting rotavirus transmission, such as sanitation and hygiene practices or flood peaks. Several authors of the articles reviewed noted multiple peaks in rotavirus incidence as affected by the monsoon rains (Table 1). Flooding in conjunction with poor sanitation could augment the waterborne component of rotavirus transmission, obfuscating",
    "Flooding in conjunction with poor sanitation could augment the waterborne component of rotavirus transmission, obfuscating the seasonal patterns, which might be driven more by other routes of transmission, such as the air or fomites. Strong evidence suggests that rotavirus is a waterborne pathogen. The virus can retain its infectivity for several days in aqueous environments, and waterborne spread has been implicated in a number of rotavirus outbrea",
    "fomites. Strong evidence suggests that rotavirus is a waterborne pathogen. The virus can retain its infectivity for several days in aqueous environments, and waterborne spread has been implicated in a number of rotavirus outbreaks.7 However, the high rates of infection in the first 3 years of life regardless of sanitary conditions, the failure to document fecal-oral transmission in several outbreaks of rotavirus diarrhoea, and the dramatic spread of rotavirus over large geographic areas in the winter",
    "failure to document fecal-oral transmission in several outbreaks of rotavirus diarrhoea, and the dramatic spread of rotavirus over large geographic areas in the winter in temperate zones suggests that water alone may not be responsible for all rotavirus transmission.5 No direct evidence shows that fomites and environmental surfaces play a role in the spread of rotavirus gastroe",
    "No direct evidence shows that fomites and environmental surfaces play a role in the spread of rotavirus gastroenteritis, but indirect evidence shows that these possess a strong potential for spreading rotavirus gastroenteritis. Rotaviruses can remain viable on inanimate surfaces for several days when dried from a fecal suspension.7 Many authors have also suggested that rotavirus spreads through the air. In nosocomial outbreaks of rotavirus gastroenteritis, many patients show"
]

chunks_listed = "\n\n".join(f"Chunk {i + 1}) {chunk}" for i, chunk in enumerate(document_chunks))

class ChatBackend:
    def __init__(self, model_name: str = 'llama3.2:latest'):
        self.model_name = model_name
        self.model = ChatOllama(model=model_name, temperature=0.0, max_tokens=512)
        self.prompt = ChatPromptTemplate.from_template(
            """
            You are a helpful assistant. Your job is to answer the user's questions based on the provided document chunks and conversation history.
            A list fo document chunks is also provided. Your response should only be based on the conversation history and the document chunks. If you don't know the answer, say "I don't know".
            Do NOT make up an answer. Only include information from the conversation history and document chunks. Aditionally, you should mention which chunk number (or numbers) contain the information source of your answer". 
            Keep the answer to the question as factual and concise as possible.

            Document Chunks:
            {chunks_listed}

            Conversation History:
            {context}

            Question:
            {question}

            Answer:
            """
        )
        self.chain = self.prompt | self.model
        self.history = []

    def ask(self, question:str):
        context = "\n".join(
            f"User: {q}\nAI: {a}" for q, a in self.history
        ) if self.history else "The conversation has just begun."

        response = self.chain.invoke({"context": context, "question": question, "chunks_listed": chunks_listed})
        self.history.append((question, response.text().strip()))
        if len(self.history) > 5:
            self.history.pop(0)
        return response.text().strip()



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
chat_backend = ChatBackend(model_name='llama3.2:latest')

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
        # await asyncio.sleep(random.uniform(1.0, 3.0))

        # Generate AI response
        # ai_response_content = get_contextual_response(message.content)
        ai_response_content = chat_backend.ask(message.content)

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
