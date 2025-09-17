#!/bin/bash

set -e

echo "Starting the messaging service..."
echo "Environment: ${NODE_ENV:-development}"

# Build the TypeScript code
echo "Building application..."
npm run build

# Start the application
echo "Starting server on port ${PORT:-8080}..."
npm start 