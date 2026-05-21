function startsWithAscii(bytes: Uint8Array, ascii: string): boolean {
  if (bytes.length < ascii.length) return false;
  for (let i = 0; i < ascii.length; i += 1) {
    if (bytes[i] !== ascii.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function containsAscii(bytes: Uint8Array, ascii: string): boolean {
  if (ascii.length === 0 || bytes.length < ascii.length) return false;
  outer: for (let i = 0; i <= bytes.length - ascii.length; i += 1) {
    for (let j = 0; j < ascii.length; j += 1) {
      if (bytes[i + j] !== ascii.charCodeAt(j)) {
        continue outer;
      }
    }
    return true;
  }
  return false;
}

export function isLikelyOggOpus(bytes: Uint8Array): boolean {
  if (!startsWithAscii(bytes, "OggS")) {
    return false;
  }

  // Opus header should appear near the beginning of a valid OGG/Opus stream.
  const probeSize = Math.min(bytes.length, 4096);
  const probe = bytes.subarray(0, probeSize);
  return containsAscii(probe, "OpusHead");
}
