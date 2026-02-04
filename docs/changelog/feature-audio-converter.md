# Changelog - Feature: Audio Converter

**Feature**: AudioConverter helpers + demo integration  
**Date**: February 4, 2026

## 🚀 New Features

### Audio conversion helpers (browser-only)

Added a new audio conversion module that prepares audio for Whisper (`Float32Array` at 16kHz):

- `convertFromFile(file, options?, callbacks?)`
- `convertFromArrayBuffer(buffer, options?, callbacks?)`
- `convertFromFloat32Array(data, options?, callbacks?)` (supports `inputSampleRate`)
- `convertFromMediaStream(stream, options?, callbacks?)` (microphone via `MediaRecorder`)
- `convertFromAudioElement(audioEl, options?, callbacks?)` (prefers `fetch(src)` when possible, falls back to `captureStream()` when available)

Also exported audio types:

- `AudioConverterOptions`, `AudioConversionResult`, `AudioConverterCallbacks`, `AudioInfo`, `AudioFormat`

## 🧩 Demo updates

The React demo now uses the public AudioConverter API and supports:

- Transcription from an uploaded file
- Transcription from an `<audio>` element (when allowed by CORS / browser capabilities)
- Microphone recording and transcription (Start/Stop flow)

## 📝 Notes / Caveats

- AudioConverter relies on Web APIs (`Web Audio`, `MediaRecorder`), so it is **browser-only**. Node.js support is not guaranteed and is tracked as a planned task.
- `<audio>` conversion may require proper CORS headers to allow `fetch()` of the audio URL.
