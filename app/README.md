# Mine-DD Dashboard Application

> An interactive geospatial dashboard for visualizing and exploring pathogen prevalence data from the MINE-DD (Mining the past to protect the future) and Plan-EO (Planetary Child Health and Enterics Observatory) research initiatives.

## 🌍 Overview

The Mine-DD Dashboard is a cutting-edge web application that provides researchers, policymakers, and public health professionals with powerful tools to explore and analyze pathogen prevalence data across different regions. Built on modern web technologies, it offers real-time data visualization, advanced filtering capabilities, and multiple visualization modes to support evidence-based decision-making for child health interventions.

### Key Objectives

- **Data Visualization**: Transform complex epidemiological data into intuitive visual representations
- **Geographic Analysis**: Map disease transmission risks and environmental determinants
- **Research Support**: Provide evidence base for targeting life-saving interventions
- **Climate Impact Assessment**: Understand diarrheal disease burden in a climate-uncertain future

## ✨ Features

### 🗺️ Interactive Map Visualizations

The dashboard offers four distinct visualization modes, each optimized for different analytical needs:

1. **Standard Dots**
   - Color-coded by study design type (Surveillance, Intervention Trial, Case Control, Cohort)
   - Click for detailed study information
   - Optimized for overview analysis

2. **Pie Charts**
   - Proportional representation of prevalence data
   - Size indicates sample size reliability
   - Visual comparison across regions

3. **3D Bar Extrusions**
   - Height represents prevalence values
   - Base thickness scaled by sample size
   - Customizable thickness settings
   - Ideal for spotting hotspots

4. **Heatmap**
   - Density-based visualization
   - Gradient coloring for prevalence intensity
   - Best for identifying regional patterns

### 🔍 Advanced Filtering System

- **Pathogen Filtering**: Select from 20+ tracked pathogens including:
  - Bacterial: *Campylobacter*, *Shigella*, *Salmonella*, E. coli variants (EPEC, ETEC, EAEC, STEC)
  - Viral: Rotavirus, Norovirus, Adenovirus, Astrovirus, Sapovirus
  - Parasitic: *Giardia*, *Cryptosporidium*, *Cyclospora cayetanensis*, *Entamoeba histolytica*
  
- **Age Group Filtering**: Target specific demographics
- **Syndrome Filtering**: Focus on particular disease presentations
- **Real-time Statistics**: Live point counting and filter status display

### 🗺️ Raster Layer Integration

- **Cloud Optimized GeoTIFF (COG)** support
- **Automatic layer activation** based on filter selections
- **Adjustable opacity controls** (0-100%)
- **Toggle visibility** for data points and raster layers independently
- **Filter-aware layers** with automatic mapping to pathogen/age/syndrome combinations

### 🎨 Map Styles & Themes

Choose from multiple professionally designed map styles:

**Base Maps**
- OSM Default - Standard OpenStreetMap style
- Street Map - Detailed street-level information

**Satellite & Terrain**
- Satellite - High-resolution satellite imagery
- Hybrid - Satellite with street labels
- Terrain - Topographic elevation visualization

**Theme Variants**
- Light/Dark modes for optimal visibility
- Data-optimized themes for overlay clarity

### 📊 Data Management

- **Dynamic CSV data loading** from structured file system
- **Automatic data updates** with timestamped files
- **Italic text formatting** for scientific names
- **Comprehensive metadata** for each data point

### ⚙️ Settings & Customization

- **Global raster opacity control**
- **3D bar thickness adjustment**
- **Persistent settings** via localStorage
- **URL parameter support** for sharing specific views

## 🛠️ Tech Stack

| Category | Technologies |
|----------|-------------|
| **Framework** | SvelteKit 5 with TypeScript |
| **UI/Styling** | TailwindCSS + DaisyUI |
| **Mapping** | MapLibre GL |
| **Package Manager** | Bun |
| **Database** | PostgreSQL (via pg) |
| **Authentication** | Auth.js (custom system) |
| **Data Processing** | PapaParse, GeoTIFF.js |
| **State Management** | Svelte Stores (Runes) |

## 📋 System Requirements

- **Node.js**: v20.0.0 or higher
- **Bun**: Latest version
- **PostgreSQL**: v14 or higher (for authentication features)
- **Modern Browser**: Chrome/Firefox/Safari/Edge (latest versions)

