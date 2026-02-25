FROM node:25-alpine3.22

WORKDIR /app

RUN addgroup -S app && \
    adduser -S -D -h /app app app

COPY package.json package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY . .
RUN mkdir -p public image sessions && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["npm", "run", "dev"]
