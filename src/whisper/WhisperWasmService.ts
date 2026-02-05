import { LoggerLevelsType, Logger } from '../utils/Logger';
import { simd } from 'wasm-feature-detect';
import type {
  WhisperWasmModule,
  WhisperWasmServiceCallback,
  WhisperWasmServiceCallbackParams,
  WhisperWasmTranscriptionOptions,
} from './types';
import { whisperWasmTranscriptionDefaultOptions } from './types';
import { parseCueLine } from './parseCueLine';
import { TranscriptionSession } from './TranscriptionSession';
import { sleep } from '../utils/sleep';
// import wasmScriptUrl from '@wasm/libmain.js?url'

// this is just for debugging
declare global {
  interface Window {
    Module: WhisperWasmModule;
    WhisperWasmService: WhisperWasmService;
  }
}

interface TranscribeEvent extends Event {
  detail: string;
}

type TranscribeEventType = 'system_info' | 'transcribe' | 'transcribeError';

class TranscriptionEventBus extends EventTarget {
  on(type: TranscribeEventType, handler: (event: TranscribeEvent) => void) {
    this.addEventListener(type, handler as EventListener);
    return () => this.removeEventListener(type, handler as EventListener);
  }
  emit(type: TranscribeEventType, detail: string) {
    this.dispatchEvent(new CustomEvent(type, { detail }) as TranscribeEvent);
  }
}

interface WhisperWasmServiceOptions {
  logLevel?: LoggerLevelsType;
  init?: boolean;
}

export class WhisperWasmService {
  private wasmModule: WhisperWasmModule | null = null;
  private instance: number | null = null;
  private modelFileName: string = 'whisper.bin';
  private isTranscribing: boolean = false;
  private bus = new TranscriptionEventBus();
  private logger: Logger;
  private modelData: Uint8Array | null = null;

  constructor(options?: WhisperWasmServiceOptions) {
    this.logger = new Logger(options?.logLevel ?? Logger.levels.ERROR, 'WhisperWasmService');
    if (options?.init) {
      this.loadWasmScript();
    }
  }

  async checkWasmSupport(): Promise<boolean> {
    return await simd();
  }

  async loadWasmScript(): Promise<void> {
    this.wasmModule = await (
      await import('@wasm/libmain.js')
    ).default({
      print: (e: string, ...rest: unknown[]) => {
        if (rest.length > 0) {
          this.logger.debug(rest);
        }
        if (e.startsWith('[')) {
          this.logger.info(e);
          this.bus.emit('transcribe', e);
        } else {
          this.logger.debug(e);
          this.bus.emit('system_info', e);
        }
      },
      printErr: (e: string, ...rest: unknown[]) => {
        if (rest.length > 0) {
          this.logger.debug(rest);
        }
        this.logger.warn(e);
        this.bus.emit('transcribeError', e);
      },
    });
  }

  async initModel(model: Uint8Array): Promise<void> {
    if (!(await this.checkWasmSupport())) {
      throw new Error('WASM is not supported');
    }

    this.modelData = model;

    if (this.wasmModule) {
      this.wasmModule.FS_unlink(this.modelFileName);
      this.wasmModule.free();
    }

    await this.loadWasmScript();

    await sleep(100);

    this.storeFS(this.modelFileName, model);
    this.instance = this.wasmModule!.init(this.modelFileName);

    return Promise.resolve();
  }

  restartModel(): Promise<void> {
    if (!this.modelData) {
      throw new Error('Model not loaded');
    }
    return this.initModel(this.modelData);
  }

  storeFS(fname: string, buf: Uint8Array) {
    if (!this.wasmModule) {
      throw new Error('WASM module not loaded');
    }
    // write to WASM file using FS_createDataFile
    // if the file exists, delete it
    try {
      this.wasmModule.FS_unlink(fname);
    } catch (e) {
      // ignore
    }

    this.wasmModule.FS_createDataFile('/', fname, buf, true, true, true);
  }

  async transcribe(
    audioData: Float32Array,
    callback?: WhisperWasmServiceCallback,
    options: WhisperWasmTranscriptionOptions = {},
  ): Promise<{ segments: WhisperWasmServiceCallbackParams[]; transcribeDurationMs: number }> {
    if (this.isTranscribing) {
      throw new Error('Already transcribing');
    }
    if (!this.wasmModule) {
      throw new Error('WASM module not loaded');
    }
    if (!this.instance) {
      throw new Error('WASM instance not loaded');
    }

    const maxDuration = 120;
    if (audioData.length > 16000 * maxDuration) {
      // may be need to throw error
      this.logger.warn(
        "It's not recommended to transcribe audio data that is longer than 120 seconds",
      );
    }

    this.isTranscribing = true;

    const {
      language = 'auto',
      threads = 4,
      translate = false,
    } = {
      ...whisperWasmTranscriptionDefaultOptions,
      ...options,
    };
    const segments: WhisperWasmServiceCallbackParams[] = [];

    const startTimestamp = Date.now();
    this.wasmModule.full_default(this.instance, audioData, language, threads, translate);

    return await new Promise((resolve, reject) => {
      const unsubscribe = this.bus.on('transcribe', (e) => {
        const { startMs, endMs, text } = parseCueLine(e.detail);

        const segment = {
          timeStart: startMs,
          timeEnd: endMs,
          text: text,
          raw: e.detail,
        };
        segments.push(segment);
        callback?.(segment);
      });

      const timeout = setTimeout(
        () => {
          this.isTranscribing = false;
          unsubscribe();
          unsubscribeError();
          this.logger.error('Transcribe timeout');
          reject(new Error('Transcribe timeout'));
          this.bus.emit('transcribeError', 'Transcribe timeout');
        },
        maxDuration * 2 * 1000,
      );

      const unsubscribeError = this.bus.on('transcribeError', (e) => {
        this.isTranscribing = false;
        unsubscribe();
        unsubscribeError();
        clearTimeout(timeout);
        this.logger.debug('Transcribe error', e.detail);
        resolve({ segments, transcribeDurationMs: Date.now() - startTimestamp });
      });
    });
  }

  createSession(): TranscriptionSession {
    return new TranscriptionSession(this, { logLevel: this.logger.getLevel() });
  }
}
