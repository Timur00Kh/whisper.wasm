# To Do

## 🎵 Audio Converter

- [x] Add audio converter for different input formats (MP3, WAV, M4A, OGG, FLAC, AAC)
- [x] Convert to Float32Array at 16kHz sample rate for Whisper
- [ ] Document `AudioConverterOptions` (`signal`, `recordingDurationMs`, `inputSampleRate`)
- [ ] Add automated tests for AudioConverter where feasible (resample/mono/normalize)
- [ ] Decide and document stop-vs-cancel semantics for MediaStream conversion
- [ ] Node.js support: verify if core library works in Node.js and add tests (experimental)

## 🔄 Model Management Refactoring

- [ ] Convert ModelManager from class to simple object/utility functions
- [ ] Update model list with newer models from Hugging Face
- [ ] Improve user experience for model loading and management

## 📋 Additional Tasks

- [ ] Research new Whisper models available on Hugging Face
- [ ] Plan better model discovery and selection interface
- [ ] Consider model versioning and updates strategy
- [ ] Add webassembly service worker to library
- [ ] Finalize `LICENSE` text (copyright holder/years)

---

**Last Updated**: February 4, 2026
