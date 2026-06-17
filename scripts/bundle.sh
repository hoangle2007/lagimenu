#!/bin/bash

# Build the project
echo "Building the project..."
npm run build

# Remove existing zip
if [ -f "deploy.zip" ]; then
  rm deploy.zip
fi

# Create Zip
echo "Creating deployment zip..."
zip -r deploy.zip packages/backend/dist packages/backend/package.json packages/backend/.env packages/frontend/dist ecosystem.config.js package.json package-lock.json

echo "Done! Deployment zip created at deploy.zip"
