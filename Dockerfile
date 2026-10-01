FROM python:3.12-alpine
WORKDIR /app
COPY index.html app.js styles.css logos.json ./
COPY logos/ ./logos/
EXPOSE 8080
CMD ["sh", "-c", "python -m http.server ${PORT:-8080}"]
