/**
 * AudioConverter - функциональный API для подготовки аудио для whisper.wasm
 *
 * ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ:
 *
 * // Простейшая конвертация файла (поддерживает как аудио, так и видео)
 * const result = await convertFromFile(file);
 *
 * // Конвертация с настройками
 * const result = await convertFromFile(file, {
 *   targetSampleRate: 16000,
 *   normalize: true,
 *   logLevel: 'INFO'
 * });
 *
 * // Конвертация с отслеживанием прогресса
 * const result = await convertFromFile(file, options, {
 *   onProgress: (progress, message) => console.log(`${progress}% - ${message}`),
 *   onError: (error) => console.error(error)
 * });
 *
 * // Интеграция с WhisperWasmService
 * const audioData = await convertFromFile(file);
 * const transcription = await whisperService.transcribe(audioData.audioData);
 */

import { Logger, type LoggerLevelsType } from '../utils/Logger';
import {
  AudioFormat,
  type AudioConverterOptions,
  type AudioConversionResult,
  type AudioConverterCallbacks,
} from './types';

/**
 * Конфигурация по умолчанию для конвертера аудио
 */
const DEFAULT_OPTIONS: Required<AudioConverterOptions> = {
  targetSampleRate: 16000, // Whisper требует 16kHz
  targetChannels: 1, // Моно аудио
  inputSampleRate: 16000,
  normalize: true,
  noiseReduction: false,
  logLevel: Logger.levels.ERROR,
  signal: undefined as any,
  recordingDurationMs: 10_000,
};

function resolveLogLevel(
  logLevel: AudioConverterOptions['logLevel'] | undefined,
): LoggerLevelsType {
  if (typeof logLevel === 'number') {
    return logLevel;
  }
  if (!logLevel) {
    return Logger.levels.ERROR;
  }
  // string value: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  return Logger.levels[logLevel];
}

function createLogger(options: Required<AudioConverterOptions>) {
  return new Logger(resolveLogLevel(options.logLevel), 'AudioConverter');
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

/**
 * Проверка поддержки Web Audio API
 */
export function isWebAudioSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(
    window.AudioContext ||
    (window as any).webkitAudioContext ||
    window.OfflineAudioContext ||
    (window as any).webkitOfflineAudioContext
  );
}

/**
 * Получение списка поддерживаемых форматов
 */
export function getSupportedFormats(): AudioFormat[] {
  return [
    AudioFormat.MP3,
    AudioFormat.WAV,
    AudioFormat.OGG,
    AudioFormat.M4A,
    AudioFormat.AAC,
    AudioFormat.FLAC,
    AudioFormat.MP4,
    AudioFormat.WEBM,
    AudioFormat.AVI,
    AudioFormat.MOV,
    AudioFormat.MKV,
    AudioFormat.RAW_PCM,
    AudioFormat.MICROPHONE,
    AudioFormat.AUDIO_ELEMENT,
  ];
}

/**
 * Конвертация аудио из файла (поддерживает как аудио, так и видео файлы)
 */
export async function convertFromFile(
  file: File,
  options: AudioConverterOptions = {},
  callbacks: AudioConverterCallbacks = {},
): Promise<AudioConversionResult> {
  if (!isWebAudioSupported()) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLogger(opts);
  const warnings: string[] = [];

  try {
    throwIfAborted(opts.signal);
    logger.info(`Converting file: ${file.name}`);
    callbacks.onProgress?.(0, `Loading file: ${file.name}`);

    // Читаем файл
    const arrayBuffer = await readFileAsArrayBuffer(file);
    callbacks.onProgress?.(20, 'File loaded, decoding...');

    // Декодируем аудио
    throwIfAborted(opts.signal);
    const audioBuffer = await decodeAudioData(arrayBuffer, opts, callbacks, logger);
    callbacks.onProgress?.(40, 'Audio decoded, processing...');

    // Конвертируем
    const result = await processAudioBuffer(audioBuffer, opts, callbacks, logger, warnings);

    callbacks.onProgress?.(100, 'Conversion completed');
    logger.info('File conversion completed successfully');

    return result;
  } catch (error) {
    logger.error('File conversion failed:', error);
    callbacks.onError?.(error as Error);
    throw error;
  }
}

/**
 * Конвертация аудио из MediaStream (микрофон)
 */
