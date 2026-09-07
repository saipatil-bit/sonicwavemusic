FROM python:3.11-slim

# Create a non-privileged system group and user
RUN groupadd -g 10001 appgroup && \
  useradd -u 10001 -g appgroup -s /bin/sh -m appuser

WORKDIR /app

# Copy assets and set ownership
COPY --chown=appuser:appgroup . .

# Expose port
EXPOSE 8080

# Environment variables
ENV PORT=8080 \
  PYTHONUNBUFFERED=1 \
  PYTHONDONTWRITEBYTECODE=1

# Run as non-root user
USER appuser

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/', timeout=2)" || exit 1

# Start the audio server
CMD ["python", "server.py"]
