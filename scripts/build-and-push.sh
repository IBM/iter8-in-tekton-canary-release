#!/bin/bash

if [[ $# < 1  || $# > 1 ]]
then
  echo ""
  echo "Expected a single argument to be provided:"
  echo "Usage: build-and-push.sh <registry>"
  echo ""
  exit 1
fi

# Build and Push frontend 
docker build -t $1/iter8-front:v100 ./frontend
docker push $1/iter8-front:v100

# Build and Push backend v100
docker build -t $1/iter8-demo:v100 ./backend/backend-1.0.0
docker push $1/iter8-demo:v100

# Build and Push backend v101
docker build -t $1/iter8-demo:v101 ./backend/backend-1.0.1
docker push $1/iter8-demo:v101

# Build and Push backend v102
docker build -t $1/iter8-demo:v102 ./backend/backend-1.0.2
docker push $1/iter8-demo:v102
