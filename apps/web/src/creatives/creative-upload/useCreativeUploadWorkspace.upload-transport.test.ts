import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../catalog', () => ({
  completeCreativeIngestion: vi.fn(),
  createCreativeIngestionUpload: vi.fn(),
  loadCreativeIngestion: vi.fn(),
  publishCreativeIngestion: vi.fn(),
  uploadFileToSignedUrl: vi.fn(),
  uploadFileViaApiProxy: vi.fn(),
}));

import { uploadFileToSignedUrl, uploadFileViaApiProxy } from '../catalog';
import { uploadCreativeFileForIngestion } from './useCreativeUploadWorkspace';

describe('creative upload transport selection', () => {
  const file = new File(['creative'], 'creative.zip', { type: 'application/zip' });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(uploadFileToSignedUrl).mockResolvedValue(undefined);
    vi.mocked(uploadFileViaApiProxy).mockResolvedValue(undefined);
  });

  it('uses the presigned R2 URL when it is available', async () => {
    const onProgress = vi.fn();

    const transport = await uploadCreativeFileForIngestion({
      presignedUrl: 'https://r2.example.com/signed',
      proxyUrl: 'https://api.example.com/v1/creative-ingestions/id/upload-proxy',
      uploadUrl: 'https://api.example.com/legacy',
    }, file, onProgress);

    expect(transport).toBe('presigned');
    expect(uploadFileToSignedUrl).toHaveBeenCalledWith('https://r2.example.com/signed', file, onProgress);
    expect(uploadFileViaApiProxy).not.toHaveBeenCalled();
  });

  it('uses the API proxy when the API cannot provide a presigned URL', async () => {
    const onProgress = vi.fn();

    const transport = await uploadCreativeFileForIngestion({
      presignedUrl: null,
      proxyUrl: 'https://api.example.com/v1/creative-ingestions/id/upload-proxy',
      uploadUrl: 'https://api.example.com/legacy',
    }, file, onProgress);

    expect(transport).toBe('proxy');
    expect(uploadFileToSignedUrl).not.toHaveBeenCalled();
    expect(uploadFileViaApiProxy).toHaveBeenCalledWith(
      'https://api.example.com/v1/creative-ingestions/id/upload-proxy',
      file,
      onProgress,
    );
  });

  it('falls back to the API proxy if the direct R2 upload fails', async () => {
    const onProgress = vi.fn();
    vi.mocked(uploadFileToSignedUrl).mockRejectedValue(new Error('R2 PUT blocked'));

    const transport = await uploadCreativeFileForIngestion({
      presignedUrl: 'https://r2.example.com/signed',
      proxyUrl: 'https://api.example.com/v1/creative-ingestions/id/upload-proxy',
    }, file, onProgress);

    expect(transport).toBe('proxy');
    expect(uploadFileToSignedUrl).toHaveBeenCalledWith('https://r2.example.com/signed', file, onProgress);
    expect(uploadFileViaApiProxy).toHaveBeenCalledWith(
      'https://api.example.com/v1/creative-ingestions/id/upload-proxy',
      file,
      onProgress,
    );
    expect(onProgress).toHaveBeenCalledWith({ loadedBytes: 0, totalBytes: file.size, percent: 0 });
  });
});
