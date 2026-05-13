const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');

const SOURCE_ROOTS = [
    {
        label: 'Aviation',
        sourcePath: 'D:\\Bilder\\Aviation'
    },
    {
        label: 'Travel',
        sourcePath: 'D:\\Bilder\\Travel'
    }
];

const DESTINATION_ROOT = 'D:\\Programmieren\\cb.com\\Object storage';
const FILE_PATTERN = /(?:B|\u00DC)\.jpg$/i;
const NAME_MAP_FILE = path.join(DESTINATION_ROOT, 'name-map.json');
const STATS_MANIFEST_FILE = path.join(__dirname, '..', 'src', 'assets', 'img', 'photography', 'manifest.json');
const DB_SECRETS_FILE = path.join(__dirname, '..', 'secrets', 'gallery-db.local.json');

const VARIANTS = {
    original: {
        folder: 'original',
        resize: null,
        quality: null
    },
    grid: {
        folder: 'grid',
        resize: {
            width: 1920,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true
        },
        quality: 70
    },
    thumbnail: {
        folder: 'thumbnail',
        resize: {
            width: 480,
            height: 480,
            fit: 'inside',
            withoutEnlargement: true
        },
        quality: 70
    }
};

async function main() {
    let copiedOriginalCount = 0;
    let generatedGridCount = 0;
    let generatedThumbnailCount = 0;
    let skippedCount = 0;
    const reservedRelativePaths = new Set();
    const nameMapEntries = {};

    for (const root of SOURCE_ROOTS) {
        const result = await copyMatchingFiles(root, reservedRelativePaths, nameMapEntries);
        copiedOriginalCount += result.copiedOriginalCount;
        generatedGridCount += result.generatedGridCount;
        generatedThumbnailCount += result.generatedThumbnailCount;
        skippedCount += result.skippedCount;
    }

    await writeNameMap(nameMapEntries);
    await writeStatsManifest(nameMapEntries);
    await syncToDatabase(nameMapEntries);

    console.log(`Copied ${copiedOriginalCount} original file(s) to ${path.join(DESTINATION_ROOT, VARIANTS.original.folder)}`);
    console.log(`Generated ${generatedGridCount} grid file(s) in ${path.join(DESTINATION_ROOT, VARIANTS.grid.folder)}`);
    console.log(`Generated ${generatedThumbnailCount} thumbnail file(s) in ${path.join(DESTINATION_ROOT, VARIANTS.thumbnail.folder)}`);
    console.log(`Skipped ${skippedCount} duplicate file(s)`);
    console.log(`Wrote name map with ${Object.keys(nameMapEntries).length} entries to ${NAME_MAP_FILE}`);
}

async function copyMatchingFiles(root, reservedRelativePaths, nameMapEntries) {
    const sourceExists = await exists(root.sourcePath);
    if (!sourceExists) {
        console.warn(`Skipping missing source folder: ${root.sourcePath}`);
        return {
            copiedOriginalCount: 0,
            generatedGridCount: 0,
            generatedThumbnailCount: 0,
            skippedCount: 0
        };
    }

    return copyDirectoryRecursive(root, root.sourcePath, reservedRelativePaths, nameMapEntries);
}

async function copyDirectoryRecursive(root, currentPath, reservedRelativePaths, nameMapEntries) {
    let copiedOriginalCount = 0;
    let generatedGridCount = 0;
    let generatedThumbnailCount = 0;
    let skippedCount = 0;
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
            const result = await copyDirectoryRecursive(root, fullPath, reservedRelativePaths, nameMapEntries);
            copiedOriginalCount += result.copiedOriginalCount;
            generatedGridCount += result.generatedGridCount;
            generatedThumbnailCount += result.generatedThumbnailCount;
            skippedCount += result.skippedCount;
        } else if (entry.isFile()) {
            const result = await copyIfMatch(root, fullPath, reservedRelativePaths, nameMapEntries);
            copiedOriginalCount += result.copiedOriginalCount;
            generatedGridCount += result.generatedGridCount;
            generatedThumbnailCount += result.generatedThumbnailCount;
            skippedCount += result.skippedCount;
        }
    }

    return { copiedOriginalCount, generatedGridCount, generatedThumbnailCount, skippedCount };
}

