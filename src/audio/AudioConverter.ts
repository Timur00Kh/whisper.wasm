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

import { Logger } from '../utils/Logger';
import {
  AudioFormat,
  type AudioInfo,
  type AudioConverterOptions,
  type AudioConversionResult,
  type AudioConverterCallbacks,
  type AudioSource,
} from './types';

/**
 * Конфигурация по умолчанию для конвертера аудио
 */
const DEFAULT_OPTIONS: Required<AudioConverterOptions> = {
  targetSampleRate: 16000, // Whisper требует 16kHz
  targetChannels: 1, // Моно аудио
  normalize: true,
  noiseReduction: false,
  logLevel: 'ERROR',
};

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
    AudioFormat.WEBM_AUDIO,
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
  const logger = new Logger(opts.logLevel as any, 'AudioConverter');
  const warnings: string[] = [];

  try {
    logger.info(`Converting file: ${file.name}`);
    callbacks.onProgress?.(0, `Loading file: ${file.name}`);

    // Читаем файл
    const arrayBuffer = await readFileAsArrayBuffer(file);
    callbacks.onProgress?.(20, 'File loaded, decoding...');

    // Декодируем аудио
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
  const logger = new Logger(opts.logLevel as any, 'AudioConverter');

  try {
    logger.info('Converting from MediaStream');
    callbacks.onProgress?.(0, 'Starting recording...');

    // Создаем AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass({
      sampleRate: opts.targetSampleRate,
    });

    // Создаем источник из потока
    const source = context.createMediaStreamSource(stream);

    // Создаем анализатор для записи
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(analyser);

    // Простая реализация записи - в реальности нужна более сложная логика
    callbacks.onProgress?.(50, 'Recording audio...');

    // Пока возвращаем ошибку, так как полная реализация требует сложной логики
    throw new Error(
      'MediaStream conversion not yet implemented - requires complex recording logic',
    );
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
  const logger = new Logger(opts.logLevel as any, 'AudioConverter');

  try {
    logger.info('Converting from HTMLAudioElement');
    callbacks.onProgress?.(0, 'Capturing audio from element...');

    // Создаем AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass({
      sampleRate: opts.targetSampleRate,
    });

    // Создаем источник из элемента
    const source = context.createMediaElementSource(element);

    // Подключаем к контексту
    source.connect(context.destination);

    // Пока возвращаем ошибку, так как полная реализация требует сложной логики
    throw new Error(
      'HTMLAudioElement conversion not yet implemented - requires complex capture logic',
    );
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
  const logger = new Logger(opts.logLevel as any, 'AudioConverter');

  try {
    logger.info('Converting from Float32Array');
    callbacks.onProgress?.(0, 'Processing Float32Array...');

    // Создаем AudioContext
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const context = new AudioContextClass({
      sampleRate: opts.targetSampleRate,
    });

    // Создаем AudioBuffer из Float32Array
    const audioBuffer = context.createBuffer(1, data.length, context.sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    channelData.set(data);

    callbacks.onProgress?.(30, 'AudioBuffer created, processing...');

    // Обрабатываем
    const warnings: string[] = [];
    const result = await processAudioBuffer(audioBuffer, opts, callbacks, logger, warnings);

    callbacks.onProgress?.(100, 'Conversion completed');
    logger.info('Float32Array conversion completed successfully');

    return result;
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
  const logger = new Logger(opts.logLevel as any, 'AudioConverter');
  const warnings: string[] = [];

  try {
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
  const duration = buffer.duration;

  if (buffer.numberOfChannels > 2) {
    warnings.push(`Audio has ${buffer.numberOfChannels} channels, will be mixed to mono`);
  }

  if (buffer.sampleRate !== options.targetSampleRate) {
    warnings.push(
      `Audio sample rate (${buffer.sampleRate}Hz) will be converted to ${options.targetSampleRate}Hz`,
    );
  }
}
