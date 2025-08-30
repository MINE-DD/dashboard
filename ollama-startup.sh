#!/bin/bash
echo "Starting Ollama server..."
ollama serve &

echo "Waiting for Ollama server to be active..."
while ! ollama list | grep -q 'NAME'; do
  sleep 1
done

echo "Pulling models..."
ollama pull llama3.2:latest

# Keep the server running
wait