async function copyIfMatch(root, sourceFilePath, reservedRelativePaths, nameMapEntries) {
    if (!FILE_PATTERN.test(path.basename(sourceFilePath))) {
        return {
            copiedOriginalCount: 0,
            generatedGridCount: 0,
            generatedThumbnailCount: 0,
            skippedCount: 0
        };
    }

    const relativePath = path.relative(root.sourcePath, sourceFilePath);
    const normalizedRelativePath = normalizeRelativePath(root, relativePath);
    const relativeKey = normalizedRelativePath.toLowerCase();

    if (reservedRelativePaths.has(relativeKey)) {
        console.log(`Skipped duplicate path in same run: ${sourceFilePath}`);
        return {
            copiedOriginalCount: 0,
            generatedGridCount: 0,
            generatedThumbnailCount: 0,
            skippedCount: 1
        };
    }

    reservedRelativePaths.add(relativeKey);
    nameMapEntries[toPosixPath(normalizedRelativePath)] = buildNameMapEntry(relativePath, normalizedRelativePath);

    const originalPath = path.join(DESTINATION_ROOT, VARIANTS.original.folder, normalizedRelativePath);
    const gridPath = path.join(DESTINATION_ROOT, VARIANTS.grid.folder, normalizedRelativePath);
    const thumbnailPath = path.join(DESTINATION_ROOT, VARIANTS.thumbnail.folder, normalizedRelativePath);

    const [origExists, gridExists, thumbExists] = await Promise.all([
        exists(originalPath),
        exists(gridPath),
        exists(thumbnailPath)
    ]);

    if (origExists && gridExists && thumbExists) {
        console.log(`Skipped (all variants present): ${sourceFilePath}`);
        return {
            copiedOriginalCount: 0,
            generatedGridCount: 0,
            generatedThumbnailCount: 0,
            skippedCount: 1
        };
    }

    const copiedOriginalCount = origExists ? 0 : await writeOriginal(sourceFilePath, originalPath);
    const generatedGridCount = gridExists ? 0 : await writeVariant(sourceFilePath, gridPath, VARIANTS.grid);
    const generatedThumbnailCount = thumbExists ? 0 : await writeVariant(sourceFilePath, thumbnailPath, VARIANTS.thumbnail);

    return {
        copiedOriginalCount,
        generatedGridCount,
        generatedThumbnailCount,
        skippedCount: 0
    };
}

function normalizeRelativePath(root, relativePath) {
    const parsed = path.parse(relativePath);
    const normalizedDirectory = normalizeDirectoryPath(parsed.dir);
    const normalizedFileBase = slugifyFileBase(parsed.name);
    const extension = '.jpg';

    return path.join(
        normalizeDirectorySegment(root.label),
        normalizedDirectory,
        `${normalizedFileBase}${extension}`
    );
}

function normalizeDirectoryPath(directoryPath) {
    if (!directoryPath) {
        return '';
    }

    return directoryPath
        .split(path.sep)
        .map((segment) => normalizeDirectorySegment(segment))
        .join(path.sep);
}

function normalizeDirectorySegment(segment) {
    return segment.replace(/\s+/g, '_').trim();
}

function slugifyFileBase(fileBase) {
    let slug = fileBase
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ß/g, 'ss')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();

    if (slug === '') {
        const hash = crypto.createHash('sha1').update(fileBase).digest('hex').slice(0, 10);
        slug = `image-${hash}`;
    }

    return slug;
}

function buildNameMapEntry(originalRelativePath, normalizedRelativePath) {
    const sourceParsed = path.parse(originalRelativePath);
    const normalizedParsed = path.parse(normalizedRelativePath);

    return {
        originalRelativePath: toPosixPath(originalRelativePath),
        sanitizedRelativePath: toPosixPath(normalizedRelativePath),
        originalFileName: sourceParsed.base,
        sanitizedFileName: normalizedParsed.base,
        originalTitle: sourceParsed.name
    };
}

