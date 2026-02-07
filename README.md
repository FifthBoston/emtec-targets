# EmTec Targets

Premium SEM sputter target catalog powered by Neon Postgres.

![EmTec Targets](https://img.shields.io/badge/EmTec-Targets-blue)
![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Postgres](https://img.shields.io/badge/Postgres-Neon-purple)

## Features

- 🎯 **Database-Driven Catalog** — All target data served from Neon Postgres
- 🔍 **Advanced Filtering** — Filter by material, diameter, thickness, target type
- 📦 **Data Ingestion** — Automated parsing of Ted Pella catalog
- ⚡ **Fast API** — Express.js backend with efficient queries
- 🎨 **Modern UI** — Responsive design with real-time filtering

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** Neon Postgres (serverless)
- **Frontend:** Vanilla HTML/CSS/JS
- **Data Source:** Ted Pella catalog

## Quick Start

### Prerequisites

- Node.js 18+
- Neon Postgres account (or any Postgres database)

### Installation

```bash
# Clone the repository
git clone https://github.com/FifthBoston/emtec-targets.git
cd emtec-targets

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Neon connection string
# DATABASE_URL=postgresql://user:password@your-host.neon.tech/neondb?sslmode=require
```

### Database Setup

```bash
# Run migrations to create tables
npm run db:migrate
```

### Data Ingestion

```bash
# Import catalog from Ted Pella (customize source URL in .env)
npm run ingest
```

### Start Development Server

```bash
npm run dev
# Server runs at http://localhost:3000
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon Postgres connection string | Yes |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `BASE_URL` | Base URL for SEO (default: https://emtec-targets.com) | No |
| `TED_PELLA_SOURCE_URL` | Source catalog URL for ingestion | No |

## API Endpoints

### Targets

- `GET /api/targets` — List targets with filtering
  - Query params: `material`, `diameter`, `thickness`, `type`, `search`, `sort`, `order`, `limit`, `offset`
- `GET /api/targets/:id` — Get single target by ID

### Filters

- `GET /api/materials` — List available materials with counts
- `GET /api/diameters` — List available diameters
- `GET /api/thicknesses` — List available thicknesses

### Stats

- `GET /api/stats` — Catalog statistics
- `GET /api/health` — Health check

## Database Schema

### Tables

- **`sources`** — Tracks data sources (vendor, URL, last fetch)
- **`targets`** — Main catalog (part number, material, dimensions, etc.)
- **`materials`** — Reference table for material metadata

### Key Fields (targets)

| Field | Type | Description |
|-------|------|-------------|
| `part_number` | VARCHAR(50) | Unique product identifier |
| `target_type` | ENUM | 'disc' or 'annular' |
| `material` | VARCHAR(100) | Material name (Gold, Silver, etc.) |
| `purity` | VARCHAR(50) | Purity percentage (99.99%) |
| `diameter_mm` | DECIMAL | Diameter in millimeters |
| `outer_diameter_mm` | DECIMAL | OD for annular targets |
| `inner_diameter_mm` | DECIMAL | ID for annular targets |
| `thickness_mm` | DECIMAL | Thickness in millimeters |

## Project Structure

```
emtec-targets/
├── public/              # Static frontend files
│   ├── index.html       # Main HTML
│   ├── styles.css       # Styles
│   └── app.js           # Frontend JavaScript
├── scripts/
│   ├── migrate.js       # Database migrations
│   ├── ingest.js        # Data ingestion from source
│   └── seed.js          # (Optional) seed test data
├── server.js            # Express API server
├── package.json
├── .env.example         # Environment template
└── README.md
```

## Deployment

### Netlify (Recommended)

1. Connect repo to Netlify
2. Set build command: `npm install`
3. Set publish directory: `public`
4. Add environment variables in Netlify dashboard
5. Deploy!

Note: For full API functionality, deploy as a Node.js app (Render, Railway, etc.)

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## Troubleshooting

### "DATABASE_URL required"
Ensure your `.env` file exists and contains a valid Postgres connection string.

### Migration errors
Check that your Neon database is accessible and the connection string is correct.

### Ingestion returns 0 targets
The parsing logic may need customization for the actual Ted Pella page structure. Check the source URL and adjust parsing in `scripts/ingest.js`.

## Data Sources

| Source | URL | Data Type |
|--------|-----|-----------|
| Ted Pella | tedpella.com | Disc & Annular Targets |

See [SOURCES.md](SOURCES.md) for detailed attribution.

## License

MIT

## Credits

Designed by [FifthBoston.Services](https://fifthboston.services/)

---

**EmTec Targets** — Premium sputter target catalog
