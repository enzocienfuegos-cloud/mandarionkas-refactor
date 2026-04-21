import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import type {
  IVideoPlayer,
  VideoPlayerEvent,
  VideoPlayerEventHandler,
  VideoPlayerError,
  VideoSource,
} from './IVideoPlayer';

type VjsEventMap = {
  play: 'play';
  pause: 'pause';
  ended: 'ended';
  timeupdate: 'timeupdate';
  durationchange: 'durationchange';
  volumechange: 'volumechange';
  error: 'error';
  ready: 'ready';
  seeked: 'seeked';
};

const VJS_EVENT: VjsEventMap = {
  play: 'play',
  pause: 'pause',
  ended: 'ended',
  timeupdate: 'timeupdate',
  durationchange: 'durationchange',
  volumechange: 'volumechange',
  error: 'error',
  ready: 'ready',
  seeked: 'seeked',
};

export function createVideoJsAdapter(
  element: HTMLVideoElement,
  options: Record<string, unknown> = {},
): IVideoPlayer {
  const player: Player = videojs(element, {
    controls: false,
    preload: 'auto',
    fluid: true,
    responsive: true,
    ...options,
  });

  const handlerMap = new WeakMap<VideoPlayerEventHandler, (...args: unknown[]) => void>();

  function wrapHandler<E extends VideoPlayerEvent>(
    event: E,
    handler: VideoPlayerEventHandler<E>,
  ): (...args: unknown[]) => void {
    switch (event) {
      case 'timeupdate':
        return () => (handler as VideoPlayerEventHandler<'timeupdate'>)(player.currentTime() ?? 0);
      case 'durationchange':
        return () => (handler as VideoPlayerEventHandler<'durationchange'>)(player.duration() ?? 0);
      case 'error':
        return () => {
          const err = player.error();
          const typedError: VideoPlayerError = {
            code: err?.code ?? -1,
            message: err?.message ?? 'Unknown player error',
          };
          (handler as VideoPlayerEventHandler<'error'>)(typedError);
        };
      default:
        return handler as () => void;
    }
  }

  return {
    loadSource(source: VideoSource): void {
      player.src({ src: source.src, type: source.type });
    },
    play(): Promise<void> {
      return player.play() ?? Promise.resolve();
    },
    pause(): void {
      player.pause();
    },
    seek(timeSeconds: number): void {
      player.currentTime(timeSeconds);
    },
    getCurrentTime(): number {
      return player.currentTime() ?? 0;
    },
    getDuration(): number {
      return player.duration() ?? 0;
    },
    setVolume(level: number): void {
      player.volume(Math.max(0, Math.min(1, level)));
    },
    getVolume(): number {
      return player.volume() ?? 1;
    },
    isMuted(): boolean {
      return player.muted() ?? false;
    },
    mute(): void {
      player.muted(true);
    },
    unmute(): void {
      player.muted(false);
    },
    isPlaying(): boolean {
      return !player.paused() && !player.ended();
    },
    on<E extends VideoPlayerEvent>(event: E, handler: VideoPlayerEventHandler<E>): void {
      const wrapped = wrapHandler(event, handler);
      handlerMap.set(handler, wrapped);
      player.on(VJS_EVENT[event], wrapped);
    },
    off<E extends VideoPlayerEvent>(event: E, handler: VideoPlayerEventHandler<E>): void {
      const wrapped = handlerMap.get(handler);
      if (wrapped) {
        player.off(VJS_EVENT[event], wrapped);
        handlerMap.delete(handler);
      }
    },
    dispose(): void {
      player.dispose();
    },
  };
}
