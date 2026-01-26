const fs = require('fs');
const path = require('path');

const PHOTOGRAPHY_DIR = path.join(__dirname, '..', 'src', 'assets', 'img', 'photography');
const OUTPUT_FILE = path.join(PHOTOGRAPHY_DIR, 'images-manifest.json');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG', '.WEBP'];

// Manual translations for specific titles
const manualTranslations = {
    "Boa Vista picturest airport terminal": "Boa Vista malerisches Flughafen-Terminal",
    "TUI from United Kingdom arriving at Boa Vista airport with Boeing 737 8MAX": "TUI aus dem Vereinigten Königreich landet am Flughafen Boa Vista mit Boeing 737 8MAX",
    "Sal airport terminal with many palms": "Sal Flughafen-Terminal mit vielen Palmen",
    "Ex monarch livery mixed with Thomas Cook livery on an Airbus A321 at night": "Ex-Monarch-Lackierung gemischt mit Thomas Cook Lackierung auf einem Airbus A321 bei Nacht",
    "Air Cairo old livery with Airbus A320": "Air Cairo alte Lackierung mit Airbus A320",
    "Magnificent Terminal of Denpasar airport on Bali island": "Prachtvolles Terminal des Denpasar Flughafens auf Bali",
    "Terminal Overview with big airplane lineup of airlines at denpasar bali airport": "Terminal-Übersicht mit großer Flugzeug-Aufstellung von Airlines am Denpasar Bali Flughafen",
    "Sriwijaya air from indonsia at balis airport of denpasar": "Sriwijaya Air aus Indonesien am Bali Flughafen Denpasar",
    "Ukraine International Airlines with Boeing B737-900ER at night": "Ukraine International Airlines mit Boeing B737-900ER bei Nacht",
    "EL AL Up Airlines with Boeing 737-800 web at a sanddusty day": "EL AL Up Airlines mit Boeing 737-800 an einem sandigen Tag",
    "Arkia ATR arriving at now closed airport during sunset": "Arkia ATR landet am jetzt geschlossenen Flughafen während des Sonnenuntergangs",
    "empty terminal with many free gangways and airplane stands of KL": "Leeres Terminal mit vielen freien Gangways und Flugzeugständen in KL",
    "Airport expansion of Muscar capital airport with the new terminal during sunset": "Flughafen-Erweiterung des Muscat Flughafens mit dem neuen Terminal bei Sonnenuntergang",
    "Nice little cute airplane Bombardier Dash of Philippines on a sunny day": "Schönes kleines Flugzeug Bombardier Dash der Philippinen an einem sonnigen Tag",
    "Main airport of Palawan terminal outside view": "Hauptflughafen von Palawan Terminal Außenansicht",
    "Guess the aircraft - solution is A380 of Qatar": "Rate das Flugzeug - Lösung ist A380 von Qatar",
    "JetstarPacific from Vietnam with an A320 IAE engines": "JetstarPacific aus Vietnam mit einem A320 IAE-Triebwerk",
    "The best toilet view in the world": "Die beste Toiletten-Aussicht der Welt",
    "huge aircraft from the front": "Riesiges Flugzeug von vorne",
    "THAI Boeing old B737 landing and sunset": "THAI Boeing alte B737 Landung bei Sonnenuntergang",
    "The most beautiful firefly ATR at the best airport in the world": "Das schönste Firefly ATR am besten Flughafen der Welt",
    "who is the most wet during this rainy thunderstorm": "Wer ist am nässesten während dieses regnerischen Gewitters",
    "When airplane loves sand": "Wenn Flugzeuge Sand lieben",
    "Boeing B737-800 Virgin Australia at the airport gate in Adelaide, South Australia": "Boeing B737-800 Virgin Australia am Flughafen-Gate in Adelaide, Südaustralien",
    "Rare Boeing B717 at dusty airport": "Seltener Boeing B717 am staubigen Flughafen",
    "Fire show during airshow": "Feuershow während der Flugshow",
    "Amazing golden hour with arriving Airbus A330 from Singapore Airlines": "Atemberaubende goldene Stunde mit ankommendem Airbus A330 von Singapore Airlines",
    "Exotic Hevilift Airlines from Papua New Guinea with an ATR": "Exotische Hevilift Airlines aus Papua-Neuguinea mit einem ATR",
    "Morning rain drops on this wet Virgin Australia Boeing 737": "Morgentliche Regentropfen auf dieser nassen Virgin Australia Boeing 737",
    "Arriving small plane at an airstrip on Fraser Island in Australia": "Ankommendes Kleinflugzeug auf einer Landebahn auf Fraser Island in Australien",
    "Guess the airline - solution is SCOOT Boeing 787": "Rate die Airline - Lösung ist SCOOT Boeing 787",
    "Old exhibited Boeing B747 from QANTAS": "Alter ausgestellter Boeing B747 von QANTAS",
    "tigerair arrived Airbus A320": "Tigerair angekommener Airbus A320",
    "Count the number of planes Boeing 717 virgin australia": "Zähle die Anzahl der Flugzeuge Boeing 717 Virgin Australia",
    "SCOOT Boeing 787 departing for Singapore with port in the background": "SCOOT Boeing 787 Abflug nach Singapur mit Hafen im Hintergrund",
    "Tiny aircraft from Fiji Link arriving": "Winziges Flugzeug von Fiji Link bei Ankunft",
    "Sunset at Prague airport with chartered smartwings": "Sonnenuntergang am Prager Flughafen mit gecharterten Smartwings",
    "Kuata Island in Yasawa Islands group Fiji from air": "Kuata-Insel in der Yasawa-Inselgruppe Fidschi aus der Luft",
    "Paradise in Fiji in the Yasawa near blue lagoon": "Paradies in Fidschi in den Yasawa nahe der blauen Lagune",
    "Ikaria Seychelles Beach from above": "Ikaria Seychelles Strand von oben",
    "Tropic vulcano Arenal view from La Fortuna": "Tropischer Vulkan Arenal Aussicht von La Fortuna",
    "Lake Arenal in the middle of tropical Costa Rica": "Arenal-See mitten im tropischen Costa Rica",
    "Tropical paradise hot springs Tabacon Resort": "Tropisches Paradies heiße Quellen Tabacon Resort"
};

function translateTitle(title) {
    // Remove file extension if present
    let cleanTitle = title.replace(/\.(jpg|jpeg|png|webp|JPG|JPEG|PNG|WEBP)$/i, '').trim();

    // Check if we have a manual translation
    if (manualTranslations[cleanTitle]) {
        return manualTranslations[cleanTitle];
    }

    // If no manual translation found, return original
    return cleanTitle;
}

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
                    titleDE: translateTitle(fileName),
                    category: imageCategory,
                    continent: continent,
                    country: country,
                    fileName: item,
                    fileNameDE: translateTitle(fileName) + path.extname(item),
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
