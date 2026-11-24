FROM node:22-alpine AS build
WORKDIR /workspace
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci
RUN npm run build:common && npm run build:order

FROM node:22-alpine AS runtime
WORKDIR /workspace
ENV NODE_ENV=production
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api-gateway/package.json ./apps/api-gateway/package.json
COPY apps/inventory-service/package.json ./apps/inventory-service/package.json
COPY apps/notification-service/package.json ./apps/notification-service/package.json
COPY apps/order-service/package.json ./apps/order-service/package.json
COPY apps/payment-service/package.json ./apps/payment-service/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY libs/common/package.json ./libs/common/package.json
COPY libs/contracts/package.json ./libs/contracts/package.json
COPY libs/testing/package.json ./libs/testing/package.json
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /workspace/libs/common/dist ./libs/common/dist
COPY --from=build /workspace/apps/order-service/dist ./apps/order-service/dist
EXPOSE 3001
CMD ["node", "apps/order-service/dist/main.js"]
