# Mine-DD Dashboard Application

A Svelte-based interactive dashboard for visualizing pathogen prevalence data from various studies across different regions.

## Tech Stack

- **Framework**: SvelteKit with TypeScript
- **UI**: TailwindCSS + DaisyUI
- **Maps**: MapLibre GL
- **Package Manager**: Bun
- **Database**: PostgreSQL (via pg)
- **Authentication**: Custom auth system

## Development

```bash
# Install dependencies
bun install

# Run development server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview
```

## Data Format

### CSV Data Structure

The application reads pathogen prevalence data from CSV files located in `/static/data/01_Points/`. Data files follow the naming pattern: `YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv`.

**Important:** The CSV file uses semicolon (`;`) as the delimiter, not comma.

### Pathogen Name Formatting

Some pathogen names in the data include markdown-style formatting for italic rendering of genus names. The format uses double underscores: `__text__`

Examples of formatted pathogen names:
- `__Campylobacter__` → Renders as *Campylobacter*
- `__Shigella__` → Renders as *Shigella*
- `__Salmonella__` → Renders as *Salmonella*
- `__Giardia__` → Renders as *Giardia*
- `__Cryptosporidium__` → Renders as *Cryptosporidium*
- `__Vibrio cholerae__` → Renders as *Vibrio cholerae*
- `__Cyclospora cayetanensis__` → Renders as *Cyclospora cayetanensis*
- `__Entamoeba histolytica__` → Renders as *Entamoeba histolytica*

For *E. coli* variants, only the genus and species are italicized:
- `Enteropathogenic __E. coli__ (EPEC)` → Enteropathogenic *E. coli* (EPEC)
- `Enterotoxigenic __E. coli__ (ETEC)` → Enterotoxigenic *E. coli* (ETEC)
- `Enteroaggregative __E. coli__ (EAEC)` → Enteroaggregative *E. coli* (EAEC)
- `Shiga toxin-producing __E. coli__ (STEC)` → Shiga toxin-producing *E. coli* (STEC)

Non-italicized pathogens (no formatting):
- `Adenovirus`
- `Astrovirus`
- `Norovirus`
- `Rotavirus`
- `Sapovirus`

The application automatically converts these `__name__` markers to HTML `<em>` tags for proper italic rendering in the UI.

## Map Features

### Visualization Types
- **Points**: Individual study locations
- **Pie Charts**: Proportional representation by category
- **3D Bars**: Height-based prevalence visualization
- **Heatmap**: Density-based visualization

### Filters
- **Pathogens**: Filter by specific pathogen types
- **Age Groups**: Filter by age demographics
- **Syndromes**: Filter by syndrome categories

### Raster Layers
The application supports Cloud Optimized GeoTIFF (COG) raster layers that can be automatically displayed based on filter selections. Raster layers are stored in `/static/data/cogs/`.

## Project Structure

```
src/
├── lib/
│   ├── components/
│   │   └── Map/
│   │       ├── Map.svelte              # Main map component
│   │       ├── components/             # Sub-components
│   │       │   ├── FilterDropdown.svelte
│   │       │   ├── MapSidebar.svelte
│   │       │   └── ...
│   │       ├── store/                  # State management
│   │       └── utils/                  # Utility functions
│   └── stores/                         # Global stores
├── routes/                             # SvelteKit routes
└── static/
    └── data/
        ├── 01_Points/                  # CSV data files
        └── cogs/                       # Raster layers
```

## Environment Variables

Create a `.env` file based on `_example .env`:

```bash
# Database connection
DATABASE_URL=your_database_url

# Other configuration as needed
```

## Authentication

The application includes a custom authentication system. See `AUTH.md` for detailed authentication documentation.

## Map Styles

Multiple map styles are available. See `docs/map-styles.md` for configuration details.

## Contributing

1. Ensure all TypeScript types are properly defined
2. Follow the existing code style
3. Test thoroughly before committing
4. Update documentation as needed

## License

[License information to be added]