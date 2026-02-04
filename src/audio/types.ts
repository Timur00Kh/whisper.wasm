/**
 * Audio converter types and interfaces for whisper.wasm
 */

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
  /** Whether to normalize audio levels */
  normalize?: boolean;
  /** Whether to apply noise reduction (basic) */
  noiseReduction?: boolean;
  /** Log level for debugging */
  logLevel?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
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
  WEBM_AUDIO = 'webm',

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
