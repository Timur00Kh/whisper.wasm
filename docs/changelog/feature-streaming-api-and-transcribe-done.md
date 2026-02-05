# Changelog - Feature: Streaming API + Transcribe Done

**Feature**: `TranscriptionSession.streaming()` + completion semantics notes  
**Date**: February 4, 2026 (updated February 5, 2026)

## 🚀 New Features

### Streaming API naming

- **Added**: `TranscriptionSession.streaming(audioData, options?)` — preferred streaming entrypoint.
- **Deprecated**: `TranscriptionSession.streamimg(...)` remains available as an alias for backward compatibility.

## 🔧 Improvements

### Clearer “done vs error” semantics

- A dedicated completion signal (`transcribeDone`) was introduced to avoid conflating completion with `transcribeError`.
- **Update (Feb 5, 2026)**: this `transcribeDone` approach was rolled back for now; completion/error semantics are under review. Ref: `5262df84015043ef3c2b6f3c5b49d084c1a9e9f0` (`https://github.com/Timur00Kh/whisper.wasm/commit/5262df84015043ef3c2b6f3c5b49d084c1a9e9f0`)
- **Important**: real errors still reject/throw as before (e.g. missing WASM module/instance, timeouts).

## 📝 Migration Notes

### For users

- Prefer `session.streaming(...)` over `session.streamimg(...)`.
- No other user-facing API changes are required for this feature.

## 🔒 Security & Privacy Notes

- Some APIs perform `fetch()` calls (model downloads and, optionally, `<audio>` source fetching). Do **not** pass untrusted URLs in Node.js/server-side environments; apply allowlists/proxying and size/time limits at the application layer.
