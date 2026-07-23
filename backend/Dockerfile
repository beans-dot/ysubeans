# ===== Multi-stage build: NestJS backend =====
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# 프로덕션 구동 + 시딩(ts-node) 모두 지원하기 위해 전체 의존성 설치
COPY package*.json ./
RUN npm ci
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

EXPOSE 4000
CMD ["node", "dist/main.js"]
