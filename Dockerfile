# Site + live photo studio. Coolify's proxy adds the domain and HTTPS.
# Mount a volume at /data so uploaded photos survive redeploys (see DEPLOY.md).
FROM node:22.12.0-alpine

WORKDIR /app
COPY . .
RUN node --check server.js

ENV NODE_ENV=production PORT=80 DATA_DIR=/data
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
CMD ["node", "server.js"]