export async function convertFromMediaStream(
  stream: MediaStream,
  options: AudioConverterOptions = {},
  callbacks: AudioConverterCallbacks = {},
): Promise<AudioConversionResult> {
  if (!isWebAudioSupported()) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLogger(opts);
  const warnings: string[] = [];

  try {
    throwIfAborted(opts.signal);
    logger.info('Converting from MediaStream');
    callbacks.onProgress?.(0, 'Starting recording...');

    const blob = await recordMediaStreamToBlob(stream, opts, callbacks, logger);
    callbacks.onProgress?.(50, 'Recording completed, decoding...');

    const arrayBuffer = await blob.arrayBuffer();

    // Декодируем и приводим к нужному формату
    const audioBuffer = await decodeAudioData(arrayBuffer, opts, callbacks, logger);
    callbacks.onProgress?.(70, 'Audio decoded, processing...');

    const result = await processAudioBuffer(audioBuffer, opts, callbacks, logger, warnings);
    callbacks.onProgress?.(100, 'Conversion completed');

    return result;
  } catch (error) {
    logger.error('MediaStream conversion failed:', error);
    callbacks.onError?.(error as Error);
    throw error;
  }
}

/**
 * Конвертация аудио из HTMLAudioElement
 */
export async function convertFromAudioElement(
  element: HTMLAudioElement,
  options: AudioConverterOptions = {},
  callbacks: AudioConverterCallbacks = {},
): Promise<AudioConversionResult> {
  if (!isWebAudioSupported()) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLogger(opts);
  const warnings: string[] = [];

  try {
    throwIfAborted(opts.signal);
    logger.info('Converting from HTMLAudioElement');
    callbacks.onProgress?.(0, 'Capturing audio from element...');

    // 1) Best: element has a MediaStream (live source)
    const srcObject = (element as any).srcObject as unknown;
    if (srcObject && srcObject instanceof MediaStream) {
      warnings.push('Using HTMLAudioElement.srcObject MediaStream');
      const result = await convertFromMediaStream(srcObject, opts, callbacks);
      return {
        ...result,
        warnings: [...warnings, ...(result.warnings ?? [])],
      };
    }

    // 2) Try fetch currentSrc/src (best quality, no re-encode). Requires CORS.
    const srcUrl = element.currentSrc || element.src;
    if (srcUrl) {
      try {
        callbacks.onProgress?.(10, 'Fetching audio source...');
        const arrayBuffer = await fetchArrayBuffer(srcUrl, opts.signal);
        callbacks.onProgress?.(30, 'Fetched, decoding...');
        const audioBuffer = await decodeAudioData(arrayBuffer, opts, callbacks, logger);
        callbacks.onProgress?.(60, 'Decoded, processing...');
        const result = await processAudioBuffer(audioBuffer, opts, callbacks, logger, warnings);
        callbacks.onProgress?.(100, 'Conversion completed');
        return result;
      } catch (e) {
        if ((e as any)?.name === 'AbortError') {
          throw e;
        }
        warnings.push(
          `Failed to fetch element src (CORS?) – falling back to captureStream: ${(e as Error).message}`,
        );
      }
    }

    // 3) Fallback: captureStream + MediaRecorder
    const captureFn = (element as any).captureStream || (element as any).mozCaptureStream;
    if (typeof captureFn !== 'function') {
      throw new Error(
        'Unable to capture audio from HTMLAudioElement: no srcObject, fetch failed, and captureStream() is not supported',
      );
    }

    warnings.push('Using HTMLAudioElement.captureStream() fallback');
    const capturedStream: MediaStream = captureFn.call(element);
    try {
      const result = await convertFromMediaStream(capturedStream, opts, callbacks);
      return {
        ...result,
        warnings: [...warnings, ...(result.warnings ?? [])],
      };
    } finally {
      // Stop only streams we created via captureStream().
      capturedStream.getTracks().forEach((t) => t.stop());
    }
  } catch (error) {
    logger.error('HTMLAudioElement conversion failed:', error);
    callbacks.onError?.(error as Error);
    throw error;
  }
}

/**
 * Конвертация аудио из Float32Array
 */
