# Whisper.wasm

[![CI](https://github.com/timur00kh/whisper.wasm/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/timur00kh/whisper.wasm/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40timur00kh%2Fwhisper.wasm?color=blue)](https://www.npmjs.com/package/@timur00kh/whisper.wasm)
[![npm downloads](https://img.shields.io/npm/dm/%40timur00kh%2Fwhisper.wasm)](https://www.npmjs.com/package/@timur00kh/whisper.wasm)
[![license](https://img.shields.io/npm/l/%40timur00kh%2Fwhisper.wasm)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/timur00kh/whisper.wasm?style=social)](https://github.com/timur00kh/whisper.wasm)
[![issues](https://img.shields.io/github/issues/timur00kh/whisper.wasm)](https://github.com/timur00kh/whisper.wasm/issues)
[![release date](https://img.shields.io/github/release-date/timur00kh/whisper.wasm)](https://github.com/timur00kh/whisper.wasm/releases)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue)](https://timur00kh.github.io/whisper.wasm/)

A TypeScript wrapper for [whisper.cpp](https://github.com/ggml-org/whisper.cpp) that brings OpenAI's Whisper speech recognition to the browser using WebAssembly.

> Note: Node.js support is experimental / untested at the moment. (The core WASM layer may work, but browser-specific helpers like the AudioConverter require Web APIs.)

## Features

- 🎤 **High-quality speech recognition** using OpenAI Whisper models
- ⚡ **WebAssembly performance** - runs directly in the browser
- 🌍 **Multi-language support** with automatic language detection
- 🔄 **Translation capabilities** - translate speech to English
- 📱 **Cross-platform** - browser-first; Node.js is experimental / untested
- 🧠 **Multiple model sizes** - from tiny to large models
- 🎯 **Streaming transcription** - real-time audio processing
- 🎵 **Audio conversion helpers (browser-only)** - convert files / mic / `<audio>` to 16kHz `Float32Array` for Whisper

## Installation

```bash
npm install @timur00kh/whisper.wasm@canary
```

## Quick Start

### Basic Usage

```typescript
import { WhisperWasmService, ModelManager, convertFromFile } from '@timur00kh/whisper.wasm';

// Initialize the service
const whisper = new WhisperWasmService({ logLevel: 1 });
const modelManager = new ModelManager();

// Check WASM support
const isSupported = await whisper.checkWasmSupport();
if (!isSupported) {
  throw new Error('WebAssembly is not supported');
}

// Load a model
const modelData = await modelManager.loadModel('base'); // or 'tiny', 'small', 'medium', 'large'
await whisper.initModel(modelData);

// Create a transcription session for streaming
const session = whisper.createSession();

// Convert an audio/video file to 16kHz Float32Array (browser-only helper)
// (e.g. a File from <input type="file" />)
const { audioData } = await convertFromFile(file, { normalize: true });

// Process audio in chunks
const stream = session.streamimg(audioData, {
  language: 'en',
  threads: 4,
  translate: false,
  sleepMsBetweenChunks: 100,
});

for await (const segment of stream) {
  console.log(`[${segment.timeStart}ms - ${segment.timeEnd}ms]: ${segment.text}`);
}
```

### Model Management

```typescript
import { ModelManager, getAllModels } from '@timur00kh/whisper.wasm';

const modelManager = new ModelManager();

// Get available models
const availableModels = await modelManager.getAvailableModels();
console.log(availableModels);

// Or use the synchronous version
const allModels = getAllModels();

// Load a specific model
const modelData = await modelManager.loadModel('base', true, (progress) => {
  console.log(`Loading progress: ${progress}%`);
});

// Clear cache
await modelManager.clearCache();
```

## API Reference

### WhisperWasmService

Main service class for speech recognition.

#### Constructor

```typescript
new WhisperWasmService(options?: {
  logLevel?: LoggerLevelsType;
  init?: boolean;
})
```

#### Methods

##### `checkWasmSupport(): Promise<boolean>`

Checks if WebAssembly is supported in the current environment.

##### `initModel(model: Uint8Array): Promise<void>`

Loads a Whisper model from binary data.

**Parameters:**

- `model`: Model data as Uint8Array

##### `transcribe(audioData: Float32Array, callback?: WhisperWasmServiceCallback, options?: WhisperWasmTranscriptionOptions): Promise<TranscriptionResult>`

Transcribes audio data to text.

**Parameters:**

- `audioData`: Audio data as Float32Array (16kHz sample rate)
- `callback`: Optional callback function called for each transcribed segment
- `options`: Transcription options (optional)

**Returns:**

```typescript
{
  segments: WhisperWasmServiceCallbackParams[];
  transcribeDurationMs: number;
}
```

##### `createSession(): TranscriptionSession`

Creates a new transcription session for streaming audio.

### ModelManager

Manages Whisper model loading and caching.

#### Methods

##### `getAvailableModels(): Promise<ModelInfo[]>`

Returns information about available models.

##### `loadModel(modelId: string, useCache?: boolean, onProgress?: (progress: number) => void): Promise<Uint8Array>`

Loads a model by ID.

**Parameters:**

- `modelId`: Model identifier ('tiny', 'base', 'small', 'medium', 'large')
- `useCache`: Whether to use cached model if available
- `onProgress`: Progress callback function

##### `clearCache(): Promise<void>`

Clears the model cache.

### TranscriptionSession

Handles streaming audio transcription.

#### Methods

##### `streamimg(audioData: Float32Array, options?: ITranscriptionSessionOptions): AsyncIterableIterator<WhisperWasmServiceCallbackParams>`

Processes audio data in streaming fashion.

## Supported Models

| Model  | Size     | Memory | Speed | Quality |
| ------ | -------- | ------ | ----- | ------- |
| tiny   | ~39 MB   | ~1 GB  | ~32x  | ~99%    |
| base   | ~74 MB   | ~1 GB  | ~16x  | ~99%    |
| small  | ~244 MB  | ~2 GB  | ~6x   | ~99%    |
| medium | ~769 MB  | ~5 GB  | ~2x   | ~99%    |
| large  | ~1550 MB | ~10 GB | ~1x   | ~99%    |

## Browser Support

- **Chrome**: 57+
- **Firefox**: 52+
- **Safari**: 11+
- **Edge**: 16+

## FAQ

### Q: Why is my transcription stopping unexpectedly?

A: This is usually related to WebAssembly execution being terminated by the browser due to resource management policies, low battery, or background tab throttling. Use the `restartModelOnError: true` option to automatically restart the model when this happens.

### Q: Can I use this in a background tab?

A: Some browsers may throttle or pause WebAssembly execution in background tabs. Consider using the `restartModelOnError` option and implementing visibility change listeners to handle this.

### Q: Why is the first transcription slower?

A: The first transcription includes model initialization time. Subsequent transcriptions with the same model will be faster.

### Q: Can I transcribe audio in real-time?

A: Yes! Use the `TranscriptionSession` with streaming audio data. For real-time applications, consider using the `tiny` or `base` models for better performance.

### Q: What audio formats are supported?

A: Whisper expects `Float32Array` audio data at 16kHz. You can either prepare it yourself, or use the built-in **AudioConverter** helpers (browser-only):

- `convertFromFile(file)` - audio/video files supported by the browser decoder
- `convertFromArrayBuffer(buffer)` - decode & convert from an ArrayBuffer
- `convertFromFloat32Array(data, { inputSampleRate? })` - resample if needed
- `convertFromMediaStream(stream)` - microphone / capture stream (requires `MediaRecorder`)
- `convertFromAudioElement(audioEl)` - tries `fetch(audioEl.src)` (CORS), otherwise `captureStream()` fallback (browser support varies)

Notes:

- AudioConverter uses Web APIs (`Web Audio`, `MediaRecorder`), so it does **not** run in Node.js.
- `<audio>` conversion may require proper CORS headers to allow `fetch()` of the audio URL.

### Q: How do I handle errors gracefully?

A: Use try-catch blocks around transcription calls and implement the `restartModelOnError` option for automatic recovery from WebAssembly execution issues.

## Demo

Try the interactive demo:

**Live Demo:** https://timur00kh.github.io/whisper.wasm/

**Source Code:** [demo/index.html](demo/index.html)

**Local Development:**

```bash
npm run dev:demo
```

The demo includes:

- Audio file upload and processing
- Transcription from `<audio>` element
- Microphone recording (Start/Stop) and transcription
- Model selection and loading
- Real-time transcription with progress
- Language detection and translation
- Streaming audio support

## Changelog

For detailed information about changes, new features, and bug fixes, see our [changelog documentation](docs/changelog/).

### Recent Updates

- **[feature-restart-on-timeout](docs/changelog/feature-restart-on-timeout.md)** - Added timeout handling, error recovery, and enhanced demo application
- **[feature-audio-converter](docs/changelog/feature-audio-converter.md)** - Added AudioConverter helpers + demo integration (files, mic, `<audio>`)

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
git clone https://github.com/timur00kh/whisper.wasm.git
cd whisper.wasm
npm install
```

### Build

```bash
# Build the library
npm run build:lib

# Build the demo
npm run build:demo

# Run development server
npm run dev:demo
```

### Testing

```bash
npm test
```

## License

MIT

## Acknowledgments

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - High-performance C++ implementation of Whisper
- [OpenAI Whisper](https://github.com/openai/whisper) - The original speech recognition model
- [Emscripten](https://emscripten.org/) - WebAssembly compilation toolkit

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
