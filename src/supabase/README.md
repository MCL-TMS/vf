# Supabase Integration for VF Logistics Dashboard

This directory contains the Supabase configuration and edge functions for the VF Logistics Dashboard.

## Setup Instructions

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to your Supabase project

```bash
supabase link --project-ref yIGCKJu8kSjqVVJYpu5CfJ
```

### 4. Deploy the database migrations

```bash
supabase db push
```

### 5. Deploy the edge functions

```bash
supabase functions deploy server
```

## Local Development

### 1. Start Supabase locally

```bash
supabase start
```

### 2. Deploy functions locally

```bash
supabase functions deploy server --no-verify-jwt
```

### 3. Test the function

```bash
curl http://127.0.0.1:54321/functions/v1/server/make-server-201cacde/health
```

## Troubleshooting

### 403 Deployment Error

If you encounter a 403 error during deployment:

1. Make sure you're logged in: `supabase login`
2. Check if you have the correct permissions on the Supabase project
3. Verify the project reference is correct: `supabase projects list`
4. Try re-linking the project: `supabase link --project-ref YOUR_PROJECT_REF`

### Environment Variables

Make sure these environment variables are set in your Supabase project:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Import Map Issues

If you encounter import issues, check that the `import_map.json` file is correctly configured and all dependencies are accessible.

## File Structure

```
supabase/
├── config.toml           # Supabase configuration
├── import_map.json       # Deno import map for edge functions
├── .env.example          # Environment variables template
├── functions/
│   ├── deno.json        # Deno configuration
│   └── server/
│       ├── index.tsx    # Main edge function
│       └── kv_store.tsx # Key-value store utilities
└── migrations/
    └── 20250120000000_create_kv_store.sql  # Database migration
```

## API Endpoints

- `GET /make-server-201cacde/health` - Health check endpoint

## Database Tables

- `kv_store_201cacde` - Key-value store for application data