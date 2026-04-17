import { createInitialState } from '../../domain/document/factories';
import type { StudioState } from '../../domain/document/types';

export function createDegradedExportMediaFixture(): StudioState {
  const state = createInitialState({
    name: 'Degraded Export Media',
    backgroundColor: '#0f172a',
  });

  const scene = state.document.scenes[0];
  scene.id = 'scene_media';
  scene.name = 'Media';
  scene.durationMs = 5000;
  scene.transition = { type: 'fade', durationMs: 300 };

  state.document.canvas.width = 300;
  state.document.canvas.height = 250;

  state.document.widgets.video_story = {
    id: 'video_story',
    type: 'video-hero',
    name: 'Video Story',
    sceneId: scene.id,
    zIndex: 1,
    frame: { x: 16, y: 16, width: 268, height: 124, rotation: 0 },
    props: {
      src: 'https://cdn.example.com/media/story.mp4',
      posterSrc: 'data:image/svg+xml;charset=UTF-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 268 124%22%3E%3Crect width=%22268%22 height=%22124%22 rx=%2218%22 fill=%22%230f172a%22/%3E%3Ccircle cx=%22134%22 cy=%2262%22 r=%2222%22 fill=%22%23f8fafc%22 fill-opacity=%220.94%22/%3E%3Cpath d=%22M128 49l18 13-18 13V49z%22 fill=%22%230f172a%22/%3E%3C/svg%3E',
    },
    style: {
      fit: 'cover',
      borderRadius: 18,
      boxShadow: '0 18px 36px rgba(15,23,42,0.28)',
    },
    timeline: { startMs: 0, endMs: 5000 },
  };

  state.document.widgets.carousel_story = {
    id: 'carousel_story',
    type: 'image-carousel',
    name: 'Carousel Story',
    sceneId: scene.id,
    zIndex: 2,
    frame: { x: 16, y: 154, width: 268, height: 80, rotation: 0 },
    props: {
      title: 'Carousel Story',
      slides: [
        'https://cdn.example.com/media/slide-1.jpg|First frame',
        'https://cdn.example.com/media/slide-2.jpg|Second frame',
        'https://cdn.example.com/media/slide-3.jpg|Third frame',
      ].join(';'),
      autoplay: true,
      intervalMs: 2200,
    },
    style: {
      backgroundColor: '#111827',
      accentColor: '#f8fafc',
      color: '#ffffff',
      borderRadius: 18,
    },
    timeline: { startMs: 0, endMs: 5000 },
  };

  scene.widgetIds = ['video_story', 'carousel_story'];

  return state;
}
