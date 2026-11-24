# API Gateway

Single public entry point. Owns **no business database**.

Planned modules: auth proxy, JWT verification, RBAC, request validation, rate limiting (Redis),
correlation IDs, centralized errors, reverse proxy to the four domain services, Swagger entry point.