export async function convertFromFloat32Array(
  data: Float32Array,
  options: AudioConverterOptions = {},
  callbacks: AudioConverterCallbacks = {},
): Promise<AudioConversionResult> {
  if (!isWebAudioSupported()) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLogger(opts);

  try {
    throwIfAborted(opts.signal);
    logger.info('Converting from Float32Array');
    callbacks.onProgress?.(0, 'Processing Float32Array...');

    // Создаем AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const inputSampleRate = opts.inputSampleRate ?? opts.targetSampleRate;
    const context = new AudioContextClass({ sampleRate: inputSampleRate });

    try {
      // Создаем AudioBuffer из Float32Array
      const audioBuffer = context.createBuffer(1, data.length, context.sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      channelData.set(data);

      callbacks.onProgress?.(30, 'AudioBuffer created, processing...');

      // Обрабатываем
      const warnings: string[] = [];
      if (inputSampleRate !== opts.targetSampleRate) {
        warnings.push(
          `Float32Array sample rate (${inputSampleRate}Hz) will be converted to ${opts.targetSampleRate}Hz`,
        );
      }
      const result = await processAudioBuffer(audioBuffer, opts, callbacks, logger, warnings);

      callbacks.onProgress?.(100, 'Conversion completed');
      logger.info('Float32Array conversion completed successfully');

      return result;
    } finally {
      try {
        await context.close();
      } catch {
        // ignore
      }
    }
  } catch (error) {
    logger.error('Float32Array conversion failed:', error);
    callbacks.onError?.(error as Error);
    throw error;
  }
}

/**
 * Конвертация аудио из ArrayBuffer
 */
export async function convertFromArrayBuffer(
  buffer: ArrayBuffer,
  options: AudioConverterOptions = {},
  callbacks: AudioConverterCallbacks = {},
): Promise<AudioConversionResult> {
  if (!isWebAudioSupported()) {
    throw new Error('Web Audio API is not supported in this browser');
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const logger = createLogger(opts);
  const warnings: string[] = [];

  try {
    throwIfAborted(opts.signal);
    logger.info('Converting from ArrayBuffer');
    callbacks.onProgress?.(0, 'Processing ArrayBuffer...');

    // Декодируем аудио
    const audioBuffer = await decodeAudioData(buffer, opts, callbacks, logger);
    callbacks.onProgress?.(40, 'Audio decoded, processing...');

    // Обрабатываем
    const result = await processAudioBuffer(audioBuffer, opts, callbacks, logger, warnings);

    callbacks.onProgress?.(100, 'Conversion completed');
    logger.info('ArrayBuffer conversion completed successfully');

    return result;
  } catch (error) {
    logger.error('ArrayBuffer conversion failed:', error);
    callbacks.onError?.(error as Error);
    throw error;
  }
}

// Вспомогательные функции

/**
 * Чтение файла как ArrayBuffer
 */
async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target?.result as ArrayBuffer);
    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Декодирование аудиоданных
 */
async function decodeAudioData(
  buffer: ArrayBuffer,
  options: Required<AudioConverterOptions>,
  callbacks: AudioConverterCallbacks,
  logger: Logger,
): Promise<AudioBuffer> {
  callbacks.onProgress?.(15, 'Decoding audio data');

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const context = new AudioContextClass({
    sampleRate: options.targetSampleRate,
  });

  try {
    return await context.decodeAudioData(buffer);
  } catch (error) {
    logger.error('Audio decoding failed:', error);
    throw new Error(`Failed to decode audio: ${(error as Error).message}`);
  } finally {
    try {
      await context.close();
    } catch {
      // ignore
    }
  }
}

/**
 * Обработка AudioBuffer
 */
async function processAudioBuffer(
  buffer: AudioBuffer,
  options: Required<AudioConverterOptions>,
  callbacks: AudioConverterCallbacks,
  logger: Logger,
  warnings: string[],
): Promise<AudioConversionResult> {
  callbacks.onProgress?.(50, 'Converting audio format...');

  // Валидируем
  validateAudioBuffer(buffer, options, warnings);

  // Конвертируем формат
  const convertedBuffer = await convertAudioFormat(buffer, options, callbacks);
  callbacks.onProgress?.(70, 'Converting to Float32Array...');

  // Извлекаем Float32Array
  const audioData = extractFloat32Array(convertedBuffer);
  callbacks.onProgress?.(80, 'Applying effects...');

  // Применяем эффекты
  if (options.normalize) {
    normalizeAudio(audioData);
  }

  if (options.noiseReduction) {
    applyNoiseReduction(audioData);
  }

  callbacks.onProgress?.(90, 'Finalizing...');

  return {
    audioData,
    audioInfo: {
      sampleRate: convertedBuffer.sampleRate,
      duration: convertedBuffer.duration,
      channels: convertedBuffer.numberOfChannels,
      bitDepth: 32, // Float32
      format: 'float32',
    },
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Конвертация формата аудио
 */
async function convertAudioFormat(
  buffer: AudioBuffer,
  options: Required<AudioConverterOptions>,
  callbacks: AudioConverterCallbacks,
): Promise<AudioBuffer> {
  callbacks.onProgress?.(60, 'Converting audio format...');

  // Создаем OfflineAudioContext с целевыми параметрами
  const OfflineAudioContextClass =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  const offlineContext = new OfflineAudioContextClass(
    options.targetChannels,
    Math.floor((buffer.length * options.targetSampleRate) / buffer.sampleRate),
    options.targetSampleRate,
  );

  // Создаем источник
  const source = offlineContext.createBufferSource();
  source.buffer = buffer;

  // Подключаем к контексту
  source.connect(offlineContext.destination);
  source.start(0);

  // Рендерим аудио
  return await offlineContext.startRendering();
}

/**
 * Извлечение Float32Array из AudioBuffer
 */
function extractFloat32Array(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  } else {
    // Микшируем многоканальный аудио в моно
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    const mixed = new Float32Array(leftChannel.length);

    for (let i = 0; i < leftChannel.length; i++) {
      mixed[i] = (leftChannel[i] + rightChannel[i]) / 2;
    }

    return mixed;
  }
}

/**
 * Нормализация аудио
 */
function normalizeAudio(audioData: Float32Array): void {
  let max = 0;
  for (let i = 0; i < audioData.length; i++) {
    max = Math.max(max, Math.abs(audioData[i]));
  }

  if (max > 0) {
    const factor = 0.95 / max; // Нормализуем до 95% максимального уровня
    for (let i = 0; i < audioData.length; i++) {
      audioData[i] *= factor;
    }
  }
}

/**
 * Базовое шумоподавление (простое сглаживание)
 */
function applyNoiseReduction(audioData: Float32Array): void {
  const smoothed = new Float32Array(audioData.length);
  const windowSize = 3;

  for (let i = 0; i < audioData.length; i++) {
    let sum = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - windowSize);
      j <= Math.min(audioData.length - 1, i + windowSize);
      j++
    ) {
      sum += audioData[j];
      count++;
    }

    smoothed[i] = sum / count;
  }

  // Копируем результат обратно
  audioData.set(smoothed);
}

