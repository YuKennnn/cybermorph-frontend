const CANONICAL_DOWNLOAD_URL = 'https://cybermorph-frontend.vercel.app/download'

/**
 * Resolves the canonical public HTTPS URL for the CyberMorph Download page.
 * Never returns localhost, 127.0.0.1, or non-HTTPS development addresses.
 *
 * @param {string} [siteUrlOverride]
 * @returns {string}
 */
export const resolvePublicDownloadPageUrl = (siteUrlOverride) => {
  const candidate = (
    siteUrlOverride ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SITE_URL) ||
    ''
  ).trim()

  if (candidate) {
    try {
      const parsed = new URL(candidate)
      const host = parsed.hostname.toLowerCase()
      const isLocalOrDev =
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        host === '[::1]' ||
        host.endsWith('.local') ||
        host.endsWith('.localhost')

      if (parsed.protocol === 'https:' && !isLocalOrDev) {
        const cleanOrigin = `${parsed.protocol}//${parsed.host}`
        return `${cleanOrigin}/download`
      }
    } catch {
      // Fall back to canonical URL on invalid URL
    }
  }

  return CANONICAL_DOWNLOAD_URL
}

// ============================================================================
// ISO/IEC 18004 QR Code Generator (Byte Mode, Error Correction Level M)
// Zero external dependencies; renders crisp SVG module grids with quiet zone.
// ============================================================================

// Version 1..10 capabilities for Error Correction Level M:
// [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
const VERSION_TABLE_M = [
  null,
  [26, 10, 1, 16, 0, 0],   // V1
  [44, 16, 1, 28, 0, 0],   // V2
  [70, 26, 1, 44, 0, 0],   // V3
  [100, 18, 2, 32, 0, 0],  // V4
  [134, 24, 2, 43, 0, 0],  // V5
  [172, 16, 4, 27, 0, 0],  // V6
  [196, 18, 4, 31, 0, 0],  // V7
  [242, 22, 2, 38, 2, 39], // V8
  [292, 22, 3, 36, 2, 37], // V9
  [346, 26, 4, 43, 1, 44], // V10
]

const ALIGNMENT_PATTERNS = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
]

// Galois Field GF(256) with primitive polynomial 0x11d
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)
;(() => {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]
  }
})()

const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]])

const buildGeneratorPoly = (degree) => {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const root = GF_EXP[i]
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], root)
    }
    poly = next
  }
  return poly
}

const computeReedSolomon = (dataBytes, ecLen) => {
  const gen = buildGeneratorPoly(ecLen)
  const msg = new Uint8Array(dataBytes.length + ecLen)
  msg.set(dataBytes, 0)

  for (let i = 0; i < dataBytes.length; i++) {
    const coef = msg[i]
    if (coef !== 0) {
      for (let j = 1; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef)
      }
    }
  }
  return msg.slice(dataBytes.length)
}

const getDataCapacityBytes = (version) => {
  const info = VERSION_TABLE_M[version]
  return info[2] * info[3] + info[4] * info[5]
}

const selectVersion = (byteLength) => {
  for (let v = 1; v <= 10; v++) {
    const totalDataCodewords = getDataCapacityBytes(v)
    // Byte mode overhead: 4 bits mode + (8 or 16 bits length) = 12 bits (1.5 bytes -> 2 bytes) for v1..9
    const headerBits = v <= 9 ? 12 : 20
    const availableBits = totalDataCodewords * 8 - headerBits
    if (byteLength * 8 <= availableBits) return v
  }
  throw new Error('QR payload exceeds supported version capacity')
}

const encodeDataCodewords = (utf8Bytes, version) => {
  const totalDataCodewords = getDataCapacityBytes(version)
  const bits = []
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1)
    }
  }

  // Byte mode indicator (0100)
  pushBits(0b0100, 4)
  // Character count indicator (8 bits for v1..9, 16 bits for v10+)
  pushBits(utf8Bytes.length, version <= 9 ? 8 : 16)

  for (let i = 0; i < utf8Bytes.length; i++) {
    pushBits(utf8Bytes[i], 8)
  }

  // Terminator (up to 4 zero bits)
  const maxBits = totalDataCodewords * 8
  const terminatorLen = Math.min(4, maxBits - bits.length)
  pushBits(0, terminatorLen)

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0)
  }

  const codewords = new Uint8Array(totalDataCodewords)
  let byteIdx = 0
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j]
    }
    codewords[byteIdx++] = b
  }

  // Pad codewords alternating 0xEC, 0x11
  let padToggle = true
  while (byteIdx < totalDataCodewords) {
    codewords[byteIdx++] = padToggle ? 0xec : 0x11
    padToggle = !padToggle
  }

  return codewords
}

