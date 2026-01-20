const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'src', 'assets', 'img', 'photography');
const outFile = path.join(root, 'manifest.json');

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.JPG', '.PNG'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    list.forEach((entry) => {
        const p = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(walk(p));
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (IMAGE_EXT.includes(ext)) results.push(p);
        }
    });
    return results;
}

function looksLikeDateOrIndex(s) {
    // contains digits or dots like '2017.06.01' or 'IMG_1234'
    return /\d/.test(s);
}

function normalizeFolderName(s) {
    return s.replace(/[_\.]/g, ' ').trim().toLowerCase();
}

function main() {
    if (!fs.existsSync(root)) {
        console.error('Photography folder not found:', root);
        process.exit(1);
    }

    const files = walk(root);
    const total = files.length;

    let aviation = 0;
    let travel = 0;
    const countries = new Set();

    files.forEach(f => {
        const parts = f.split(path.sep).map(p => p.trim());
        const lower = parts.map(p => p.toLowerCase());

        if (lower.some(p => p === 'aviation')) aviation++;
        if (lower.some(p => p === 'travel')) travel++;

        // Find the index of 'photography' or 'travel' or 'aviation' in path
        let idx = lower.indexOf('photography');
        if (idx === -1) idx = lower.indexOf('travel');
        if (idx === -1) idx = lower.indexOf('aviation');

        // Attempt to extract a country/region name from next parts
        if (idx >= 0) {
            // candidates are the next up to two folder names
            for (let j = idx + 1; j <= idx + 3 && j < parts.length - 1; j++) {
                const candidate = parts[j];
                if (!candidate) continue;
                if (looksLikeDateOrIndex(candidate)) continue;
                const clean = normalizeFolderName(candidate);
                if (clean.length < 2) continue;
                if (['aviation', 'travel', 'images', 'photos'].includes(clean)) continue;
                countries.add(clean);
                break; // take first reasonable candidate
            }
        }
    });

    // Only include derived counts that should come from the file scan.
    // Do NOT include `totalPhotos` or `countriesVisited` here per request —
    // those are provided as component defaults or by other processes.
    const manifest = {
        aviationPhotos: aviation,
        travelPhotos: travel,
        countriesPresented: countries.size
    };

    try {
        fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), 'utf8');
        console.log('Wrote manifest to', outFile, '->', manifest);
    } catch (e) {
        console.error('Failed to write manifest:', e.message);
        process.exit(1);
    }
}

main();