/**
 * Валидация AudioBuffer
 */
function validateAudioBuffer(
  buffer: AudioBuffer,
  options: Required<AudioConverterOptions>,
  warnings: string[],
): void {
  if (buffer.numberOfChannels > 2) {
    warnings.push(`Audio has ${buffer.numberOfChannels} channels, will be mixed to mono`);
  }

  if (buffer.sampleRate !== options.targetSampleRate) {
    warnings.push(
      `Audio sample rate (${buffer.sampleRate}Hz) will be converted to ${options.targetSampleRate}Hz`,
    );
  }
}

async function recordMediaStreamToBlob(
  stream: MediaStream,
  options: Required<AudioConverterOptions>,
  callbacks: AudioConverterCallbacks,
  logger: Logger,
): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('MediaStream recording is only supported in browser environments');
  }
  if (!(window as any).MediaRecorder) {
    throw new Error('MediaRecorder is not supported in this browser');
  }

  const MediaRecorderClass = (window as any).MediaRecorder as typeof MediaRecorder;

  const candidateMimeTypes = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  const mimeType = candidateMimeTypes.find((t) => MediaRecorderClass.isTypeSupported(t));

  const recorder = new MediaRecorderClass(stream, mimeType ? { mimeType } : undefined);
  const chunks: BlobPart[] = [];

  const stopPromise = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data);
      }
    };
    recorder.onerror = () => reject(new Error('MediaRecorder error'));
    recorder.onstop = () => {
      const type = mimeType || recorder.mimeType || 'application/octet-stream';
      resolve(new Blob(chunks, { type }));
    };
  });

  const signal = options.signal;
  const onAbort = () => {
    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch {
      // ignore
    }
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  const durationMs = options.recordingDurationMs ?? 10_000;
  const timeout = setTimeout(() => {
    try {
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
    } catch {
      // ignore
    }
  }, durationMs);

  callbacks.onProgress?.(20, 'Recording audio...');
  logger.debug('Starting MediaRecorder', { mimeType: mimeType ?? recorder.mimeType, durationMs });

  // Use timeslice to get progressive dataavailable events.
  recorder.start(250);

  try {
    const blob = await stopPromise;
    return blob;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}

async function fetchArrayBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch (${res.status}): ${res.statusText}`);
  }
  return await res.arrayBuffer();
}