const interleaveCodewords = (dataCodewords, version) => {
  const [, ecLen, g1Blocks, g1DataLen, g2Blocks, g2DataLen] = VERSION_TABLE_M[version]
  const dataBlocks = []
  const ecBlocks = []
  let offset = 0

  for (let i = 0; i < g1Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g1DataLen)
    offset += g1DataLen
    dataBlocks.push(block)
    ecBlocks.push(computeReedSolomon(block, ecLen))
  }

  for (let i = 0; i < g2Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g2DataLen)
    offset += g2DataLen
    dataBlocks.push(block)
    ecBlocks.push(computeReedSolomon(block, ecLen))
  }

  const result = []
  const maxDataLen = Math.max(g1DataLen, g2DataLen)
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < dataBlocks.length; b++) {
      if (i < dataBlocks[b].length) {
        result.push(dataBlocks[b][i])
      }
    }
  }

  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      result.push(ecBlocks[b][i])
    }
  }

  return new Uint8Array(result)
}

const placeFinderPattern = (matrix, reserved, row, col) => {
  const size = matrix.length
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = row + r
      const cc = col + c
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue
      const inOuter = r >= 0 && r <= 6 && (c === 0 || c === 6)
      const inTopBot = c >= 0 && c <= 6 && (r === 0 || r === 6)
      const inCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4
      matrix[rr][cc] = inOuter || inTopBot || inCenter
      reserved[rr][cc] = true
    }
  }
}

const placeAlignmentPattern = (matrix, reserved, centerR, centerC) => {
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centerR + r
      const cc = centerC + c
      const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2
      const isCenter = r === 0 && c === 0
      matrix[rr][cc] = isBorder || isCenter
      reserved[rr][cc] = true
    }
  }
}

const computeFormatBits = (ecLevelBits, maskPattern) => {
  const data = (ecLevelBits << 3) | maskPattern
  let rem = data << 10
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= 0x537 << (i - 10)
    }
  }
  return ((data << 10) | rem) ^ 0x5412
}

const placeFormatInfo = (matrix, maskPattern) => {
  // Error correction level M format bits = 00
  const bits = computeFormatBits(0b00, maskPattern)
  const size = matrix.length

  for (let i = 0; i < 15; i++) {
    const bit = ((bits >>> i) & 1) === 1

    // Top-left around finder
    if (i < 6) {
      matrix[i][8] = bit
    } else if (i < 8) {
      matrix[i + 1][8] = bit
    } else {
      matrix[8][14 - i] = bit
    }

    // Bottom-left and top-right
    if (i < 8) {
      matrix[8][size - 1 - i] = bit
    } else {
      matrix[size - 15 + i][8] = bit
    }
  }
  // Dark module
  matrix[size - 8][8] = true
}

const applyMask = (r, c, maskPattern) => {
  switch (maskPattern) {
    case 0:
      return (r + c) % 2 === 0
    case 1:
      return r % 2 === 0
    case 2:
      return c % 3 === 0
    case 3:
      return (r + c) % 3 === 0
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0
    case 7:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
    default:
      return false
  }
}

