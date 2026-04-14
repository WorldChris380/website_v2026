const fs = require('fs/promises');
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
        quality: 80
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

    const copiedOriginalCount = await writeOriginal(sourceFilePath, originalPath);
    const generatedGridCount = await writeVariant(sourceFilePath, gridPath, VARIANTS.grid);
    const generatedThumbnailCount = await writeVariant(sourceFilePath, thumbnailPath, VARIANTS.thumbnail);

    return {
        copiedOriginalCount,
        generatedGridCount,
        generatedThumbnailCount,
        skippedCount: copiedOriginalCount === 0 && generatedGridCount === 0 && generatedThumbnailCount === 0 ? 1 : 0
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

main().catch((error) => {
    console.error('Copy process failed:', error);
    process.exitCode = 1;
});
