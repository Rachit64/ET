CHOKE_POINTS = {
    "strait_of_hormuz": {
        "name": "Strait of Hormuz",
        "bbox": [[25.0, 54.0], [27.5, 57.5]],  # [[lat_min, lon_min], [lat_max, lon_max]]
        "center": [26.3, 55.8]                 # [lat, lon]
    },
    "bab_el_mandeb": {
        "name": "Bab el-Mandeb (Red Sea)",
        "bbox": [[11.5, 42.0], [14.5, 44.5]],
        "center": [12.8, 43.3]
    },
    "suez_canal": {
        "name": "Suez Canal",
        "bbox": [[29.5, 32.0], [31.5, 33.0]],
        "center": [30.5, 32.5]
    },
    "strait_of_malacca": {
        "name": "Strait of Malacca",
        "bbox": [[1.0, 101.0], [6.0, 105.0]],
        "center": [3.5, 102.5]
    }
}

def get_choke_point_for_coords(lat: float, lon: float) -> str:
    """Returns the key of the choke point if coordinates fall within its bbox, else None."""
    for cp_key, cp_data in CHOKE_POINTS.items():
        bbox = cp_data["bbox"]
        lat_min, lon_min = bbox[0]
        lat_max, lon_max = bbox[1]
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            return cp_key
    return None
