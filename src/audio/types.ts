/**
 * Audio converter types and interfaces for whisper.wasm
 */

import type { LoggerLevelsType } from '../utils/Logger';

export interface AudioInfo {
  /** Sample rate in Hz */
  sampleRate: number;
  /** Duration in seconds */
  duration: number;
  /** Number of audio channels */
  channels: number;
  /** Audio bit depth */
  bitDepth?: number;
  /** Audio format/container */
  format?: string;
}

export interface AudioConverterOptions {
  /** Target sample rate (default: 16000 for Whisper) */
  targetSampleRate?: number;
  /** Target number of channels (default: 1 for mono) */
  targetChannels?: number;
  /**
   * Sample rate for Float32Array inputs.
   * If omitted, Float32Array is assumed to already be at targetSampleRate.
   */
  inputSampleRate?: number;
  /** Whether to normalize audio levels */
  normalize?: boolean;
  /** Whether to apply noise reduction (basic) */
  noiseReduction?: boolean;
  /**
   * Log level for debugging.
   * Prefer numeric LoggerLevelsType for consistency with the library.
   * String values are also accepted for convenience.
   */
  logLevel?: LoggerLevelsType | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';

  /**
   * Optional AbortSignal to cancel long operations (recording, fetch, etc).
   * Implementations should treat abort as a cancellation and reject.
   */
  signal?: AbortSignal;

  /**
   * For MediaStream / captureStream based conversions: how long to record
   * before auto-stopping. If omitted, defaults are applied.
   */
  recordingDurationMs?: number;
}

export interface AudioConversionResult {
  /** Converted audio data as Float32Array */
  audioData: Float32Array;
  /** Audio metadata */
  audioInfo: AudioInfo;
  /** Conversion warnings/notes */
  warnings?: string[];
}

export type ProgressCallback = (progress: number, message: string) => void;
export type ErrorCallback = (error: Error) => void;

export interface AudioConverterCallbacks {
  onProgress?: ProgressCallback;
  onError?: ErrorCallback;
}

/**
 * Supported audio input formats
 */
export enum AudioFormat {
  // Audio files
  MP3 = 'mp3',
  WAV = 'wav',
  OGG = 'ogg',
  M4A = 'm4a',
  AAC = 'aac',
  FLAC = 'flac',

  // Video files (audio track extraction)
  MP4 = 'mp4',
  WEBM = 'webm',
  AVI = 'avi',
  MOV = 'mov',
  MKV = 'mkv',

  // Raw audio data
  RAW_PCM = 'raw_pcm',

  // Browser audio sources
  MICROPHONE = 'microphone',
  AUDIO_ELEMENT = 'audio_element',
}

/**
 * Audio source types
 */
export type AudioSource =
  | File
  | Blob
  | ArrayBuffer
  | Float32Array
  | AudioBuffer
  | HTMLAudioElement
  | MediaStream;

/**
 * Audio conversion context for browser environment
 */
export interface AudioContextConfig {
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  autoGainControl?: boolean;
  noiseSuppression?: boolean;
}