## 🚀 Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/escience/mine-dd.git
cd mine-dd/dashboard/app

# Install dependencies using Bun
bun install
```

### Environment Configuration

1. Copy the example environment file:
```bash
cp "_example .env" .env
```

2. Configure your environment variables:
```env
# Database Configuration
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=plan-eo
DATABASE_URL=postgres://user:password@localhost:5432/plan-eo

# MapTiler API (for satellite/terrain maps)
VITE_MAPTILER_KEY=your_maptiler_api_key

# TiTiler Configuration (optional, for advanced raster processing)
VITE_TITILER_ENDPOINT=http://localhost:8000

# Authentication (if using auth features)
AUTH_SECRET=your-secret-key
GOOGLE_ID=your-google-client-id
GOOGLE_SECRET=your-google-client-secret
RESEND_API_KEY=your-resend-api-key
```

### Development

```bash
# Run development server
bun run dev

# The application will be available at http://localhost:5173
```

### Production Build

```bash
# Build for production
bun run build

# Preview production build
bun run preview

# Start production server
bun run start
```

## 📁 Project Structure

```
src/
├── lib/
│   ├── components/
│   │   └── Map/
│   │       ├── Map.svelte                 # Main map container
│   │       ├── MapStyles.ts               # Map style definitions
│   │       ├── components/                # Map sub-components
│   │       │   ├── FilterDropdown.svelte  # Filter UI component
│   │       │   ├── MapControls.svelte     # Map control buttons
│   │       │   ├── MapCore.svelte         # Core map rendering
│   │       │   ├── MapLegend.svelte       # Map legend display
│   │       │   ├── MapPopover.svelte      # Point detail popups
│   │       │   └── MapSidebar.svelte      # Main sidebar interface
│   │       ├── store/                     # State management
│   │       │   ├── index.ts               # Main store exports
│   │       │   ├── stores.ts              # Core store definitions
│   │       │   └── visualizationOptions.ts # Viz type configs
│   │       └── utils/                     # Utility functions
│   │           ├── csvDataProcessor.ts    # CSV parsing
│   │           ├── pieChartUtils.ts       # Pie chart generation
│   │           ├── barExtrusionUtils.ts   # 3D bar creation
│   │           ├── heatmapUtils.ts        # Heatmap processing
│   │           └── rasterDataProcessor.ts # Raster handling
│   └── stores/                            # Global application stores
│       ├── mapStyle.store.ts              # Map style preferences
│       └── dataPointsVisibility.store.ts  # Visibility toggles
├── routes/                                # SvelteKit routes
│   ├── +page.svelte                      # Main dashboard page
│   └── about/+page.svelte                # About page
└── static/
    └── data/
        ├── 01_Points/                     # CSV data files
        │   └── YYYY-MM-DD_*.csv          # Timestamped data
        └── cogs/                          # Raster layer files
            └── *.tif                      # GeoTIFF files
```

## 📊 Data Format

### CSV Data Structure

Data files are stored in `/static/data/01_Points/` with the naming pattern:
`YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv`

**Important Notes:**
- CSV files use **semicolon (`;`)** as delimiter
- Automatic loading of most recent file by date
- All prevalence values should be in percentage format

### Required CSV Columns

| Column | Description | Example |
|--------|-------------|---------|
| pathogen | Pathogen name with formatting | `__Salmonella__` |
| prevalenceValue | Prevalence percentage | `12.5` |
| ageGroup | Age demographic | `Children <5` |
| syndrome | Disease syndrome | `Diarrhea` |
| location | Geographic location | `Kenya` |
| latitude | Decimal latitude | `-1.2921` |
| longitude | Decimal longitude | `36.8219` |
| design | Study design type | `Cohort` |
| source | Study source | `Smith et al., 2023` |
| hyperlink | Source URL | `https://...` |

### Pathogen Name Formatting

Scientific names use double underscores for italic rendering:
- `__Genus species__` → *Genus species*
- `Pathogen __G. species__ (TYPE)` → Pathogen *G. species* (TYPE)

## 🎮 User Guide

### Navigation Controls

