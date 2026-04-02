# ---- Development stage ----
FROM node:22-alpine AS development
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000 9229
CMD ["npx", "ts-node-dev", "--respawn", "--transpile-only", "--poll", "--inspect=0.0.0.0:9229", "src/main.ts"]

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS production
RUN apk add --no-cache ffmpeg
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["node", "dist/main.js"]
