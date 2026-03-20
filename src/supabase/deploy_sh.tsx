#!/bin/bash

echo "🚀 Deploying VF Logistics Dashboard to Supabase..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ You are not logged in to Supabase. Please login first:"
    echo "supabase login"
    exit 1
fi

# Link to project (if not already linked)
if [ ! -f .supabase/config.toml ]; then
    echo "🔗 Linking to Supabase project..."
    supabase link --project-ref yIGCKJu8kSjqVVJYpu5CfJ
fi

# Push database migrations
echo "📦 Deploying database migrations..."
supabase db push

# Deploy edge functions
echo "⚡ Deploying edge functions..."
supabase functions deploy server

echo "✅ Deployment completed successfully!"
echo ""
echo "🔍 You can test the deployment with:"
echo "curl https://yIGCKJu8kSjqVVJYpu5CfJ.supabase.co/functions/v1/server/make-server-201cacde/health"