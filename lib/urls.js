'use strict';

const YOUTUBE_RE = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch(\?.*)?|shorts\/|playlist\?|embed\/|live\/)|youtu\.be\/|music\.youtube\.com\/)/i;
const INSTAGRAM_RE = /^(https?:\/\/)?(www\.)?instagram\.com\/(p\/|reel\/|reels\/|tv\/|stories\/)/i;
const INSTAGRAM_ANY_RE = /^(https?:\/\/)?(www\.)?instagram\.com\//i;

function normalizeUrl(str) {
  return (str || '').trim().replace(/[)\]},.;]+$/g, '');
}

function getMediaPlatform(url) {
  const u = normalizeUrl(url);
  if (!u) return null;
  if (YOUTUBE_RE.test(u) || /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(u)) {
    return 'youtube';
  }
  if (INSTAGRAM_ANY_RE.test(u) || /^(https?:\/\/)?(www\.)?instagr\.am\//i.test(u)) {
    return 'instagram';
  }
  return null;
}

function isSupportedMediaUrl(url) {
  return !!getMediaPlatform(url);
}

function isYouTubeUrl(url) {
  return getMediaPlatform(url) === 'youtube';
}

function isInstagramUrl(url) {
  return getMediaPlatform(url) === 'instagram';
}

function getInstagramContentKind(url) {
  const u = normalizeUrl(url).toLowerCase();
  if (u.includes('/stories/')) return 'story';
  if (u.includes('/reel/') || u.includes('/reels/')) return 'reel';
  if (u.includes('/p/') || u.includes('/tv/')) return 'post';
  return 'post';
}

const PROTO_PREFIX = /^wavesconverter:\/\//i;

function stripWavesProtocol(text) {
  return (text || '').trim().replace(PROTO_PREFIX, '');
}

/** wavesconverter://https://youtu.be/… lub wavesconverter://youtu.be/… → zwykły https URL */
function unwrapWavesProtocolLink(text) {
  const raw = (text || '').trim();
  if (!PROTO_PREFIX.test(raw)) return null;

  const after = stripWavesProtocol(raw);

  const embedded = after.match(/https?:\/\/[^\s<>"']+/i);
  if (embedded) {
    const u = normalizeUrl(embedded[0]);
    if (isSupportedMediaUrl(u)) return u;
  }

  try {
    const u = new URL(raw);
    const action = (u.hostname || '').toLowerCase();
    const knownActions = new Set(['download', 'queue', 'open', 'convert']);
    if (!knownActions.has(action) && u.hostname) {
      const candidate = normalizeUrl(`https://${u.hostname}${u.pathname}${u.search}${u.hash}`);
      if (isSupportedMediaUrl(candidate)) return candidate;
    }
    let pathPart = u.pathname.replace(/^\//, '');
    if (pathPart.startsWith('//')) {
      const candidate = normalizeUrl(`https:${pathPart}${u.search}${u.hash}`);
      if (isSupportedMediaUrl(candidate)) return candidate;
    }
    if (/^https?:\/\//i.test(pathPart)) {
      const candidate = normalizeUrl(pathPart);
      if (isSupportedMediaUrl(candidate)) return candidate;
    }
  } catch (_) {}

  if (after && !/^https?:\/\//i.test(after)) {
    const candidate = normalizeUrl(`https://${after.replace(/^\/+/, '')}`);
    if (isSupportedMediaUrl(candidate)) return candidate;
  }

  return null;
}

function extractMediaUrls(text) {
  const found = new Set();
  const raw = text || '';

  const protoWrapped = /wavesconverter:\/\/\/?\/?(https?:\/\/[^\s<>"']+)/gi;
  let m;
  while ((m = protoWrapped.exec(raw)) !== null) {
    const cleaned = normalizeUrl(m[1]);
    if (isSupportedMediaUrl(cleaned)) found.add(cleaned);
  }

  const protoBare = /wavesconverter:\/\/([^\s<>"']+)/gi;
  while ((m = protoBare.exec(raw)) !== null) {
    const unwrapped = unwrapWavesProtocolLink(`wavesconverter://${m[1]}`);
    if (unwrapped) found.add(unwrapped);
  }

  const re = /https?:\/\/[^\s<>"']+/gi;
  while ((m = re.exec(raw)) !== null) {
    const cleaned = normalizeUrl(m[0]);
    if (isSupportedMediaUrl(cleaned)) found.add(cleaned);
  }
  raw.split(/\s+/).filter(Boolean).forEach(part => {
    const unwrapped = unwrapWavesProtocolLink(part);
    if (unwrapped) {
      found.add(unwrapped);
      return;
    }
    const cleaned = normalizeUrl(part);
    if (isSupportedMediaUrl(cleaned)) found.add(cleaned);
  });
  return [...found];
}

module.exports = {
  normalizeUrl,
  getMediaPlatform,
  isSupportedMediaUrl,
  isYouTubeUrl,
  isInstagramUrl,
  getInstagramContentKind,
  extractMediaUrls,
  unwrapWavesProtocolLink,
  stripWavesProtocol,
};
