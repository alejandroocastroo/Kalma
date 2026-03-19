# Kalma — Gestión para Gimnasios y Estudios de Fitness

SaaS multi-tenant para administración de gimnasios y estudios de fitness en Colombia.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15 (App Router) + TypeScript + Tailwind CSS |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + Alembic |
| Base de datos | PostgreSQL 16 |
| Cache / Sesiones | Redis 7 |
| Auth | JWT (access + refresh tokens) |
| Proxy | Nginx |
| Infra | Docker + Docker Compose |
| DNS / Túnel | Cloudflare Tunnel |

## Estructura del Proyecto

```
kalma-app/
├── backend/                  # FastAPI API
│   ├── app/
│   │   ├── auth/             # JWT utilities
│   │   ├── middleware/       # Tenant middleware
│   │   ├── models/           # SQLAlchemy models
│   │   ├── routers/          # API routes
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── config.py
│   │   ├── database.py
│   │   └── main.py
│   ├── migrations/           # Alembic migrations
│   ├── seed.py               # Datos de ejemplo (Mantra Pilates)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # Next.js app
│   ├── src/
│   │   ├── app/
│   │   │   ├── (admin)/      # Panel de administración
│   │   │   │   ├── dashboard/
│   │   │   │   ├── agenda/
│   │   │   │   ├── clientes/
│   │   │   │   ├── caja/
│   │   │   │   └── clases/
│   │   │   ├── (landing)/
│   │   │   │   └── [slug]/   # Landing page pública por gym
│   │   │   └── login/
│   │   ├── components/
│   │   │   ├── admin/
│   │   │   ├── landing/
│   │   │   └── ui/           # Design system components
│   │   ├── lib/              # API client, auth, utils
│   │   └── types/
│   ├── package.json
│   └── Dockerfile
├── nginx/                    # Reverse proxy config
├── docker-compose.yml
├── .env.example
└── README.md
```

## Levantar el proyecto localmente

### Pre-requisitos

- Docker Desktop (para PostgreSQL y Redis)
- Python 3.12+
- Node.js 20+

### Desarrollo local (recomendado — solo 2 imágenes Docker)

Solo corres Postgres y Redis en Docker. Backend y frontend corren nativos — arrancan instantáneo, sin builds lentos.

**Paso 1 — Infraestructura (solo 2 imágenes pequeñas)**
```bash
docker compose -f docker-compose.dev.yml up -d
```
Descarga: `postgres:16-alpine` + `redis:7-alpine`. Eso es todo.

**Paso 2 — Backend**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Variables de entorno para dev
export DATABASE_URL="postgresql+asyncpg://kalma:kalmapassword@localhost:5432/kalma"
export REDIS_URL="redis://localhost:6379/0"
export SECRET_KEY="dev-secret-key-minimo-32-caracteres-ok"

alembic upgrade head   # crea las tablas
python seed.py         # datos de Mantra Pilates
uvicorn app.main:app --reload --port 8000
```

**Paso 3 — Frontend**
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

---

### Producción (Docker completo — 5 imágenes)

Solo para el VPS. Levanta todo: Postgres, Redis, backend, frontend y Nginx.

```bash
cp .env.example .env   # ajusta SECRET_KEY y passwords
docker compose up -d --build
```

### 3. Acceder a la app

| URL | Descripción |
|-----|-------------|
| http://localhost:3000 | Frontend (Next.js) |
| http://localhost:3000/login | Login del panel admin |
| http://localhost:3000/mantra | Landing page de Mantra Pilates |
| http://localhost:8000 | Backend (FastAPI) |
| http://localhost:8000/docs | Swagger / OpenAPI |
| http://localhost:8000/redoc | ReDoc |
| http://localhost:80 | Nginx (proxy) |

### 4. Credenciales de prueba (seed)

| Email | Password | Rol |
|-------|----------|-----|
| admin@mantra.com | mantra123 | Admin (Mantra Pilates) |
| instructora@mantra.com | mantra123 | Instructor |

## Desarrollo sin Docker

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Configurar base de datos local
export DATABASE_URL="postgresql+asyncpg://kalma:kalmapassword@localhost:5432/kalma"
export REDIS_URL="redis://:kalmaRedis123@localhost:6379/0"
export SECRET_KEY="dev-secret-key-minimo-32-caracteres-aqui"

# Correr migraciones
alembic upgrade head

# Seed datos
python seed.py

# Iniciar servidor
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Crear .env.local
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

npm run dev
```

## Multi-tenancy

El sistema usa **row-level multi-tenancy**: cada tabla tiene un `tenant_id` y todas las queries están filtradas por él.

El tenant se extrae en el siguiente orden de prioridad:
1. Header `X-Tenant-Slug` (para clientes API)
2. Subdominio del `Host` header: `mantra.usekalma.com` → slug `mantra`
3. Query param `?tenant=mantra` (solo para desarrollo)

## Arquitectura de dominios en producción

```
usekalma.com          → Landing de Kalma (marketing)
app.usekalma.com      → Panel admin (detecta tenant del usuario logueado)
mantra.usekalma.com   → Landing pública de Mantra Pilates
api.usekalma.com      → Backend API

# Custom domains (opcional, por gym)
mantra.com            → Mismo backend, tenant detectado por Host header
```

### Configurar Cloudflare Tunnel

```bash
# Instalar cloudflared en el VPS
curl -L --output cloudflared.deb \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared.deb

# Autenticar y crear túnel
cloudflared tunnel login
cloudflared tunnel create kalma

# Configurar ingress (config.yml)
cloudflared tunnel route dns kalma usekalma.com
cloudflared tunnel route dns kalma "*.usekalma.com"
```

## Despliegue en VPS (Ubuntu Server)

```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# 2. Clonar repo
git clone <repo> /opt/kalma
cd /opt/kalma

# 3. Configurar .env de producción
cp .env.example .env
nano .env  # Cambiar SECRET_KEY, passwords, ENVIRONMENT=production

# 4. Build y levantar
docker compose -f docker-compose.yml up -d --build

# 5. Ver logs
docker compose logs -f backend
```

## API Endpoints principales

```
POST   /api/v1/auth/login           # Login
POST   /api/v1/auth/refresh         # Refresh token
GET    /api/v1/auth/me              # Usuario actual

GET    /api/v1/class-types          # Tipos de clases
GET    /api/v1/class-sessions/week  # Agenda semanal
POST   /api/v1/appointments         # Agendar cita

GET    /api/v1/clients              # Lista de clientes
GET    /api/v1/payments/summary     # Resumen de caja

GET    /api/v1/public/{slug}/info   # Info pública del studio
GET    /api/v1/public/{slug}/schedule # Horario público
POST   /api/v1/public/{slug}/book   # Reserva desde landing page
```

Documentación completa: http://localhost:8000/docs

## Roadmap

- [ ] Integración WhatsApp Business API (confirmaciones y recordatorios)
- [ ] App móvil (React Native / Expo)
- [ ] Portal del cliente (reservas self-service)
- [ ] Membresías y paquetes de clases
- [ ] Reportes avanzados y exportación
- [ ] Pasarela de pagos (PSE, Nequi, Daviplata)
- [ ] Multi-idioma (ES/EN)

---

**Kalma** · usekalma.com · Hecho con ♥ para el ecosistema fitness colombiano
