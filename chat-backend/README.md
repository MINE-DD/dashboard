# AI Chat Backend

FastAPI backend service for the AI Chat functionality in the Mine DD Dashboard.

## Features

- RESTful API for chat messaging
- Session-based chat management
- Contextual AI responses based on dashboard content
- CORS support for frontend integration
- Health check endpoints
- Docker containerization

## API Endpoints

### Health Check
- `GET /` - Basic health check

### Chat Operations
- `POST /chat/{session_id}/message` - Send a message and get AI response
- `GET /chat/{session_id}/messages` - Get all messages for a session
- `DELETE /chat/{session_id}` - Clear a chat session
- `GET /chat/sessions` - Get all active sessions (debug)

## Development

### Running locally with Docker

From the root directory of the project:

```bash
docker compose up chat-backend
```

### Running locally without Docker

```bash
cd chat-backend
pip install -r requirements.txt
python main.py
```

The API will be available at `http://localhost:4040`

### API Documentation

When running, visit `http://localhost:4040/docs` for interactive API documentation.

## Environment Variables

See `.env` file for configuration options:

- `ENVIRONMENT` - Set to "development" or "production"
- `API_HOST` - Host to bind the API (default: 0.0.0.0)
- `API_PORT` - Port to run the API (default: 4040)
- `CORS_ORIGINS` - Comma-separated list of allowed origins

## Future Enhancements

- Integration with real AI/LLM services (OpenAI, Anthropic, Ollama)
- Persistent message storage (database)
- User authentication and authorization
- Rate limiting and usage monitoring
- Advanced contextual understanding of dashboard data