async function writeNameMap(nameMapEntries) {
    await fs.mkdir(path.dirname(NAME_MAP_FILE), { recursive: true });
    const payload = {
        generatedAt: new Date().toISOString(),
        entries: nameMapEntries
    };
    await fs.writeFile(NAME_MAP_FILE, JSON.stringify(payload, null, 2), 'utf-8');
}

async function writeStatsManifest(nameMapEntries) {
    const countries = new Set();
    let aviationPhotos = 0;
    let travelPhotos = 0;

    for (const posixKey of Object.keys(nameMapEntries)) {
        const parts = posixKey.split('/');
        const label = parts[0];
        const country = parts[2];

        if (label === 'Aviation') aviationPhotos++;
        else if (label === 'Travel') travelPhotos++;

        if (country) countries.add(country.replace(/_/g, ' '));
    }

    const manifest = {
        aviationPhotos,
        travelPhotos,
        totalPhotos: aviationPhotos + travelPhotos,
        countriesPresented: countries.size
    };

    await fs.mkdir(path.dirname(STATS_MANIFEST_FILE), { recursive: true });
    await fs.writeFile(STATS_MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf-8');
    console.log(`Wrote stats manifest to ${STATS_MANIFEST_FILE} ->`, manifest);
}

function toPosixPath(value) {
    return value.split(path.sep).join('/');
}

async function writeOriginal(sourceFilePath, destinationFilePath) {
    if (await exists(destinationFilePath)) {
        console.log(`Skipped duplicate original: ${destinationFilePath}`);
        return 0;
    }

    await fs.mkdir(path.dirname(destinationFilePath), { recursive: true });
    await fs.copyFile(sourceFilePath, destinationFilePath);
    console.log(`Copied original: ${sourceFilePath} -> ${destinationFilePath}`);
    return 1;
}

async function writeVariant(sourceFilePath, destinationFilePath, variant) {
    if (await exists(destinationFilePath)) {
        console.log(`Skipped duplicate ${variant.folder}: ${destinationFilePath}`);
        return 0;
    }

    await fs.mkdir(path.dirname(destinationFilePath), { recursive: true });

    let pipeline = sharp(sourceFilePath, { failOn: 'none' });
    if (variant.resize) {
        pipeline = pipeline.resize(variant.resize);
    }

    await pipeline
        .jpeg({ quality: variant.quality, mozjpeg: true, progressive: true })
        .toFile(destinationFilePath);

    console.log(`Generated ${variant.folder}: ${sourceFilePath} -> ${destinationFilePath}`);
    return 1;
}

async function exists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

function readDbConfig() {
    let file = {};
    try {
        file = JSON.parse(fsSync.readFileSync(DB_SECRETS_FILE, 'utf-8'));
    } catch {
        // Secrets file optional — fall back to env vars
    }

    return {
        host:       file.host       || process.env.GALLERY_DB_HOST      || 'db5020224670.hosting-data.io',
        port:       parseInt(file.port || process.env.GALLERY_DB_PORT   || '3306', 10),
        database:   file.database   || process.env.GALLERY_DB_NAME      || 'dbs15552605',
        user:       file.username   || process.env.GALLERY_DB_USER      || 'dbu595115',
        password:   file.password   || process.env.GALLERY_DB_PASS      || process.env.GALLERY_DB_PASSWORD || process.env.DB_PASSWORD || '',
        charset:    file.charset    || process.env.GALLERY_DB_CHARSET   || 'utf8mb4',
        syncApiUrl: file.syncApiUrl || process.env.GALLERY_SYNC_API_URL || '',
        syncApiKey: file.syncApiKey || process.env.GALLERY_SYNC_API_KEY || '',
    };
}

function humanizeSegment(value) {
    return value.replace(/_/g, ' ').trim();
}

function buildSyncRows(nameMapEntries) {
    const rows = [];
    for (const [posixKey, entry] of Object.entries(nameMapEntries)) {
        const parts = posixKey.split('/');
        if (parts.length < 2) continue;

        rows.push({
            category:       humanizeSegment(parts[0] || 'Unknown'),
            continent:      humanizeSegment(parts[1] || 'Unknown'),
            country:        humanizeSegment(parts[2] || 'Unknown'),
            title:          (entry.originalTitle || entry.sanitizedFileName.replace(/\.[^.]+$/, '')).trim(),
            title_de:       null,
            description:    null,
            description_de: null,
            path_original:  `original/${posixKey}`,
            path_grid:      `grid/${posixKey}`,
            path_thumbnail: `thumbnail/${posixKey}`,
        });
    }
    return rows;
}

async function syncToDatabase(nameMapEntries) {
    const config = readDbConfig();
    const hasMySQL = !!config.password;
    const hasHttp  = !!(config.syncApiUrl && config.syncApiKey);

    if (!hasMySQL && !hasHttp) {
        console.warn('DB sync skipped: no credentials configured (set secrets/gallery-db.local.json).');
        return;
    }

    if (hasMySQL) {
        const error = await trySyncViaMySQL(config, nameMapEntries);
        if (!error) return;

        const isNetworkError = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT'].some(
            code => error.code === code || error.message.includes(code)
        );

        if (isNetworkError && hasHttp) {
            console.warn(`MySQL unreachable (${error.message}), falling back to HTTP sync...`);
        } else {
            console.error('DB sync failed (images were still copied):', error.message);
            return;
        }
    }

    if (hasHttp) {
        await trySyncViaHttp(config, nameMapEntries);
    }
}

