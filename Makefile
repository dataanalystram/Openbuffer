# HuhQueue: one-command local setup. Needs Python 3.10+ (Node only for `make web`, Docker only for `make docker`).
#   make run      first run creates .venv, installs, copies .env.example -> .env, starts http://localhost:8787
#   make demo     same, with the fake "Demo" network and sample posts (no real accounts needed)
#   make docker   docker compose up -d --build
PY ?= python3
VENV := .venv
BIN := $(VENV)/bin

.PHONY: setup run demo test web docker docker-logs clean-venv

$(BIN)/huhqueue: pyproject.toml
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -q --upgrade pip
	$(BIN)/pip install -q -e .
	@touch $@

.env:
	cp .env.example .env
	@echo "Created .env from .env.example (edit it to add network app keys, or paste them later in Settings > App keys)."

setup: $(BIN)/huhqueue .env

run: setup
	$(BIN)/huhqueue serve

demo: setup
	HUHQ_ENABLE_FAKE=1 $(BIN)/python scripts/demo_seed.py
	HUHQ_ENABLE_FAKE=1 $(BIN)/huhqueue serve

test: setup
	$(BIN)/pip install -q -r requirements-dev.txt
	$(BIN)/python -m pytest tests --ignore=tests/e2e

# Rebuild the committed UI bundle (huhqueue/static/app) after editing web/src.
web:
	cd web && npm install --no-audit --no-fund && npm run build

docker: .env
	docker compose up -d --build
	@echo "HuhQueue is starting on http://localhost:8787 (logs: make docker-logs)"

docker-logs:
	docker compose logs -f

clean-venv:
	rm -rf $(VENV)
