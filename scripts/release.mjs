// Copyright 2026 Jonas Oelschner. Part of Steam Unslop, https://github.com/TimeofJustice/Steam-Unslop
// SPDX-License-Identifier: Apache-2.0

// Builds the release files into release/:
//   steam-unslop-chrome-<version>.zip   browser extension, for "Load unpacked" after extracting
//   steam-unslop.star                   Millennium plugin (needs `bun install` in platforms/millennium)
// Usage: node scripts/release.mjs [--skip-millennium]
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { deflateRawSync } from "node:zlib";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const releaseFolder = join(repositoryRoot, "release");
const { version } = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8"));

execFileSync(process.execPath, [join(repositoryRoot, "scripts/build.mjs")], { stdio: "inherit" });

rmSync(releaseFolder, { recursive: true, force: true });
mkdirSync(releaseFolder, { recursive: true });

const filesIn = folder =>
  readdirSync(folder).flatMap(name => {
    const path = join(folder, name);
    return statSync(path).isDirectory() ? filesIn(path) : [path];
  });

const CRC_TABLE = Array.from({ length: 256 }, (unused, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function localFileHeader(name, data, packed, crc) {
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0x0800, 6);
  header.writeUInt16LE(8, 8);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(packed.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  return header;
}

function centralDirectoryEntry(name, data, packed, crc, offset) {
  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  return entry;
}

function endOfCentralDirectory(entryCount, directorySize, directoryOffset) {
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entryCount, 8);
  end.writeUInt16LE(entryCount, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(directoryOffset, 16);
  return end;
}

// Minimal zip writer (deflate, no zip64), enough for a few small files.
function writeZip(sourceFolder, targetFile) {
  const fileParts = [];
  const directoryParts = [];
  let offset = 0;

  for (const file of filesIn(sourceFolder)) {
    const name = Buffer.from(relative(sourceFolder, file).split("\\").join("/"));
    const data = readFileSync(file);
    const packed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const header = localFileHeader(name, data, packed, crc);
    fileParts.push(header, name, packed);
    directoryParts.push(centralDirectoryEntry(name, data, packed, crc, offset), name);

    offset += header.length + name.length + packed.length;
  }

  const directorySize = directoryParts.reduce((size, part) => size + part.length, 0);
  const entryCount = directoryParts.length / 2;
  const end = endOfCentralDirectory(entryCount, directorySize, offset);

  writeFileSync(targetFile, Buffer.concat([...fileParts, ...directoryParts, end]));
}

const chromeZip = join(releaseFolder, `steam-unslop-chrome-${version}.zip`);
writeZip(join(repositoryRoot, "dist/extension"), chromeZip);
console.log(`Wrote ${relative(repositoryRoot, chromeZip)}`);

if (!process.argv.includes("--skip-millennium")) {
  const starlight = join(
    repositoryRoot,
    "platforms/millennium/node_modules/@steambrew/starlight/bin/starlight.js",
  );
  if (!existsSync(starlight)) {
    throw new Error("Run `bun install` in platforms/millennium first, or pass --skip-millennium.");
  }

  execFileSync(process.execPath, [starlight, "pack", "--release", "-o", releaseFolder], {
    cwd: join(repositoryRoot, "platforms/millennium"),
    stdio: "inherit",
  });
  console.log(`Wrote release/steam-unslop.star`);
}
