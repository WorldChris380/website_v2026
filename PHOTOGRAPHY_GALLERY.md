# Photography Gallery - Image Management

## Overview
The gallery now uses real images from the `src/assets/img/photography` folder instead of placeholder images. The folder structure automatically determines the filters available in the gallery.

## Folder Structure

```
src/assets/img/photography/
├── Aviation/
│   ├── Africa/
│   │   ├── Cape Verde/
│   │   └── Egypt/
│   ├── Asia/
│   │   ├── Indonesia/
│   │   ├── Israel/
│   │   ├── Malaysia/
│   │   └── ...
│   ├── Australia and Oceania/
│   └── Europe/
├── Travel/
│   ├── Australia and Oceania/
│   ├── Europe/
│   └── North America/
└── images-manifest.json (auto-generated)
```

## How It Works

1. **Folder Structure = Filters**
   - First level: `Aviation` or `Travel` (main category)
   - Second level: Continent (e.g., `Asia`, `Europe`, `Africa`)
   - Third level: Country (e.g., `Thailand`, `Greece`, `Costa Rica`)
   - Deeper levels: Location/Airport/Date folders

2. **Image Manifest**
   - The `images-manifest.json` file is automatically generated
   - Contains metadata for all images including paths, categories, continents, countries
   - Used by the Angular app to display images without scanning folders at runtime

3. **Filters Available**
   - Category: All, Aviation, Travel
   - Continent: All, Africa, Asia, Australia and Oceania, Europe, North America
   - Search: By title, country, continent, or description

## Adding New Images

1. **Add images to the appropriate folder:**
   ```
   src/assets/img/photography/Aviation/Asia/Thailand/Phuket (HKT)/[your-images].jpg
   ```

2. **Regenerate the manifest:**
   ```bash
   cd 2026
   node scripts/generate-image-manifest.js
   ```

3. **The gallery will automatically load the new images**

## Image Naming Convention

- Use descriptive filenames: `Sunset at Prague airport with chartered smartwings .jpg`
- The file extension will be automatically removed in the display
- Spaces and special characters are supported

## Technical Details

### Generated Manifest Structure
```json
{
  "generated": "2026-01-18T15:43:30.266Z",
  "statistics": {
    "totalImages": 43,
    "aviationPhotos": 37,
    "travelPhotos": 6,
    "continents": ["Africa", "Asia", ...],
    "countries": ["Thailand", "Greece", ...]
  },
  "images": [
    {
      "url": "assets/img/photography/Aviation/Asia/Thailand/...",
      "title": "Beautiful sunset",
      "category": "Aviation",
      "continent": "Asia",
      "country": "Thailand",
      "fileName": "Beautiful sunset.jpg",
      "path": "Aviation/Asia/Thailand/..."
    }
  ]
}
```

### Supported Image Formats
- `.jpg`, `.jpeg`
- `.png`
- `.webp`
- Case-insensitive (`.JPG`, `.JPEG`, etc.)

## Scripts

### Generate Image Manifest
```bash
node scripts/generate-image-manifest.js
```

This script:
- Scans all images in the photography folder
- Extracts metadata from folder structure
- Generates `images-manifest.json`
- Shows statistics (total images, categories, continents, countries)

## Current Statistics

- **Total Images**: 43
- **Aviation Photos**: 37
- **Travel Photos**: 6
- **Continents**: 5
- **Countries**: 16
