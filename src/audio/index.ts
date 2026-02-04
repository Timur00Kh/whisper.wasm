/**
 * Audio converter module for whisper.wasm
 *
 * This module provides utilities for converting various audio formats
 * and sources into the Float32Array format required by whisper.wasm.
 */

// Functional API
export {
  convertFromFile,
  convertFromMediaStream,
  convertFromAudioElement,
  convertFromFloat32Array,
  convertFromArrayBuffer,
  isWebAudioSupported,
  getSupportedFormats,
} from './AudioConverter';

// Types and enums
export { AudioFormat } from './types';
export type {
  AudioInfo,
  AudioConverterOptions,
  AudioConversionResult,
  AudioConverterCallbacks,
  AudioSource,
  AudioContextConfig,
} from './types';