const computePenalty = (matrix) => {
  const size = matrix.length
  let penalty = 0

  // Rule 1: 5+ consecutive modules of same color in row/col
  for (let r = 0; r < size; r++) {
    let runColor = matrix[r][0]
    let runLen = 1
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === runColor) {
        runLen++
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5)
        runColor = matrix[r][c]
        runLen = 1
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5)
  }

  for (let c = 0; c < size; c++) {
    let runColor = matrix[0][c]
    let runLen = 1
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === runColor) {
        runLen++
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5)
        runColor = matrix[r][c]
        runLen = 1
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5)
  }

  // Rule 2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const val = matrix[r][c]
      if (
        matrix[r][c + 1] === val &&
        matrix[r + 1][c] === val &&
        matrix[r + 1][c + 1] === val
      ) {
        penalty += 3
      }
    }
  }

  // Rule 3: Finder-like 1:1:3:1:1 patterns bounded by 4 light modules
  const matchesFinderLike = (arr, idx) => {
    if (
      !arr[idx] ||
      arr[idx + 1] ||
      !arr[idx + 2] ||
      !arr[idx + 3] ||
      !arr[idx + 4] ||
      arr[idx + 5] ||
      !arr[idx + 6]
    ) {
      return false
    }
    const leftLight =
      idx >= 4 && !arr[idx - 1] && !arr[idx - 2] && !arr[idx - 3] && !arr[idx - 4]
    const rightLight =
      idx + 10 < arr.length &&
      !arr[idx + 7] &&
      !arr[idx + 8] &&
      !arr[idx + 9] &&
      !arr[idx + 10]
    return leftLight || rightLight
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 7; c++) {
      if (matchesFinderLike(matrix[r], c)) penalty += 40
    }
  }

  for (let c = 0; c < size; c++) {
    const colArr = new Array(size)
    for (let r = 0; r < size; r++) colArr[r] = matrix[r][c]
    for (let r = 0; r <= size - 7; r++) {
      if (matchesFinderLike(colArr, r)) penalty += 40
    }
  }

  // Rule 4: Balance of dark and light modules
  let darkCount = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) darkCount++
    }
  }
  const total = size * size
  const k = Math.floor((Math.abs(darkCount * 20 - total * 10) + total - 1) / total) - 1
  if (k > 0) penalty += k * 10

  return penalty
}

/**
 * Generates an ISO/IEC 18004 2D boolean QR module matrix for the given text.
 *
 * @param {string} text
 * @returns {{ modules: boolean[][], size: number, version: number, mask: number }}
 */
export const generateQrMatrix = (text) => {
  const utf8Bytes = new TextEncoder().encode(text)
  const version = selectVersion(utf8Bytes.length)
  const size = version * 4 + 17

  const dataCodewords = encodeDataCodewords(utf8Bytes, version)
  const allCodewords = interleaveCodewords(dataCodewords, version)

  const baseMatrix = Array.from({ length: size }, () => new Array(size).fill(false))
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false))

  // 1. Finder patterns + separators
  placeFinderPattern(baseMatrix, reserved, 0, 0)
  placeFinderPattern(baseMatrix, reserved, 0, size - 7)
  placeFinderPattern(baseMatrix, reserved, size - 7, 0)

  // 2. Alignment patterns
  const alignCoords = ALIGNMENT_PATTERNS[version]
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const r = alignCoords[i]
      const c = alignCoords[j]
      if (reserved[r][c]) continue
      placeAlignmentPattern(baseMatrix, reserved, r, c)
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) {
      baseMatrix[6][i] = i % 2 === 0
      reserved[6][i] = true
    }
    if (!reserved[i][6]) {
      baseMatrix[i][6] = i % 2 === 0
      reserved[i][6] = true
    }
  }

  // 4. Reserve format information areas + dark module
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true
    reserved[i][8] = true
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }
  baseMatrix[size - 8][8] = true
  reserved[size - 8][8] = true

  // 5. Place data bits in upward/downward 2-column zig-zag
  let bitIdx = 0
  const totalBits = allCodewords.length * 8
  let upward = true

  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5 // Skip vertical timing pattern column
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc
        if (reserved[r][c]) continue
        let bit = false
        if (bitIdx < totalBits) {
          const byteVal = allCodewords[bitIdx >>> 3]
          bit = ((byteVal >>> (7 - (bitIdx & 7))) & 1) === 1
          bitIdx++
        }
        baseMatrix[r][c] = bit
      }
    }
    upward = !upward
  }

  // 6. Evaluate all 8 masks and choose lowest penalty
  let bestMatrix = null
  let bestMask = 0
  let bestPenalty = Infinity

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseMatrix.map((row, r) =>
      row.map((val, c) => (!reserved[r][c] && applyMask(r, c, mask) ? !val : val)),
    )
    placeFormatInfo(candidate, mask)
    const p = computePenalty(candidate)
    if (p < bestPenalty) {
      bestPenalty = p
      bestMatrix = candidate
      bestMask = mask
    }
  }

  return {
    modules: bestMatrix,
    size,
    version,
    mask: bestMask,
  }
}

