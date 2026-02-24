FROM node:25-alpine3.22

WORKDIR /app

RUN addgroup -S app && \
    adduser -S -D -h /app app app

COPY . /app

RUN npm install && chown -R app:app /app

USER app

EXPOSE 3000

CMD ["npm", "run", "dev"]
