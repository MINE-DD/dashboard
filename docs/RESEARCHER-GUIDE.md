# Researcher Guide: Managing Dashboard Data

This guide is for researchers who need to add, update, or remove data displayed on the Plan-EO Dashboard. No programming experience is required.

The dashboard displays two kinds of data:

- **Point data** (CSV files) — individual study locations shown as dots on the map
- **Raster layers** (GeoTIFF files) — heatmap-style layers that cover larger areas

**Working examples** of all configuration files are included in the repository:
- `point-data/manifest.json` — example point data manifest
- `point-data/2025-09-01_Plan-EO_Dashboard_point_data.csv` — example CSV data file
- `raster-data/raster-layers.json` — example raster layer configuration with all current layers

Use these as templates when adding your own data.

---

## Table of Contents

1. [Point Data (CSV Files)](#point-data-csv-files)
2. [Raster Layers (GeoTIFF Files)](#raster-layers-geotiff-files)
3. [Troubleshooting](#troubleshooting)
4. [Important Notes](#important-notes)

---

## Point Data (CSV Files)

Point data files are CSV spreadsheets stored on the server in the point data directory (typically `point-data/` next to `docker-compose.prod.yml`). Changes take effect immediately on the next page refresh — no restart needed.

### Adding New Point Data

1. **Prepare your CSV file.** It must be named using this exact pattern:

   ```
   YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv
   ```

   For example: `2026-04-01_Plan-EO_Dashboard_point_data.csv`

   The date should be the date of the data, not the upload date.

2. **Make sure your CSV contains all of the required columns:**

   | Column | Description |
   |--------|-------------|
   | `EST_ID` | Unique study identifier |
   | `Pathogen` | Pathogen name (e.g., `__Shigella__`) |
   | `AGE_VAL` | Age group value code |
   | `AGE_LAB` | Age group label |
   | `SYNDROME_VAL` | Syndrome value code |
   | `SYNDROME_LAB` | Syndrome label |
   | `PREV` | Prevalence estimate |
   | `SE` | Standard error |
   | `SITE_LAT` | Site latitude |
   | `SITE_LON` | Site longitude |
   | `CASES` | Number of cases |
   | `SAMPLES` | Number of samples |

3. **Copy the CSV file** to the point data directory on the server.

4. **Update `manifest.json`** in the same directory. Add the new file at the **top** of the `files` array:

   ```json
   {
     "files": [
       {
         "fileName": "2026-04-01_Plan-EO_Dashboard_point_data.csv",
         "date": "2026-04-01",
         "displayDate": "April 1, 2026"
       },
       {
         "fileName": "2025-09-01_Plan-EO_Dashboard_point_data.csv",
         "date": "2025-09-01",
         "displayDate": "September 1, 2025"
       }
     ],
     "lastUpdated": "2026-04-01T00:00:00.000Z",
     "generatedBy": "manual"
   }
   ```

   The dashboard loads the **first file** in the list, so newest should be first.

5. **Refresh the dashboard** in your browser. The new data should appear immediately.

### Removing Point Data

1. Delete the CSV file from the point data directory on the server.
2. Remove the corresponding entry from `manifest.json`.
3. Refresh the dashboard in your browser.

---

## Raster Layers (GeoTIFF Files)

Raster layers are managed through **two things working together**:

1. **The `.tif` files** — the actual map data (Cloud Optimized GeoTIFFs)
2. **The `raster-layers.json` file** — a configuration file that tells the dashboard which layers exist and how to display them

Both of these live in the **raster data directory on the server** (typically `raster-data/` next to the Docker Compose file). Unlike point data, raster files are not stored in GitHub — they are placed directly on the server by your IT admin or by you if you have server access.

### The raster-layers.json File

This is the file that controls which raster layers appear in the dashboard. Each layer is described by a set of fields.

#### Field Reference

| Field | Required For | Description |
|-------|-------------|-------------|
| `name` | All layers | Display name shown in the dashboard |
| `path` | All layers | File path relative to the raster data directory (e.g., `01_Pathogens/SHIG/SHIG_0011_Asym_Pr.tif`) |
| `type` | All layers | Either `"Pathogen"` or `"Risk Factor"` (exact capitalization required) |
| `indicator` | All layers | What the values represent, e.g. `"Prevalence (%)"` or `"Standard error"` |
| `definition` | All layers | Human-readable description of what this layer shows |
| `pathogen` | Pathogens | Pathogen identifier — **must match the `Pathogen` column in your CSV exactly** (e.g. `"__Shigella__"`) |
| `ageGroup` | Pathogens | Age group label — **must match `AGE_LAB` in the CSV exactly** (e.g. `"0-11 months"`) |
| `syndrome` | Pathogens | Syndrome label — **must match `SYNDROME_LAB` in the CSV exactly** (e.g. `"Asymptomatic"`) |
| `category` | Risk Factors | Either `"Housing"` or `"Animal Intervention"` |
| `period` | Optional | Time period the data covers |
| `study` | Optional | Name or reference for the source study |
| `hyperlink` | Optional | URL to the source publication or dataset |

### Adding a New Raster Layer

1. **Place the `.tif` file** in the appropriate folder inside the raster data directory on the server. For pathogens, place it under `01_Pathogens/<PATHOGEN_CODE>/`. For risk factors, place it under `02_Risk_factors/<FACTOR_NAME>/`.

2. **Open `raster-layers.json`** in a text editor (any plain text editor will work).

3. **Add a new entry** to the JSON array. See the examples below for the exact format.

4. **Save the file.**

5. **Refresh your browser.** No server restart is needed — the dashboard picks up changes to `raster-layers.json` automatically.

### Removing a Raster Layer

1. **Open `raster-layers.json`** in a text editor.

2. **Delete the entry** for the layer you want to remove. Be careful to keep the JSON structure valid (watch for commas between entries).

3. **Save the file.**

4. **Optionally delete the `.tif` file** from the server if you no longer need it. This is not required — unused `.tif` files do not affect the dashboard.

5. **Refresh your browser.**

### Updating Raster Data

1. **Replace the `.tif` file** on the server with the new version. Keep the same file name and location.

2. **Refresh your browser.** The dashboard serves files directly, so the new data appears immediately without any restart.

### Example: Adding a New Pathogen Layer

Say you have a new ETEC raster for children 0-11 months. You would add this entry to the `layers` array in `raster-layers.json`:

```json
{
  "name": "ETEC – 0-11 months – Asymptomatic",
  "path": "01_Pathogens/ETEC/ETEC_0011_Asym_Pr.tif",
  "type": "Pathogen",
  "pathogen": "__ETEC__",
  "ageGroup": "0-11 months",
  "syndrome": "Asymptomatic",
  "indicator": "Prevalence (%)",
  "definition": "Predicted prevalence of ETEC",
  "period": "2020",
  "study": "Author et al. 2024, Journal Name",
  "hyperlink": "https://doi.org/10.1234/example"
}
```

**Important:** The `pathogen`, `ageGroup`, and `syndrome` values must match your CSV point data exactly. Open your CSV and check the `Pathogen`, `AGE_LAB`, and `SYNDROME_LAB` columns to find the correct values.

### Example: Adding a New Risk Factor Layer

```json
{
  "name": "Water Access – Coverage",
  "path": "02_Risk_factors/Water/Wtr_Acc_Pr.tif",
  "type": "Risk Factor",
  "category": "Housing",
  "indicator": "Coverage (%)",
  "definition": "Predicted coverage of improved water access",
  "period": "2023",
  "study": "Author et al. 2024, Journal Name",
  "hyperlink": "https://doi.org/10.1234/example"
}
```

### Reference: Existing Config File

A complete working example with all current layers is included in the repository at `raster-data/raster-layers.json`. Use it as a reference when adding new entries — copy an existing entry and modify the fields.

---

## Troubleshooting

### Raster layers don't show up

- **Check that `raster-layers.json` is valid JSON.** Even a single missing comma or extra bracket will prevent all layers from loading. Paste the file contents into [jsonlint.com](https://jsonlint.com) to check for errors.
- **Check that the `path` field matches the actual file name and location.** The path is case-sensitive and must match exactly, including the folder structure.

### Layer loads but doesn't auto-show when I select filters

- The `pathogen`, `ageGroup`, and `syndrome` fields in `raster-layers.json` must match the values in the CSV point data **exactly**. For example, if the CSV uses `SHIG` for the pathogen, the JSON must also say `"pathogen": "SHIG"` — not `"Shig"` or `"shig"`.

### Layer shows as blank on the map

- The `.tif` file may be corrupted or in the wrong format. Raster files must be **Cloud Optimized GeoTIFFs** (COGs). If you are unsure, ask the person who generated the file to confirm it was saved as a COG.

### Point data doesn't appear after adding a new CSV

- Check that the CSV file name follows the pattern exactly: `YYYY-MM-DD_Plan-EO_Dashboard_point_data.csv`
- Check that you updated `manifest.json` and the new file is listed **first** in the `files` array
- Verify `manifest.json` is valid JSON — paste it into [jsonlint.com](https://jsonlint.com) to check
- Visit `http://your-server:8080/data/01_Points/manifest.json` in your browser — if you get a 404, ask your IT admin to check the volume mount

---

## Important Notes

- **File names are case-sensitive.** `SHIG_0011_Asym_Pr.tif` and `shig_0011_asym_pr.tif` are treated as different files. Always match the exact casing.

- **The `pathogen` field must match the CSV.** The dashboard uses this field to link raster layers to point data. If they don't match, the layer won't appear when you filter by that pathogen.

- **Back up `raster-layers.json` before editing.** Keep a copy of the working version so you can restore it if something goes wrong.

- **No restart is needed.** Changes to both raster files and `raster-layers.json` take effect immediately when you refresh the browser. You do not need to restart the server or Docker container.
