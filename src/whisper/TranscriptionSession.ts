import { sleep } from '../utils/sleep';
import { Logger, LoggerLevelsType } from '../utils/Logger';
import {
  type WhisperWasmTranscriptionOptions,
  type WhisperWasmServiceCallbackParams,
} from './types';
import { WhisperWasmService } from './WhisperWasmService';
import { createTimeoutError } from '../utils/timeoutError';

function splitFloat32Array(arr: Float32Array, chunkSize = 16000 * 100) {
  const result: Float32Array[] = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    result.push(arr.subarray(i, i + chunkSize));
  }
  return result;
}

type TResolver = ((value: WhisperWasmServiceCallbackParams | undefined) => void) | null;

interface ITranscriptionSessionOptions extends WhisperWasmTranscriptionOptions {
  sleepMsBetweenChunks?: number;
  restartModelOnError?: boolean;
  timeoutMs?: number;
}

export class TranscriptionSession {
  private logger: Logger;

  constructor(
    private whisperService: WhisperWasmService,
    options?: { logLevel: LoggerLevelsType },
  ) {
    this.logger = new Logger(options?.logLevel || Logger.levels.ERROR, 'TranscriptionSession');
  }

  async *streaming(
    audioData: Float32Array,
    options: ITranscriptionSessionOptions = {},
  ): AsyncIterableIterator<WhisperWasmServiceCallbackParams> {
    const { timeoutMs = 30_000 } = options;
    const audioDataChunks = splitFloat32Array(audioData);
    let lastSegmentTimeEnd = 0;
    for await (const chunk of audioDataChunks) {
      const queue: WhisperWasmServiceCallbackParams[] = [];
      let resolver: TResolver = null;
      let done = false;
      let error: any;
      let currentSegmentTimeEnd = 0;
      const { timeoutError, clear } = createTimeoutError(timeoutMs, 'Transcribe timeout');

      const startTranscription = () =>
        this.whisperService
          .transcribe(
            chunk,
            (segment) => {
              currentSegmentTimeEnd = segment.timeEnd;
              segment.timeStart += lastSegmentTimeEnd;
              segment.timeEnd += lastSegmentTimeEnd;
              this.logger.debug('Transcription segment in session:', segment);
              if (resolver) {
                resolver(segment);
                resolver = null;
              } else {
                queue.push(segment);
              }
              clear();
            },
            options,
          )
          .then(() => {
            this.logger.debug('Transcription done in session then');
            done = true;
            lastSegmentTimeEnd += currentSegmentTimeEnd;
            clear();
            resolver?.(undefined);
          })
          .catch((e) => {
            this.logger.debug('Transcription error in session catch:', e);
            error = e;
            clear();
            resolver?.(undefined);
          });

      startTranscription();

      while (true) {
        if (error) {
          if (options.restartModelOnError) {
            this.whisperService.restartModel();
            startTranscription();
            continue;
          }
          throw error;
        }
        if (done) break;
        if (queue.length) {
          yield queue.shift()!;
        } else {
          try {
            const result = await Promise.race([
              new Promise<WhisperWasmServiceCallbackParams | undefined>(
                (r: TResolver) => (resolver = r),
              ),
              timeoutError(),
            ]);
            if (result) {
              yield result;
            }
          } catch (e) {
            error = e;
          }
        }
      }
      if (options.sleepMsBetweenChunks) await sleep(options.sleepMsBetweenChunks);
    }
  }

  /**
   * @deprecated Use `streaming()` instead.
   */
  async *streamimg(
    audioData: Float32Array,
    options: ITranscriptionSessionOptions = {},
  ): AsyncIterableIterator<WhisperWasmServiceCallbackParams> {
    yield* this.streaming(audioData, options);
  }
}
