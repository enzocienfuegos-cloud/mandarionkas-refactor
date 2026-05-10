import type { ExportBundle, ExportBundleFile } from './bundle';

export type ExportZipArtifact = {
  filename: string;
  bytes: Uint8Array;
  mime: 'application/zip';
};

type EncodedBundleFile = ExportBundleFile & {
  bytes: Uint8Array;
  crc32: number;
  nameBytes: Uint8Array;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function computeCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeBundleFiles(bundle: ExportBundle): EncodedBundleFile[] {
  const encoder = new TextEncoder();
  return bundle.files.map((file) => {
    const bytes = file.bytes ?? encoder.encode(file.content ?? '');
    return {
      ...file,
      bytes,
      crc32: computeCrc32(bytes),
      nameBytes: encoder.encode(file.path),
    };
  });
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function getDosDateTime(date = new Date()): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = ((date.getHours() & 0x1f) << 11)
    | ((date.getMinutes() & 0x3f) << 5)
    | ((Math.floor(date.getSeconds() / 2)) & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9)
    | (((date.getMonth() + 1) & 0xf) << 5)
    | (date.getDate() & 0x1f);
  return { time: dosTime, date: dosDate };
}

function sanitizeArchiveName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'smx-export';
}

export function buildZipFromBundle(bundle: ExportBundle, archiveBaseName: string): ExportZipArtifact {
  const files = encodeBundleFiles(bundle);
  const { time, date } = getDosDateTime();

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const file of files) {
    const localHeader = new Uint8Array(30 + file.nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    writeUint32(localView, 0, 0x04034b50);
    writeUint16(localView, 4, 20);
    writeUint16(localView, 6, 0);
    writeUint16(localView, 8, 0);
    writeUint16(localView, 10, time);
    writeUint16(localView, 12, date);
    writeUint32(localView, 14, file.crc32);
    writeUint32(localView, 18, file.bytes.length);
    writeUint32(localView, 22, file.bytes.length);
    writeUint16(localView, 26, file.nameBytes.length);
    writeUint16(localView, 28, 0);
    localHeader.set(file.nameBytes, 30);

    localParts.push(localHeader, file.bytes);

    const centralHeader = new Uint8Array(46 + file.nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    writeUint32(centralView, 0, 0x02014b50);
    writeUint16(centralView, 4, 20);
    writeUint16(centralView, 6, 20);
    writeUint16(centralView, 8, 0);
    writeUint16(centralView, 10, 0);
    writeUint16(centralView, 12, time);
    writeUint16(centralView, 14, date);
    writeUint32(centralView, 16, file.crc32);
    writeUint32(centralView, 20, file.bytes.length);
    writeUint32(centralView, 24, file.bytes.length);
    writeUint16(centralView, 28, file.nameBytes.length);
    writeUint16(centralView, 30, 0);
    writeUint16(centralView, 32, 0);
    writeUint16(centralView, 34, 0);
    writeUint16(centralView, 36, 0);
    writeUint32(centralView, 38, 0);
    writeUint32(centralView, 42, localOffset);
    centralHeader.set(file.nameBytes, 46);
    centralParts.push(centralHeader);

    localOffset += localHeader.length + file.bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const localSize = localParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  writeUint32(endView, 0, 0x06054b50);
  writeUint16(endView, 4, 0);
  writeUint16(endView, 6, 0);
  writeUint16(endView, 8, files.length);
  writeUint16(endView, 10, files.length);
  writeUint32(endView, 12, centralSize);
  writeUint32(endView, 16, localSize);
  writeUint16(endView, 20, 0);

  const totalSize = localSize + centralSize + endRecord.length;
  const zip = new Uint8Array(totalSize);
  let offset = 0;
  for (const part of [...localParts, ...centralParts, endRecord]) {
    zip.set(part, offset);
    offset += part.length;
  }

  return {
    filename: `${sanitizeArchiveName(archiveBaseName)}.zip`,
    bytes: zip,
    mime: 'application/zip',
  };
}
