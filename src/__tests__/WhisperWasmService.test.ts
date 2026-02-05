import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WhisperWasmService } from '../whisper/WhisperWasmService';
import { Logger } from '../utils/Logger';

type WasmCallbacks = {
  print: (e: string, ...rest: any[]) => void;
  printErr: (e: string, ...rest: any[]) => void;
};

let wasmCallbacks: WasmCallbacks | null = null;

// Mock WASM module
const mockWasmModule = {
  init: vi.fn().mockReturnValue(123),
  full_default: vi.fn(),
  print: vi.fn(),
  printErr: vi.fn(),
  free: vi.fn(),
  FS_unlink: vi.fn(),
  FS_createDataFile: vi.fn(),
};

// Mock wasm-feature-detect
vi.mock('wasm-feature-detect', () => ({
  simd: vi.fn().mockResolvedValue(true),
}));

// Mock WASM import
vi.mock('@wasm/libmain.js', () => ({
  default: vi.fn().mockImplementation(async (callbacks: WasmCallbacks) => {
    wasmCallbacks = callbacks;
    return mockWasmModule;
  }),
}));

// Mock sleep utility
vi.mock('../utils/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

describe('WhisperWasmService', () => {
  let service: WhisperWasmService;

  beforeEach(() => {
    vi.clearAllMocks();
    wasmCallbacks = null;
    service = new WhisperWasmService();
  });

  describe('constructor', () => {
    it('should create service with default options', () => {
      const service = new WhisperWasmService();
      expect(service).toBeInstanceOf(WhisperWasmService);
    });

    it('should create service with custom log level', () => {
      const service = new WhisperWasmService({ logLevel: Logger.levels.DEBUG });
      expect(service).toBeInstanceOf(WhisperWasmService);
    });
  });

  describe('checkWasmSupport', () => {
    it('should return true when WASM is supported', async () => {
      const result = await service.checkWasmSupport();
      expect(result).toBe(true);
    });

    it('should return false when WASM is not supported', async () => {
      const { simd } = await import('wasm-feature-detect');
      vi.mocked(simd).mockResolvedValueOnce(false);

      const result = await service.checkWasmSupport();
      expect(result).toBe(false);
    });
  });

  describe('loadWasmScript', () => {
    it('should load WASM script successfully', async () => {
      await service.loadWasmScript();
      expect(mockWasmModule).toBeDefined();
    });
  });

  describe('initModel', () => {
    const mockModelData = new Uint8Array([1, 2, 3, 4, 5]);

    beforeEach(async () => {
      await service.loadWasmScript();
    });

    it('should throw error if WASM is not supported', async () => {
      const { simd } = await import('wasm-feature-detect');
      vi.mocked(simd).mockResolvedValueOnce(false);

      await expect(service.initModel(mockModelData)).rejects.toThrow('WASM is not supported');
    });

    it('should load model successfully', async () => {
      await service.initModel(mockModelData);

      expect(mockWasmModule.FS_unlink).toHaveBeenCalledWith('whisper.bin');
      expect(mockWasmModule.FS_createDataFile).toHaveBeenCalledWith(
        '/',
        'whisper.bin',
        mockModelData,
        true,
        true,
        true,
      );
      expect(mockWasmModule.init).toHaveBeenCalledWith('whisper.bin');
    });
  });

  describe('transcribe', () => {
    const mockAudioData = new Float32Array(16000); // 1 second of audio
    const mockModelData = new Uint8Array([1, 2, 3, 4, 5]);

    beforeEach(async () => {
      await service.loadWasmScript();
      await service.initModel(mockModelData);
    });

    it('should throw error if WASM module not loaded', async () => {
      const serviceWithoutModule = new WhisperWasmService();
      await expect(serviceWithoutModule.transcribe(mockAudioData)).rejects.toThrow(
        'WASM module not loaded',
      );
    });

    it('should throw error if instance not loaded', async () => {
      const serviceWithoutInstance = new WhisperWasmService();
      await serviceWithoutInstance.loadWasmScript();
      await expect(serviceWithoutInstance.transcribe(mockAudioData)).rejects.toThrow(
        'WASM instance not loaded',
      );
    });

    it('should transcribe audio successfully', async () => {
      const mockSegment = '[00:00:00.000 --> 00:00:01.000] Hello world';

      // Mock full_default to emit events immediately
      mockWasmModule.full_default.mockImplementation(() => {
        // Use setTimeout to ensure the event is emitted after the promise is set up
        setTimeout(() => {
          wasmCallbacks?.print(mockSegment);
          wasmCallbacks?.printErr(' ');
        }, 0);
      });

      const result = await service.transcribe(mockAudioData);

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0]).toEqual({
        timeStart: 0,
        timeEnd: 1000,
        text: 'Hello world',
        raw: mockSegment,
      });
      expect(result.transcribeDurationMs).toBeGreaterThan(0);
    });

    it('should reject when WASM reports an error via printErr', async () => {
      mockWasmModule.full_default.mockImplementation(() => {
        wasmCallbacks?.printErr('WASM failure');
      });

      await expect(service.transcribe(mockAudioData)).rejects.toThrow('WASM failure');
    });
  });

  describe('createSession', () => {
    it('should create transcription session', () => {
      const session = service.createSession();
      expect(session).toBeDefined();
    });
  });

  describe('TranscriptionSession', () => {
    let session: any;

    beforeEach(async () => {
      await service.loadWasmScript();
      await service.initModel(new Uint8Array([1, 2, 3, 4, 5]));
      session = service.createSession();
    });

    it('should stream transcription results', async () => {
      const mockAudioData = new Float32Array(16000 * 3); // 3 seconds of audio
      const mockSegments = [
        '[00:00:00.000 --> 00:00:01.000] Hello',
        '[00:00:01.000 --> 00:00:02.000] world',
      ];

      let segmentIndex = 0;
      mockWasmModule.full_default.mockImplementation(() => {
        const interval = setInterval(() => {
          if (segmentIndex < mockSegments.length) {
            wasmCallbacks?.print(mockSegments[segmentIndex]);
            segmentIndex++;
          } else {
            clearInterval(interval);
            wasmCallbacks?.printErr(' ');
          }
        }, 10); // Faster interval for test
      });

      const segments: any[] = [];
      for await (const segment of session.streaming(mockAudioData)) {
        segments.push(segment);
      }

      expect(segments).toHaveLength(2);
      expect(segments[0].text).toBe('Hello');
      expect(segments[1].text).toBe('world');
    });

    it('should pass transcription options to whisper service', async () => {
      const mockAudioData = new Float32Array(16000);
      const options = {
        language: 'en',
        threads: 2,
        translate: true,
        sleepMsBetweenChunks: 100,
        timeoutMs: 1000, // Add timeout for test
      };

      mockWasmModule.full_default.mockImplementation(() => {
        setTimeout(() => {
          wasmCallbacks?.printErr(' ');
        }, 10);
      });

      const segments: any[] = [];
      for await (const segment of session.streaming(mockAudioData, options)) {
        segments.push(segment);
      }

      expect(mockWasmModule.full_default).toHaveBeenCalledWith(
        123, // instance
        expect.any(Float32Array),
        'en',
        2,
        true,
      );
    });

    it('should throw timeout error when transcription takes too long', async () => {
      const mockAudioData = new Float32Array(16000);
      const options = {
        timeoutMs: 100, // Very short timeout for test
      };

      // Mock full_default to never emit any events (simulate hanging)
      mockWasmModule.full_default.mockImplementation(() => {
        // Do nothing - simulate hanging transcription
      });

      const segments: any[] = [];
      let timeoutError: Error | null = null;

      try {
        for await (const segment of session.streaming(mockAudioData, options)) {
          segments.push(segment);
        }
      } catch (error) {
        timeoutError = error as Error;
      }

      expect(timeoutError).toBeInstanceOf(Error);
      expect(timeoutError?.message).toBe('Transcribe timeout');
      expect(segments).toHaveLength(0);
    });

    it('should not throw timeout error when transcription completes in time', async () => {
      const mockAudioData = new Float32Array(16000);
      const options = {
        timeoutMs: 1000, // Longer timeout
      };

      // Mock full_default to complete quickly
      mockWasmModule.full_default.mockImplementation(() => {
        setTimeout(() => {
          wasmCallbacks?.printErr(' ');
        }, 50); // Complete before timeout
      });

      const segments: any[] = [];
      let timeoutError: Error | null = null;

      try {
        for await (const segment of session.streaming(mockAudioData, options)) {
          segments.push(segment);
        }
      } catch (error) {
        timeoutError = error as Error;
      }

      expect(timeoutError).toBeNull();
    });

    it('should keep streamimg as a deprecated alias', async () => {
      const mockAudioData = new Float32Array(16000); // 1 second of audio

      mockWasmModule.full_default.mockImplementation(() => {
        setTimeout(() => {
          wasmCallbacks?.printErr(' ');
        }, 10);
      });

      const segments: any[] = [];
      for await (const segment of session.streamimg(mockAudioData)) {
        segments.push(segment);
      }

      expect(segments).toHaveLength(0);
    });

    it('should surface WASM errors from printErr in session streaming', async () => {
      const mockAudioData = new Float32Array(16000); // 1 second of audio

      mockWasmModule.full_default.mockImplementation(() => {
        setTimeout(() => {
          wasmCallbacks?.printErr('some error');
        }, 0);
      });

      const iterator = session.streaming(mockAudioData);
      await expect(iterator.next()).rejects.toThrow('some error');
    });
  });
});
