#!/usr/bin/env bash
# Script to run the QuickJS fuel calibration test in Docker
# Usage: ./scripts/run-fuel-calibration-test-docker.sh [options]
#
# Options:
#   --build              Force rebuild the Docker image
#   --shell              Start an interactive shell instead of running tests
#   --verbose            Show verbose output
#   --update-snapshots   Update test snapshots (useful for calibrating gas values)
#   --all                Run all tests, not just QuickJS-related ones

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IMAGE_NAME="blue-js-fuel-calibration-test"
DOCKERFILE_PATH="$PROJECT_ROOT/libs/document-processor/Dockerfile.test"

# Parse arguments
FORCE_BUILD=false
INTERACTIVE_SHELL=false
VERBOSE=false
UPDATE_SNAPSHOTS=false
RUN_ALL=false

for arg in "$@"; do
  case $arg in
    --build)
      FORCE_BUILD=true
      shift
      ;;
    --shell)
      INTERACTIVE_SHELL=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --update-snapshots)
      UPDATE_SNAPSHOTS=true
      shift
      ;;
    --all)
      RUN_ALL=true
      shift
      ;;
    *)
      ;;
  esac
done

cd "$PROJECT_ROOT"

# Check if image exists or force build is requested
if [[ "$FORCE_BUILD" == "true" ]] || ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building Docker image: $IMAGE_NAME"
  docker build \
    -f "$DOCKERFILE_PATH" \
    -t "$IMAGE_NAME" \
    ${VERBOSE:+--progress=plain} \
    .
fi

# Run the container
if [[ "$INTERACTIVE_SHELL" == "true" ]]; then
  echo "Starting interactive shell..."
  docker run --rm -it "$IMAGE_NAME" /bin/bash
else
  echo "Running fuel calibration test..."
  
  # Build the vitest command
  VITEST_ARGS=""
  
  if [[ "$UPDATE_SNAPSHOTS" == "true" ]]; then
    VITEST_ARGS="$VITEST_ARGS --update"
  fi
  
  if [[ "$RUN_ALL" == "true" ]]; then
    docker run --rm "$IMAGE_NAME" npx nx test document-processor --skip-nx-cache -- $VITEST_ARGS
  else
    docker run --rm "$IMAGE_NAME" npx nx test document-processor --skip-nx-cache -- --testNamePattern=QuickJS $VITEST_ARGS
  fi
fi

