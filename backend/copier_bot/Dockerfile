FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py .
RUN mkdir -p /app/state /app/commands /app/logs
CMD ["python3", "-u", "polydesk_copier_bot.py"]
