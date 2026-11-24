# Package install commands

**Prerequisites:** Node.js 20 LTS (or 22) with npm 10+, Git, Docker Desktop.
Run all commands from the project root: `C:\Users\ashis\OneDrive\Desktop\Project Ecommerce`.

Node.js/npm are not installed yet in this environment. Install Node.js 20 LTS first, then run the
commands below. Nothing has been installed so far.

Versions below are compatible major ranges chosen to keep the stack stable. No relational
database driver, ORM/code generator, native bcrypt, CDC tool or test-container library is used.

## 1. Root tooling (already declared in root `package.json`)

```powershell
npm install
```

Installs TypeScript 5, ESLint 9, Prettier 3 and the TypeScript ESLint plugins for all workspaces.

## 2. Shared backend runtime packages (all five backend services)

```powershell
npm install @nestjs/common@^10 @nestjs/core@^10 @nestjs/config@^3 @nestjs/swagger@^7 rxjs@^7 reflect-metadata@^0.2 class-validator@^0.14 class-transformer@^0.5 --workspace=@orderflow/api-gateway --workspace=@orderflow/order-service --workspace=@orderflow/inventory-service --workspace=@orderflow/payment-service --workspace=@orderflow/notification-service
```

## 3. Service-specific runtime packages

### API Gateway

```powershell
npm install @nestjs/jwt@^10 @nestjs/axios@^3 axios@^1 ioredis@^5 --workspace=@orderflow/api-gateway
```

### Order Service (identity, orders, saga, JWT signing)

```powershell
npm install @nestjs/jwt@^10 mongoose@^8 kafkajs@^2.2 bcryptjs@^2.4 --workspace=@orderflow/order-service
```

### Inventory Service (catalogue, stock, Redis cache)

```powershell
npm install mongoose@^8 kafkajs@^2.2 ioredis@^5 --workspace=@orderflow/inventory-service
```

### Payment Service

```powershell
npm install mongoose@^8 kafkajs@^2.2 --workspace=@orderflow/payment-service
```

### Notification Service

```powershell
npm install mongoose@^8 kafkajs@^2.2 --workspace=@orderflow/notification-service
```

## 4. Backend test tooling (all five backend services)

```powershell
npm install -D jest@^29 ts-jest@^29 @types/jest@^29 @types/node@^20 supertest@^7 @types/supertest@^6 --workspace=@orderflow/api-gateway --workspace=@orderflow/order-service --workspace=@orderflow/inventory-service --workspace=@orderflow/payment-service --workspace=@orderflow/notification-service
```

Types for bcryptjs (Order Service only):

```powershell
npm install -D @types/bcryptjs@^2.4 --workspace=@orderflow/order-service
```

## 5. Frontend (`apps/web`)

Runtime:

```powershell
npm install react@^18 react-dom@^18 react-router-dom@^6 @tanstack/react-query@^5 --workspace=@orderflow/web
```

Build/test tooling:

```powershell
npm install -D vite@^5 @vitejs/plugin-react@^4 tailwindcss@^3 postcss@^8 autoprefixer@^10 typescript@^5 @types/node@^20 @types/react@^18 @types/react-dom@^18 --workspace=@orderflow/web
```

## 6. Verification commands

```powershell
npm ls --workspaces --depth=0
npm run typecheck
npm run lint
npm run format:check
```

## 7. Local infrastructure (Phase 7 Dockerfiles/Compose not yet created)

```powershell
copy .env.example .env
docker compose -f deploy/docker-compose.infra.yml up -d
```

Compose will run MongoDB as a replica set `rs0`, Redis 7 and Kafka KRaft.

## 8. Git commands (identity and GitHub push)

The repository already exists at the project root with five commits. Use your GitHub identity:

```powershell
cd "C:\Users\ashis\OneDrive\Desktop\Project Ecommerce"
git config user.name "kashyap801"
git config user.email "ashish801kashyap@gmail.com"
git remote add origin https://github.com/kashyap801/orderflow.git
git push -u origin main
git log --oneline --decorate
```

If `origin` was already added, use `git remote set-url origin https://github.com/kashyap801/orderflow.git`
instead of `git remote add origin ...`.