/**
 * Decodes a 2D boolean QR module matrix (Byte mode, Level M) back into its UTF-8 string.
 * Used to verify generated and rendered QR codes.
 *
 * @param {boolean[][]} matrix
 * @returns {string}
 */
export const decodeQrMatrix = (matrix) => {
  const size = matrix.length
  const version = (size - 17) / 4
  if (!Number.isInteger(version) || version < 1 || version > 10) {
    throw new Error(`Unsupported QR matrix size: ${size}`)
  }

  // Read format info from top-left around finder
  let formatBits = 0
  for (let i = 0; i < 15; i++) {
    let bit = false
    if (i < 6) bit = matrix[i][8]
    else if (i < 8) bit = matrix[i + 1][8]
    else bit = matrix[8][14 - i]
    if (bit) formatBits |= 1 << i
  }
  const unmaskedFormat = formatBits ^ 0x5412
  const maskPattern = (unmaskedFormat >>> 10) & 0b111

  // Build reserved map to extract data bits
  const reserved = Array.from({ length: size }, () => new Array(size).fill(false))
  const dummy = Array.from({ length: size }, () => new Array(size).fill(false))
  placeFinderPattern(dummy, reserved, 0, 0)
  placeFinderPattern(dummy, reserved, 0, size - 7)
  placeFinderPattern(dummy, reserved, size - 7, 0)

  const alignCoords = ALIGNMENT_PATTERNS[version]
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const r = alignCoords[i]
      const c = alignCoords[j]
      if (!reserved[r][c]) placeAlignmentPattern(dummy, reserved, r, c)
    }
  }
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true
    reserved[i][6] = true
  }
  for (let i = 0; i < 9; i++) {
    reserved[8][i] = true
    reserved[i][8] = true
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }
  reserved[size - 8][8] = true

  // Extract unmasked bits
  const rawBits = []
  let upward = true
  for (let rightCol = size - 1; rightCol >= 1; rightCol -= 2) {
    if (rightCol === 6) rightCol = 5
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert
      for (let dc = 0; dc < 2; dc++) {
        const c = rightCol - dc
        if (reserved[r][c]) continue
        const maskedBit = matrix[r][c]
        const bit = applyMask(r, c, maskPattern) ? !maskedBit : maskedBit
        rawBits.push(bit ? 1 : 0)
      }
    }
    upward = !upward
  }

  const [totalCodewords, , g1Blocks, g1DataLen, g2Blocks, g2DataLen] = VERSION_TABLE_M[version]
  const allCodewords = new Uint8Array(totalCodewords)
  for (let i = 0; i < totalCodewords; i++) {
    let b = 0
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (rawBits[i * 8 + j] || 0)
    }
    allCodewords[i] = b
  }

  // De-interleave data blocks
  const totalBlocks = g1Blocks + g2Blocks
  const dataBlocks = Array.from({ length: totalBlocks }, (_, b) =>
    new Uint8Array(b < g1Blocks ? g1DataLen : g2DataLen),
  )
  const maxDataLen = Math.max(g1DataLen, g2DataLen)
  let idx = 0
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < totalBlocks; b++) {
      if (i < dataBlocks[b].length) {
        dataBlocks[b][i] = allCodewords[idx++]
      }
    }
  }

  const dataBits = []
  for (const block of dataBlocks) {
    for (let i = 0; i < block.length; i++) {
      for (let j = 7; j >= 0; j--) {
        dataBits.push((block[i] >>> j) & 1)
      }
    }
  }

  const readBits = (start, len) => {
    let val = 0
    for (let i = 0; i < len; i++) {
      val = (val << 1) | dataBits[start + i]
    }
    return val
  }

  const mode = readBits(0, 4)
  if (mode !== 0b0100) {
    throw new Error(`Expected Byte mode (4), got ${mode}`)
  }
  const lenBits = version <= 9 ? 8 : 16
  const byteLen = readBits(4, lenBits)
  const bytes = new Uint8Array(byteLen)
  let bitPos = 4 + lenBits
  for (let i = 0; i < byteLen; i++) {
    bytes[i] = readBits(bitPos, 8)
    bitPos += 8
  }

  return new TextDecoder().decode(bytes)
}
