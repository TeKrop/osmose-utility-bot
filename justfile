# Aliases

docker_compose := "docker compose"

# print recipe names and comments as help
help:
    @just --list

# build project image
build:
    @echo "Building osmose-utility-bot..."
    {{ docker_compose }} build

# build & run the bot (production mode)
up:
    @echo "Building osmose-utility-bot..."
    {{ docker_compose }} build
    @echo "Stopping osmose-utility-bot and cleaning containers..."
    {{ docker_compose }} down --remove-orphans
    @echo "Launching osmose-utility-bot..."
    {{ docker_compose }} up -d

# stop the bot and remove containers
down:
    @echo "Stopping osmose-utility-bot and cleaning containers..."
    {{ docker_compose }} down --remove-orphans

# stop the bot, remove containers and volumes (clean slate)
down_clean:
    @echo "Stopping osmose-utility-bot and cleaning containers and volumes..."
    {{ docker_compose }} down -v --remove-orphans

# clean up Docker environment
clean: down_clean
    @echo "Cleaning Docker environment..."
    docker image prune -af
    docker network prune -f

# show bot logs (live)
logs:
    {{ docker_compose }} logs -f

# access an interactive shell inside the app container
shell:
    @echo "Running shell on app container..."
    {{ docker_compose }} run --rm app /bin/sh

# update lock file
lock:
    {{ docker_compose }} run --no-deps --rm --volume ${PWD}:/code app npm install

# run npm audit
audit:
    {{ docker_compose }} run --no-deps --rm app npm audit

# run npm audit fix
audit_fix:
    {{ docker_compose }} run --no-deps --rm --volume ${PWD}:/code app npm audit fix
