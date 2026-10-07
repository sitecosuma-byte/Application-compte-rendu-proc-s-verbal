/**
 * Import d'un fichier audio existant (dictaphone, WhatsApp, enregistreur…).
 *
 * Les hébergeurs serverless (Vercel) limitent la taille d'une requête à ~4,5 Mo.
 * Le fichier est donc décodé dans le navigateur, converti en mono 16 kHz (format idéal
 * pour Whisper) puis découpé en morceaux WAV d'environ 60 s (~1,9 Mo chacun).
 */

const TARGET_RATE = 16000;

export async function splitAudioFile(file: File, chunkSeconds = 60): Promise<Blob[]> {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(await file.arrayBuffer());
  } finally {
    ctx.close().catch(() => undefined);
  }

  // Rééchantillonnage + mixage mono via OfflineAudioContext
  const length = Math.ceil(decoded.duration * TARGET_RATE);
  const offline = new OfflineAudioContext(1, length, TARGET_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const rendered = await offline.startRendering();
  const pcm = rendered.getChannelData(0);

  const chunkLen = chunkSeconds * TARGET_RATE;
  const blobs: Blob[] = [];
  for (let i = 0; i < pcm.length; i += chunkLen) {
    blobs.push(encodeWav(pcm.subarray(i, Math.min(i + chunkLen, pcm.length)), TARGET_RATE));
  }
  return blobs;
}

/** Encode des échantillons Float32 mono en WAV PCM 16 bits. */
export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // taille du bloc fmt
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // octets/seconde
  view.setUint16(32, 2, true); // alignement
  view.setUint16(34, 16, true); // bits/échantillon
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}
