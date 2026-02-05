# Changelog - Feature: Streaming API + Transcribe Done

**Feature**: `TranscriptionSession.streaming()` + clarified completion semantics  
**Date**: February 4, 2026

## 🚀 New Features

### Streaming API naming

- **Added**: `TranscriptionSession.streaming(audioData, options?)` — preferred streaming entrypoint.
- **Deprecated**: `TranscriptionSession.streamimg(...)` remains available as an alias for backward compatibility.

## 🔧 Improvements

### Clearer “done vs error” semantics

- Internally, the Whisper service now uses a dedicated completion signal (`transcribeDone`) instead of conflating completion with `transcribeError`.
- **Important**: real errors still reject/throw as before (e.g. missing WASM module/instance, timeouts).

## 📝 Migration Notes

### For users

- Prefer `session.streaming(...)` over `session.streamimg(...)`.
- No other user-facing API changes are required for this feature.

## 🔒 Security & Privacy Notes

- Some APIs perform `fetch()` calls (model downloads and, optionally, `<audio>` source fetching). Do **not** pass untrusted URLs in Node.js/server-side environments; apply allowlists/proxying and size/time limits at the application layer.
