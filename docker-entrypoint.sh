#!/bin/bash
set -e

echo "🔨 Building frontend..."
cd /workspace/frontend

# Always install dependencies (volume may be empty on first run)
echo "📦 Installing frontend dependencies..."
npm install

# Build the frontend
echo "📦 Running vite build..."
npm run build

# Copy built files to public directory
cd /workspace
mkdir -p public
echo "📦 Copying built files to public/..."
cp -r frontend/dist/* public/

echo "✅ Frontend built successfully!"

# Start the Node.js server
echo "🚀 Starting server..."
cd /workspace
exec npm run dev