async function trySyncViaMySQL(config, nameMapEntries) {
    let connection;
    try {
        const mysql = require('mysql2/promise');
        connection = await mysql.createConnection({
            host: config.host, port: config.port,
            database: config.database, user: config.user,
            password: config.password, charset: config.charset,
        });

        const [existingRows] = await connection.execute('SELECT path_grid FROM images');
        const existingGridPaths = new Set(existingRows.map(r => r.path_grid));

        const newRows = buildSyncRows(nameMapEntries).filter(r => !existingGridPaths.has(r.path_grid));

        if (newRows.length === 0) {
            console.log('DB sync (MySQL): no new images to insert.');
            return null;
        }

        const values = newRows.map(r => [
            r.category, r.continent, r.country,
            r.title, r.title_de, r.description, r.description_de,
            r.path_original, r.path_grid, r.path_thumbnail, 1,
        ]);

        await connection.query(`
            INSERT INTO images
                (category, continent, country,
                 title, title_de, description, description_de,
                 path_original, path_grid, path_thumbnail, is_active)
            VALUES ?
            ON DUPLICATE KEY UPDATE
                category       = VALUES(category),
                continent      = VALUES(continent),
                country        = VALUES(country),
                title          = COALESCE(NULLIF(images.title, ''),          VALUES(title)),
                title_de       = COALESCE(NULLIF(images.title_de, ''),       VALUES(title_de)),
                description    = COALESCE(NULLIF(images.description, ''),    VALUES(description)),
                description_de = COALESCE(NULLIF(images.description_de, ''), VALUES(description_de)),
                path_original  = VALUES(path_original),
                path_thumbnail = VALUES(path_thumbnail),
                is_active      = 1,
                updated_at     = CURRENT_TIMESTAMP
        `, [values]);

        console.log(`DB sync (MySQL): inserted ${newRows.length} new image(s).`);
        return null;
    } catch (error) {
        return error;
    } finally {
        if (connection) await connection.end();
    }
}

async function trySyncViaHttp(config, nameMapEntries) {
    try {
        const https = require('https');
        const body = JSON.stringify(buildSyncRows(nameMapEntries));
        const url = new URL(config.syncApiUrl);

        await new Promise((resolve, reject) => {
            const req = https.request({
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                    'X-Sync-Key': config.syncApiKey,
                },
            }, (res) => {
                let data = '';
                res.on('data', chunk => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.ok) {
                            console.log(`DB sync (HTTP): upserted ${json.upserted} image(s).`);
                            resolve();
                        } else {
                            reject(new Error(json.error || 'Unknown server error'));
                        }
                    } catch {
                        reject(new Error(`Invalid response: ${data.slice(0, 200)}`));
                    }
                });
            });
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    } catch (error) {
        console.error('DB sync (HTTP) failed (images were still copied):', error.message);
    }
}

main().catch((error) => {
    console.error('Copy process failed:', error);
    process.exitCode = 1;
});
