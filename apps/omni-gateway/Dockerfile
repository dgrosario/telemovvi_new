FROM node:22-alpine AS base

WORKDIR /app

FROM base AS dependencies

# Forcar NODE_ENV=development para instalar devDependencies (nest cli)
ENV NODE_ENV=development

COPY package.json package-lock.json ./

RUN npm ci

FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM node:22-alpine AS production

LABEL org.opencontainers.image.source="https://github.com/Softtor/saascrm-gateway"
LABEL org.opencontainers.image.description="SaasCRM Gateway - WhatsApp/Instagram Message Processor"
LABEL org.opencontainers.image.licenses="UNLICENSED"

RUN apk add --no-cache wget

WORKDIR /app

# Copiar dist e node_modules da fase de build
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules

ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "dist/main"]
