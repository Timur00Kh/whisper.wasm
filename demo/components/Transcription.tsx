import React, { useEffect, useRef, useState } from 'react';
import {
  WhisperWasmService,
  convertFromAudioElement,
  convertFromFile,
  convertFromMediaStream,
  type AudioConversionResult,
} from '../../src/index';

interface TranscriptionProps {
  whisperService: WhisperWasmService;
  audioFile: File | null;
  modelLoaded: boolean;
}

export const Transcription: React.FC<TranscriptionProps> = ({
  whisperService,
  audioFile,
  modelLoaded,
}) => {
  const [transcription, setTranscription] = useState('');
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [canCancel, setCanCancel] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [status, setStatus] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micConversionPromiseRef = useRef<Promise<AudioConversionResult> | null>(null);
  const micCancelledRef = useRef(false);

  useEffect(() => {
    if (!audioFile) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  const msToTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const cancelTranscription = () => {
    if (abortController) {
      micCancelledRef.current = true;
      abortController.abort();
      setCanCancel(false);
      setLoading(false);
      setRecording(false);
      setAbortController(null);
      setStatus('Cancelled');
    }
  };

  const transcribeFloat32 = async (audioData: Float32Array, controller: AbortController) => {
    const session = whisperService.createSession();
    const result = await session.streamimg(audioData, {
      language: 'ru',
      threads: 25,
      translate: false,
    });

    for await (const segment of result) {
      if (controller.signal.aborted) {
        throw new Error('Transcription cancelled');
      }
      setTranscription(
        (t) =>
          t +
          `[${msToTime(segment.timeStart)} --> ${msToTime(segment.timeEnd)}]: ${segment.text}` +
          '\n',
      );
    }
  };

  const createConverterCallbacks = (controller: AbortController) => ({
    onProgress: (progress: number, message: string) => {
      if (controller.signal.aborted) return;
      setStatus(`${message} (${progress}%)`);
    },
    onError: (error: Error) => {
      if (controller.signal.aborted) return;
      console.error('Audio conversion error:', error);
      setStatus(`Audio conversion error: ${error.message}`);
    },
  });

  const transcribeFromFile = async () => {
    if (!modelLoaded || !audioFile || loading || recording) return;

    // Create new AbortController for this transcription
    const controller = new AbortController();
    setAbortController(controller);
    setCanCancel(true);
    setLoading(true);
    setTranscription(''); // Clear previous result
    setStatus('Converting file...');
    micCancelledRef.current = false;

    try {
      const conversion = await convertFromFile(
        audioFile,
        { signal: controller.signal, logLevel: 'ERROR' },
        createConverterCallbacks(controller),
      );

      if (controller.signal.aborted) return;
      console.log('Audio converted:', conversion.audioInfo, conversion.warnings ?? []);
      setStatus(
        `Audio ready: ${conversion.audioInfo.sampleRate}Hz, ${conversion.audioInfo.channels}ch, ${conversion.audioInfo.duration.toFixed(1)}s`,
      );

      await transcribeFloat32(conversion.audioData, controller);
      if (!controller.signal.aborted) setStatus('Transcription completed');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Transcription cancelled');
        setStatus('Cancelled');
      } else {
        console.error('Transcription error:', error);
        setStatus(`Transcription error: ${(error as Error).message}`);
      }
    }
    setLoading(false);
    setCanCancel(false);
    setAbortController(null);
  };

  const transcribeFromAudioElement = async () => {
    if (!modelLoaded || !audioFile || loading || recording) return;
    if (!audioRef.current) return;

    const controller = new AbortController();
    setAbortController(controller);
    setCanCancel(true);
    setLoading(true);
    setTranscription('');
    setStatus('Capturing from <audio>...');
    micCancelledRef.current = false;

    try {
      const conversion = await convertFromAudioElement(
        audioRef.current,
        { signal: controller.signal, logLevel: 'ERROR', recordingDurationMs: 10_000 },
        createConverterCallbacks(controller),
      );

      if (controller.signal.aborted) return;
      console.log('Audio element converted:', conversion.audioInfo, conversion.warnings ?? []);

      await transcribeFloat32(conversion.audioData, controller);
      if (!controller.signal.aborted) setStatus('Transcription completed');
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setStatus('Cancelled');
      } else {
        console.error('Transcription error:', error);
        setStatus(`Transcription error: ${(error as Error).message}`);
      }
    }

    setLoading(false);
    setCanCancel(false);
    setAbortController(null);
  };

  const startMicRecording = async () => {
    if (!modelLoaded || loading || recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('getUserMedia is not supported in this browser');
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setCanCancel(true);
    setRecording(true);
    setTranscription('');
    setStatus('Requesting microphone access...');
    micCancelledRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      setStatus('Recording... (press Stop to transcribe)');
      micConversionPromiseRef.current = convertFromMediaStream(
        stream,
        {
          signal: controller.signal,
          recordingDurationMs: 60_000,
          logLevel: 'ERROR',
        },
        createConverterCallbacks(controller),
      );
    } catch (e) {
      setRecording(false);
      setCanCancel(false);
      setAbortController(null);
      setStatus(`Microphone error: ${(e as Error).message}`);
    }
  };

  const stopMicAndTranscribe = async () => {
    if (!recording || !abortController || !micConversionPromiseRef.current) return;

    // abort stops recording early (gracefully) in the converter
    abortController.abort();
    setStatus('Stopping recording...');

    try {
      const conversion = await micConversionPromiseRef.current;
      if (micCancelledRef.current) {
        setStatus('Cancelled');
        return;
      }

      setLoading(true);
      setStatus('Transcribing microphone audio...');
      await transcribeFloat32(conversion.audioData, abortController);
      setStatus('Transcription completed');
    } catch (e) {
      if (micCancelledRef.current) {
        setStatus('Cancelled');
      } else {
        setStatus(`Microphone transcription error: ${(e as Error).message}`);
      }
    } finally {
      setLoading(false);
      setRecording(false);
      setCanCancel(false);
      setAbortController(null);
      micConversionPromiseRef.current = null;

      const stream = micStreamRef.current;
      micStreamRef.current = null;
      stream?.getTracks().forEach((t) => t.stop());
    }
  };

  return (
    <div className="section">
      <h2>4. Transcription</h2>
      {audioUrl && (
        <div style={{ marginBottom: '10px' }}>
          <audio ref={audioRef} controls src={audioUrl} style={{ width: '100%' }} />
        </div>
      )}
      <div style={{ marginBottom: '10px' }}>
        <button
          onClick={transcribeFromFile}
          disabled={loading || recording || !modelLoaded || !audioFile}
        >
          {loading ? 'Processing...' : 'Transcribe (from file)'}
        </button>
        <button
          onClick={transcribeFromAudioElement}
          disabled={loading || recording || !modelLoaded || !audioFile || !audioUrl}
          style={{ marginLeft: '10px' }}
        >
          Transcribe (from &lt;audio&gt;)
        </button>
        {canCancel && (
          <button onClick={cancelTranscription} style={{ marginLeft: '10px' }}>
            ❌ Cancel
          </button>
        )}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={startMicRecording} disabled={loading || recording || !modelLoaded}>
          🎙️ Start mic
        </button>
        <button
          onClick={stopMicAndTranscribe}
          disabled={!recording || loading || !modelLoaded}
          style={{ marginLeft: '10px' }}
        >
          ⏹ Stop & Transcribe
        </button>
      </div>

      <div className="debug-info">
        Debug: modelLoaded={modelLoaded ? 'true' : 'false'}, audioFile=
        {audioFile ? 'true' : 'false'}, loading={loading ? 'true' : 'false'}, canCancel=
        {canCancel ? 'true' : 'false'}, recording={recording ? 'true' : 'false'}
      </div>
      {status && <div className="status-info">{status}</div>}
      {transcription && (
        <div style={{ marginTop: '10px' }}>
          <h3>Result:</h3>
          <textarea
            className="textarea"
            value={transcription}
            readOnly
            style={{ height: '100px', marginTop: '10px' }}
          />
        </div>
      )}
    </div>
  );
};
