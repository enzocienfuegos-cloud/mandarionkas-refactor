export type VideoPlayerEvent =
  | 'play'
  | 'pause'
  | 'ended'
  | 'timeupdate'
  | 'durationchange'
  | 'volumechange'
  | 'error'
  | 'ready'
  | 'seeked';

export type VideoPlayerEventHandler<E extends VideoPlayerEvent = VideoPlayerEvent> =
  E extends 'timeupdate' ? (currentTimeSeconds: number) => void :
  E extends 'durationchange' ? (durationSeconds: number) => void :
  E extends 'error' ? (error: VideoPlayerError) => void :
  () => void;

export interface VideoPlayerError {
  code: number;
  message: string;
}

export interface VideoSource {
  src: string;
  type?: string;
}

export interface IVideoPlayer {
  loadSource(source: VideoSource): void;
  play(): Promise<void>;
  pause(): void;
  seek(timeSeconds: number): void;
  getCurrentTime(): number;
  getDuration(): number;
  setVolume(level: number): void;
  getVolume(): number;
  isMuted(): boolean;
  mute(): void;
  unmute(): void;
  isPlaying(): boolean;
  on<E extends VideoPlayerEvent>(event: E, handler: VideoPlayerEventHandler<E>): void;
  off<E extends VideoPlayerEvent>(event: E, handler: VideoPlayerEventHandler<E>): void;
  dispose(): void;
}