- **Pan**: Click and drag the map
- **Zoom**: Scroll wheel or +/- buttons
- **Reset View**: Double-click on map
- **3D Tilt**: Right-click and drag (when 3D bars selected)

### Interactive Data Points

#### Single Point Interaction
- **Click** on any data point to view detailed information including:
  - Pathogen name and prevalence percentage
  - Age group and syndrome information
  - Study location and duration
  - Study design type
  - Source publication with direct link

#### Overlapping Points (Pie Chart Mode)
When pie charts visually overlap on the map:
- **Automatic Detection**: The system detects when pie charts overlap by at least 5 pixels
- **Selection Menu**: A popup menu lists all overlapping data points
- **Quick Preview**: Each item shows pathogen, prevalence, age range, and syndrome
- **Detailed View**: Click any item to see complete study information
- **Navigation**: Use "Back to list" button to return to the selection menu

This feature ensures easy access to all data even in densely populated regions where multiple studies overlap geographically.

### Using Filters

1. **Single Selection**: Use dropdown to select one item per category
2. **Clear Filters**: Click "Clear Filters" button when filters are active
3. **View Statistics**: See "X of Y points" indicator for filter results
4. **Raster Indicators**: 🗺️ icon shows options with associated raster layers

### Visualization Settings

Access via the gear icon (⚙️) in the sidebar:
- **Global Raster Opacity**: Adjust transparency of all raster layers
- **3D Bar Thickness**: Control base thickness of 3D visualizations
- **Data Points Toggle**: Show/hide point markers
- **Raster Layers Toggle**: Show/hide raster overlays

## 🔐 Authentication System

The application includes a comprehensive authentication system with:
- Multiple auth providers (Email, Google, Credentials)
- Role-based access control (User/Admin)
- PostgreSQL user management
- JWT session handling

See [AUTH.md](./AUTH.md) for detailed authentication documentation.

## 🧪 Development Guide

### Adding New Visualizations

1. Create visualization utility in `/src/lib/components/Map/utils/`
2. Add type to `VisualizationType` in store
3. Update `visualizationOptions.ts` with new option
4. Implement rendering logic in `mapVisualizationManager.ts`

### Adding New Filters

1. Update CSV processor to extract new field
2. Add store for new filter type
3. Create filter component in sidebar
4. Update filter logic in `filterManager.ts`

### Scripts Available

```bash
# Development
bun run dev          # Start dev server
bun run check        # Type checking
bun run lint         # Lint code
bun run format       # Format code

# Database
bun run migrate      # Run database migrations
bun run seed:dev     # Seed development database

# Build & Deploy
bun run build        # Production build
bun run preview      # Preview production build
bun run start        # Start production server

# Data Management
bun run update-data-manifest  # Update data file manifest
```

## 🐳 Docker Support

```bash
# Using Docker Compose
docker-compose up -d

# Seed database in Docker
bun run seed:docker
```

## 🤝 Contributing

We welcome contributions to the Mine-DD Dashboard! Please follow these guidelines:

1. **Code Style**: Follow existing patterns and run `bun run format`
2. **Type Safety**: Ensure all TypeScript types are properly defined
3. **Testing**: Test thoroughly before submitting PR
4. **Documentation**: Update README for new features
5. **Commits**: Use clear, descriptive commit messages

### Reporting Issues

Please report issues at: [GitHub Issues](https://github.com/escience/mine-dd/issues)

## 📚 Additional Resources

- [Plan-EO Homepage](https://www.planeo.earth/)
- [Plan-EO Protocol Paper](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0297775)
- [MINE-DD GitHub Repository](https://github.com/MINE-DD)
- [Plan-EO Webinar](https://www.youtube.com/watch?v=XyjjLnjj8Lw)

## 👥 Team & Organizations

### Participating Organizations
- University of Amsterdam
- Amsterdam University Medical Centers
- Netherlands eScience Center
- University of Virginia School of Medicine

### Core Team
See [About Page](./src/routes/about/+page.svelte) for full team listing with ORCID identifiers.

## 📄 License

[License information to be added]

## 🙏 Acknowledgments

This project is supported by:
- SURF infrastructure
- Snellius computing resources
- Netherlands eScience Center

---

*For technical support or questions, please open an issue on GitHub or contact the development team.*