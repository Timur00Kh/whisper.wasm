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
- [ ] (Optional) Revisit `transcribeDone` / completion signaling: we removed/rolled back the "done" event logic (e.g. handling `printErr(' ')` as completion); decide whether to restore it and align error/done semantics. Ref: [73ba0f0](https://github.com/Timur00Kh/whisper.wasm/commit/73ba0f05194a67919c02eaed11b29659bf63d40e#diff-bcb2f70e95733795db81fd98301edf67d219cfa3d15b6d569493807b513fad44)
- [ ] Add webassembly service worker to library
- [ ] CI/CD: switch NPM publishing to npm Trusted Publishing (OIDC) instead of long-lived `NPM_TOKEN` (per npm security warning)
- [ ] CI/CD: replace deprecated `actions/create-release@v1` (use `gh release create` or a maintained release action)
- [ ] CI/CD: pin GitHub Actions to commit SHAs (supply-chain hardening)
- [ ] CI/CD: fix `build-wasm.yml` version update logic (avoid `sed` injection; use `WHISPER_CPP_VERSION` build-arg)
- [ ] Build: harden `build-wasm.sh` (avoid inline `node -e` string interpolation for filenames)
- [ ] Finalize `LICENSE` text (copyright holder/years)

---

**Last Updated**: February 4, 2026
