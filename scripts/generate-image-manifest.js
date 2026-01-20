const fs = require('fs');
const path = require('path');

const PHOTOGRAPHY_DIR = path.join(__dirname, '..', 'src', 'assets', 'img', 'photography');
const OUTPUT_FILE = path.join(PHOTOGRAPHY_DIR, 'images-manifest.json');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG', '.WEBP'];

function getAllImages(dir, baseDir = dir, category = '') {
    let images = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Recursively get images from subdirectories
            images = images.concat(getAllImages(fullPath, baseDir, category));
        } else if (stat.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (IMAGE_EXTENSIONS.includes(ext)) {
                // Parse the relative path to extract metadata
                const relativePath = path.relative(baseDir, fullPath);
                const parts = relativePath.split(path.sep);

                // parts[0] = Aviation or Travel
                // parts[1] = Continent (Africa, Asia, Europe, etc.)
                // parts[2] = Country
                // parts[3+] = Location/Airport/Date folders

                const imageCategory = parts[0] || 'Unknown';
                const continent = parts[1] || 'Unknown';
                const country = parts[2] || 'Unknown';

                // Extract title from filename (remove extension)
                const fileName = path.basename(item, ext);

                // Convert to web path (use forward slashes)
                const webPath = 'assets/img/photography/' + relativePath.replace(/\\/g, '/');

                images.push({
                    url: webPath,
                    title: fileName,
                    category: imageCategory,
                    continent: continent,
                    country: country,
                    fileName: item,
                    path: relativePath.replace(/\\/g, '/')
                });
            }
        }
    }

    return images;
}

function generateManifest() {
    console.log('Scanning photography directory...');

    const aviationDir = path.join(PHOTOGRAPHY_DIR, 'Aviation');
    const travelDir = path.join(PHOTOGRAPHY_DIR, 'Travel');

    let allImages = [];

    if (fs.existsSync(aviationDir)) {
        allImages = allImages.concat(getAllImages(aviationDir, PHOTOGRAPHY_DIR));
    }

    if (fs.existsSync(travelDir)) {
        allImages = allImages.concat(getAllImages(travelDir, PHOTOGRAPHY_DIR));
    }

    // Generate statistics
    const stats = {
        totalImages: allImages.length,
        aviationPhotos: allImages.filter(img => img.category === 'Aviation').length,
        travelPhotos: allImages.filter(img => img.category === 'Travel').length,
        continents: [...new Set(allImages.map(img => img.continent))],
        countries: [...new Set(allImages.map(img => img.country))],
    };

    const manifest = {
        generated: new Date().toISOString(),
        statistics: stats,
        images: allImages
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2));

    console.log(`✓ Generated manifest with ${allImages.length} images`);
    console.log(`  - Aviation: ${stats.aviationPhotos}`);
    console.log(`  - Travel: ${stats.travelPhotos}`);
    console.log(`  - Continents: ${stats.continents.length}`);
    console.log(`  - Countries: ${stats.countries.length}`);
    console.log(`✓ Saved to: ${OUTPUT_FILE}`);
}

try {
    generateManifest();
} catch (error) {
    console.error('Error generating manifest:', error);
    process.exit(1);
}
