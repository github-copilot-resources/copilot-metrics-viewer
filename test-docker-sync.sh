#!/bin/bash
# Test script for Dockerfile.sync
# Verifies that the sync container builds correctly

set -e

echo "🐳 Testing Dockerfile.sync build..."

# Build the sync container
echo "Building sync container..."
docker build -f Dockerfile.sync -t copilot-metrics-sync:test . 2>&1 | grep -E "(Step|Successfully|error|ERROR)" | tail -30

if [ $? -eq 0 ]; then
  echo "✅ Dockerfile.sync builds successfully"
else
  echo "❌ Dockerfile.sync build failed"
  exit 1
fi

# Verify the image was created
if docker images | grep -q "copilot-metrics-sync.*test"; then
  echo "✅ Docker image created successfully"
else
  echo "❌ Docker image not found"
  exit 1
fi

# Clean up
echo "🧹 Cleaning up..."
docker rmi copilot-metrics-sync:test 2>/dev/null || true

echo "✅ All Dockerfile.sync tests passed"
