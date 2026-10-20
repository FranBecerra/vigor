// Reproducible, original two-note PCM chime; no external audio or voice assets.
import { mkdirSync, writeFileSync } from 'node:fs';
const rate = 22050;
const duration = 0.8;
const count = Math.round(rate * duration);
const buffer = Buffer.alloc(44 + count * 2);
buffer.write('RIFF', 0); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
buffer.write('data', 36); buffer.writeUInt32LE(count * 2, 40);
for (let i = 0; i < count; i++) {
  const time = i / rate; const local = time < 0.4 ? time : time - 0.4;
  const envelope = Math.min(1, local / 0.008) * Math.exp(-local * 9);
  buffer.writeInt16LE(Math.round(14000 * envelope * Math.sin(2 * Math.PI * (time < 0.4 ? 880 : 1174.66) * local)), 44 + i * 2);
}
mkdirSync(new URL('../assets/audio/', import.meta.url), { recursive: true });
writeFileSync(new URL('../assets/audio/rest-chime.wav', import.meta.url), buffer);
