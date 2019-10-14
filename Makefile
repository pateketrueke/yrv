BROWSER ?= chrome
BASE_COMPOSE=-f ./docker/docker-compose.yml

help: Makefile
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-10s\033[0m %s\n", $$1, $$2}'

dev: src deps ## Start dev tasks
	@npm run dev & npm run serve

e2e: src deps  ## Run E2E tests locally
	@npm run test:e2e $(BROWSER) tests/e2e

test: src docker ## Run tests for CI
	@docker-compose $(BASE_COMPOSE) up -d chrome
	@docker exec e2e /home/docker/run-tests.sh

start: src docker ## Dev server for CI
	@docker-compose $(BASE_COMPOSE) up

build: ## Build image for docker
	@docker-compose $(BASE_COMPOSE) build

clean: ## Clean up test environment
	@docker-compose $(BASE_COMPOSE) down

deps: package*.json
	@(((ls node_modules | grep .) > /dev/null 2>&1) || npm i) || true
