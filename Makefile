.PHONY: help dev setup migrate seed reset docker-up docker-down docker-logs test clean

# Default target
help:
	@echo ""
	@echo "  SMX Studio — available targets"
	@echo ""
	@echo "  make setup        Install dependencies + copy .env"
	@echo "  make dev          Start all services in development mode"
	@echo "  make migrate      Run all pending database migrations"
	@echo "  make seed         Insert seed data (workspace, admin user, sample campaign)"
	@echo "  make reset        Drop DB + re-migrate + re-seed"
	@echo "  make docker-up    Start Postgres + Redis via docker-compose"
	@echo "  make docker-down  Stop and remove containers"
	@echo "  make docker-logs  Tail container logs"
	@echo "  make test         Run all test suites"
	@echo "  make clean        Remove node_modules and build artefacts"
	@echo ""

# ── Local development ─────────────────────────────────────────────────────────

setup:
	@cp -n .env.example .env || true
	pnpm install
	@echo "✓  Dependencies installed. Edit .env then run: make docker-up && make migrate && make seed"

dev: docker-up
	pnpm --parallel -r run dev

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	node scripts/migrate.mjs

seed:
	node scripts/seed.mjs

reset:
	@echo "⚠  Dropping and recreating database..."
	@psql "$$DATABASE_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null || \
	  docker exec smx_postgres psql -U smx -d smx_studio -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) migrate
	$(MAKE) seed

# ── Docker ────────────────────────────────────────────────────────────────────

docker-up:
	docker-compose up -d postgres redis
	@echo "⏳  Waiting for Postgres to be ready..."
	@until docker exec smx_postgres pg_isready -U smx -d smx_studio >/dev/null 2>&1; do sleep 1; done
	@echo "✓  Postgres ready"

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-full:
	docker-compose up -d --build

# ── Testing ───────────────────────────────────────────────────────────────────

test:
	pnpm -r run test

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +
	find . -name 'dist' -type d -prune -exec rm -rf '{}' +
	@echo "✓  Cleaned"
