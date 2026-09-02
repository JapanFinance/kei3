# Kei3

A website featuring various calculators. Currently, it has a [Japan take-home pay calculator](https://kei3.japanfinance.org/).

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm

### Installation

Install dependencies:
```bash
npm install
```

### Development

To start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (by default, unless the port is taken)

### Building for Production

To create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

### Preview the Production Build

```bash
npm run preview
```

### Testing

Run the test suite:

```bash
npm test
```

### Linting

Check code quality:

```bash
npm run lint
```

### Deployment

Build and deploy to production (`kei3.japanfinance.org`):

```bash
npm run deploy
```

#### Shared preview deployment

`preview.kei3.japanfinance.org` is served by a second Worker, `kei3-preview`,
and exists to gather feedback on unreleased changes from people outside the
project. It is stood up while something is actively being reviewed and taken
down afterwards, so a stale copy of the site is never left in public.

Build and deploy it, creating its custom domain and DNS record if they are
absent:

```bash
npm run deploy:preview
```

Take it down by deleting the custom domain from the `kei3-preview` Worker in the
Cloudflare dashboard, under Settings → Domains & Routes. That is the Worker's
only entry point, so removing it takes the site offline. Deleting the Worker
itself is not needed: an idle Worker is billed per request, and keeping it means
the command above is all that is required to bring the preview back.

Both deploy scripts build first, because `wrangler deploy` reads the deploy
target from the generated `dist/wrangler.json` rather than from `wrangler.toml`.
Deploying without rebuilding would send whichever target the previous build
wrote, so a production deploy following a preview build would go to the preview
Worker.

## Project Structure

- `src/` - Source code
- `public/` - Static assets
- `dist/` - Production build output
- `tests/` - Test files

