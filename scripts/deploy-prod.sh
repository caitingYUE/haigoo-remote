#!/bin/bash
echo "Starting deployment process..."

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo "Uncommitted changes detected. Please commit them first."
    git status
    exit 1
fi

echo "Pushing to git..."
git push

if [ $? -eq 0 ]; then
    echo "Git push successful."
    echo "Deploying to Vercel (Production)..."
    npx vercel --prod
else
    echo "Git push failed. Aborting deployment."
    exit 1
fi
