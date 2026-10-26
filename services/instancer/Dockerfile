FROM node:22-alpine

WORKDIR /app
RUN apk add --no-cache docker-cli docker-cli-buildx docker-cli-compose

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src ./src
COPY gateway ./gateway

ENV INSTANCER_PORT=7000
ENV INSTANCER_DATA_DIR=/data
EXPOSE 7000

CMD ["npm", "start"]
