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

    # Extract the subdirectory structure
    # This gets the path relative to INPUT_DIR
    rel_path=$(dirname "${file#$INPUT_DIR/}")

    # Create the corresponding output subdirectory
    output_subdir="$OUTPUT_DIR/$rel_path"
    mkdir -p "$output_subdir"

    # Temporary aligned file
    aligned_file="$output_subdir/aligned_$filename"

    echo "Processing $file..."

    # Step 1: Reproject and align the raster using a better approach
    gdalwarp -t_srs EPSG:4326 -r bilinear -overwrite "$file" "$aligned_file"

    # Step 2: Convert to Cloud Optimized GeoTIFF (COG) with appropriate settings
    gdal_translate -of COG -co TILING_SCHEME=GoogleMapsCompatible -co COMPRESS=DEFLATE "$aligned_file" "$output_subdir/$filename"

    # Remove the temporary aligned file
    rm "$aligned_file"

    # Step 3: Handle associated metadata files
    for ext in ".aux.xml" ".tfw" ".xml"; do
        metadata_file="${file}${ext}"
        if [ -f "$metadata_file" ]; then
            echo "Copying metadata file $metadata_file to $output_subdir"
            cp "$metadata_file" "$output_subdir/$(basename "$metadata_file")"
        fi
    done

    echo "Finished processing $file. Output saved to $output_subdir/$filename"
done

echo "All files processed successfully."
