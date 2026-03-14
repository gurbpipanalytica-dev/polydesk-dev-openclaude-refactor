# Shared base Dockerfile for all Polydesk Python bots
# Each bot folder gets its own copy of this file

FROM python:3.11-slim

# Don't buffer Python output — logs appear immediately in docker logs
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy bot script
COPY *.py .

# Create state/command/log dirs (mounted as volumes, but need to exist)
RUN mkdir -p /app/state /app/commands /app/logs

CMD ["python3", "-u", "polydesk_bond_bot.py"]
# Note: each bot folder overrides CMD in its own Dockerfile
