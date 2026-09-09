#!/bin/sh
set -eux

COMPOSE_FILE=docker-compose.test.yml

echo "Building and running compose environment..."
docker-compose -f $COMPOSE_FILE up --build --exit-code-from runner --abort-on-container-exit

RC=$?
echo "Compose run finished with code $RC"
docker-compose -f $COMPOSE_FILE down -v
exit $RC
