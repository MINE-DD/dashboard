#!/bin/bash

# Input and output directories
INPUT_DIR="/Users/ctw/Sites/github/escience/mine-dd/dashboard/data/02_Rasters"
OUTPUT_DIR="/Users/ctw/Sites/github/escience/mine-dd/dashboard/data/cogs"

# Ensure the output directory exists
mkdir -p "$OUTPUT_DIR"

# Loop through all .tif files in the input directory using find
find "$INPUT_DIR" -type f -name "*.tif" | while read -r file; do
    # Extract the filename without the directory
    filename=$(basename "$file")

    # Temporary aligned file
    aligned_file="$OUTPUT_DIR/aligned_$filename"

    echo "Processing $file..."

    # Step 1: Reproject and align the raster
    gdalwarp -t_srs EPSG:4326 -tr 0.25 0.25 -tap "$file" "$aligned_file"

    # Step 2: Convert to Cloud Optimized GeoTIFF (COG)
    gdal_translate -of COG -co TILING_SCHEME=GoogleMapsCompatible "$aligned_file" "$OUTPUT_DIR/$filename"

    # Remove the temporary aligned file
    rm "$aligned_file"

    # Step 3: Handle associated metadata files
    for ext in ".aux.xml" ".tfw" ".xml"; do
        metadata_file="${file}${ext}"
        if [ -f "$metadata_file" ]; then
            echo "Copying metadata file $metadata_file to $OUTPUT_DIR"
            cp "$metadata_file" "$OUTPUT_DIR/$(basename "$metadata_file")"
        fi
    done

    echo "Finished processing $file. Output saved to $OUTPUT_DIR/$filename"
done

echo "All files processed successfully."