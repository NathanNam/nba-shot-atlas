# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/8bc2431a-ceef-4df5-9b2b-a84261007aca

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/8bc2431a-ceef-4df5-9b2b-a84261007aca) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/8bc2431a-ceef-4df5-9b2b-a84261007aca) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## OpenTelemetry Instrumentation

This project includes comprehensive OpenTelemetry instrumentation for observability:

### Features
- **Distributed Tracing**: Automatic instrumentation for HTTP requests, user interactions, and business operations
- **Structured Logging**: JSON-formatted logs with trace correlation
- **Custom Metrics**: NBA analytics-specific metrics including user engagement, feature usage, and performance metrics
- **Auto-instrumentation**: Built-in instrumentation for fetch requests, document load, and XMLHttpRequest

### Configuration

The application supports OpenTelemetry configuration via environment variables (primary method) with Supabase Edge Function fallback:

```bash
# Copy the example environment file
cp .env.example .env.local

# Edit the environment variables
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=https://your-otlp-endpoint
VITE_OTEL_EXPORTER_OTLP_BEARER_TOKEN=your_bearer_token
VITE_OTEL_SAMPLING_RATE=1.0
```

**Configuration Priority:**
1. **Environment Variables** (recommended): `VITE_OTEL_EXPORTER_OTLP_ENDPOINT` and `VITE_OTEL_EXPORTER_OTLP_BEARER_TOKEN`
2. **Supabase Edge Function**: Fallback if environment variables are not available
3. **Default**: `http://localhost:4318` for local development

### Testing OpenTelemetry

To test the OpenTelemetry setup:

1. Open the browser developer console
2. Run: `testOpenTelemetrySetup()`
3. Check the console for test results

### Metrics Tracked

The application tracks comprehensive NBA analytics metrics:
- User sessions and engagement duration
- Feature usage and interactions
- Shot chart interactions and comparisons
- API request performance and errors
- Page load times and user satisfaction scores

## Legacy Scripts

The migration to Supabase is complete. Archived migration utilities can be found under [`scripts/legacy/`](scripts/legacy/) if future reference is needed.
