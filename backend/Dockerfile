
# Use an official Python runtime as a parent image
FROM python:3.9-slim

# Set the working directory in the container
WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Download the spaCy model directly (optimization for build time)
RUN python -m spacy download es_core_news_lg

# Copy the entire backend directory contents into the container at /app
COPY . .

# Make port 8000 available to the world outside this container
# Cloud Run expects port 8080 by default
EXPOSE 8080

# Run with Gunicorn -> Uvicorn for production
# Workers should be 1 for Cloud Run usually, handling concurrency via threads/async
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
