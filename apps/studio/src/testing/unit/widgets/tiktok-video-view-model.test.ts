import { describe, expect, it } from 'vitest';
import { buildTikTokVideoViewModel } from '../../../widgets/modules/tiktok-video.view-model';

function createTikTokVideoFixture(props: Record<string, unknown> = {}) {
  return {
    style: {},
    props: {
      username: 'yourbrand',
      caption: 'Your ad copy goes here. Two lines visible.',
      hashtags: '#trending #fyp',
      ...props,
    },
  } as const;
}

describe('tiktok video view model', () => {
  it('resolves default social copy and affordances', () => {
    const viewModel = buildTikTokVideoViewModel(createTikTokVideoFixture());

    expect(viewModel.username).toBe('yourbrand');
    expect(viewModel.showHearts).toBe(true);
    expect(viewModel.showMuteButton).toBe(true);
    expect(viewModel.showVerified).toBe(true);
  });

  it('marks placeholder assets as non-playable video sources', () => {
    const viewModel = buildTikTokVideoViewModel(createTikTokVideoFixture({
      videoSrc: '__upload_pending__',
    }));

    expect(viewModel.hasVideo).toBe(false);
  });

  it('preserves custom counters and cta styling', () => {
    const viewModel = buildTikTokVideoViewModel(createTikTokVideoFixture({
      likesCount: '98K',
      commentsCount: '4.2K',
      sharesCount: '18K',
      ctaLabel: 'Install Now',
      ctaColor: '#123456',
      ctaTextColor: '#fedcba',
    }));

    expect(viewModel.likesCount).toBe('98K');
    expect(viewModel.commentsCount).toBe('4.2K');
    expect(viewModel.sharesCount).toBe('18K');
    expect(viewModel.ctaLabel).toBe('Install Now');
    expect(viewModel.ctaColor).toBe('#123456');
    expect(viewModel.ctaTextColor).toBe('#fedcba');
  });

  it('keeps explicit hidden toggles off', () => {
    const viewModel = buildTikTokVideoViewModel(createTikTokVideoFixture({
      showHearts: false,
      showProgressBar: false,
      showMuteButton: false,
      showVerified: false,
    }));

    expect(viewModel.showHearts).toBe(false);
    expect(viewModel.showProgressBar).toBe(false);
    expect(viewModel.showMuteButton).toBe(false);
    expect(viewModel.showVerified).toBe(false);
  });

  it('derives the cta colors from the active module preset when defaults are untouched', () => {
    const viewModel = buildTikTokVideoViewModel({
      ...createTikTokVideoFixture(),
      style: { modulePreset: 'commerce' },
    });

    expect(viewModel.ctaColor).not.toBe('#fe2c55');
    expect(viewModel.ctaTextColor).not.toBe('#ffffff');
  });
});
