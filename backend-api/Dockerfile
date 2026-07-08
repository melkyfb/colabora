FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY . .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir .

EXPOSE 8000

# Em dev o compose sobrescreve com --reload + bind-mount do codigo.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
