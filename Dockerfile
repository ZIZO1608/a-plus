# Static site for Coolify: nginx serves the files, Coolify's proxy adds the domain and HTTPS.
FROM nginx:1.27.3-alpine

COPY . /usr/share/nginx/html
RUN cd /usr/share/nginx/html \
 && mkdir -p /etc/nginx/snippets \
 && mv nginx.conf /etc/nginx/conf.d/default.conf \
 && mv security-headers.conf /etc/nginx/snippets/security-headers.conf \
 && rm -f Dockerfile \
 && nginx -t

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
