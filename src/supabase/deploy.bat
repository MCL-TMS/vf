@echo off
echo 🚀 Deploying VF Logistics Dashboard to Supabase...

REM Check if Supabase CLI is installed
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI is not installed. Please install it first:
    echo npm install -g supabase
    exit /b 1
)

REM Check if user is logged in
supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ You are not logged in to Supabase. Please login first:
    echo supabase login
    exit /b 1
)

REM Link to project (if not already linked)
if not exist .supabase\config.toml (
    echo 🔗 Linking to Supabase project...
    supabase link --project-ref yIGCKJu8kSjqVVJYpu5CfJ
)

REM Push database migrations
echo 📦 Deploying database migrations...
supabase db push

REM Deploy edge functions
echo ⚡ Deploying edge functions...
supabase functions deploy server

echo ✅ Deployment completed successfully!
echo.
echo 🔍 You can test the deployment with:
echo curl https://yIGCKJu8kSjqVVJYpu5CfJ.supabase.co/functions/v1/server/make-server-201cacde/health