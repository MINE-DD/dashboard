import pandas as pd
import os

def excel_to_csv(excel_file_path, output_dir):
    """Converts each sheet in an Excel file to a separate CSV file."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")

    try:
        xls = pd.ExcelFile(excel_file_path)
        print(f"Reading Excel file: {excel_file_path}")
        print(f"Found sheets: {xls.sheet_names}")

        for sheet_name in xls.sheet_names:
            df = xls.parse(sheet_name)
            csv_file_path = os.path.join(output_dir, f"{sheet_name}.csv")
            df.to_csv(csv_file_path, index=False)
            print(f"Converted sheet '{sheet_name}' to {csv_file_path}")

    except FileNotFoundError:
        print(f"Error: Excel file not found at {excel_file_path}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Define the path to your Excel file and the desired output directory
    excel_file = 'app/src/lib/assets/data/Plan-EO-Observation_Data_v4.xlsx'
    output_directory = 'app/static/data/excel_csv_exports'

    excel_to_csv(excel_file, output_directory)
