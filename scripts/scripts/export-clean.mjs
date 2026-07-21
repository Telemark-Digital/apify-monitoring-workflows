import { copyFile, lstat, mkdir, readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const destination = process.argv[2] ? path.resolve(process.argv[2]) : null;

if (!destination) throw new Error('Usage: npm run export:clean -- <new-or-empty-destination>');
if (destination === root || destination.startsWith(`${root}${path.sep}`)) {
    throw new Error('Destination must be outside the staging tree.');
}

await mkdir(destination, { recursive: true });
const destinationInfo = await lstat(destination);
if (destinationInfo.isSymbolicLink()) throw new Error('Destination must not be a symbolic link or reparse point.');
const realRoot = await realpath(root);
const realDestination = await realpath(destination);
if (realDestination === realRoot || realDestination.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error('Destination must resolve outside the staging tree.');
}
const existing = await readdir(destination);
if (existing.length > 0) throw new Error('Destination must be empty.');

const manifest = JSON.parse(await readFile(path.join(root, 'public-files.json'), 'utf8'));
if (!Array.isArray(manifest) || manifest.some((entry) => typeof entry !== 'string')) {
    throw new Error('public-files.json must be an array of relative file paths.');
}
if (new Set(manifest).size !== manifest.length) {
    throw new Error('public-files.json must not contain duplicate entries.');
}

for (const relativePath of manifest) {
    const normalized = path.posix.normalize(relativePath);
    if (
        normalized !== relativePath
        || normalized === '.'
        || normalized.startsWith('../')
        || path.posix.isAbsolute(normalized)
        || normalized.includes('\\')
    ) {
        throw new Error(`Unsafe manifest path: ${relativePath}`);
    }

    const source = path.resolve(root, ...normalized.split('/'));
    if (!source.startsWith(`${root}${path.sep}`)) throw new Error(`Source escapes staging root: ${relativePath}`);
    let sourceComponent = root;
    for (const part of normalized.split('/')) {
        sourceComponent = path.join(sourceComponent, part);
        const componentInfo = await lstat(sourceComponent);
        if (componentInfo.isSymbolicLink()) throw new Error(`Manifest path contains a symbolic link or reparse point: ${relativePath}`);
    }
    const realSource = await realpath(source);
    if (!realSource.startsWith(`${realRoot}${path.sep}`)) throw new Error(`Source resolves outside staging root: ${relativePath}`);
    const sourceStat = await stat(source);
    if (!sourceStat.isFile()) throw new Error(`Manifest entry is not a file: ${relativePath}`);
    const target = path.resolve(realDestination, ...normalized.split('/'));
    if (!target.startsWith(`${realDestination}${path.sep}`)) throw new Error(`Target escapes destination: ${relativePath}`);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
}

console.log(`Exported ${manifest.length} allowlisted public files to ${destination}`);
