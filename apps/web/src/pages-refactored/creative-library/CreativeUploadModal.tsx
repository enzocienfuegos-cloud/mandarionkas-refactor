import React, { useCallback, useState } from 'react';
import { Upload, FileText, X } from '../../system/icons';
import { Modal, Button, FormField, Input, Select, useToast } from '../../system';
import { FORMAT_OPTIONS, formatFileSize } from './types';
import type { CreativeFormat } from './types';

export interface CreativeUploadModalProps {
  open: boolean;
  onClose: () => void;
  onUploaded: () => void;
}

interface UploadItem {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
}

/**
 * Multi-file upload modal for creatives. Drag-drop + manual select.
 *
 * Replaces ~600 lines of inline upload UI from the legacy CreativeLibrary.
 */
export function CreativeUploadModal({ open, onClose, onUploaded }: CreativeUploadModalProps) {
  const { toast } = useToast();
  const [items, setItems]   = useState<UploadItem[]>([]);
  const [name, setName]     = useState('');
  const [format, setFormat] = useState<CreativeFormat>('display');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver]   = useState(false);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const next: UploadItem[] = Array.from(files).map((file) => ({
      file, status: 'pending', progress: 0,
    }));
    setItems((current) => [...current, ...next]);
  }, []);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (event.dataTransfer?.files?.length) handleFiles(event.dataTransfer.files);
  };

  const removeItem = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  const handleUpload = async () => {
    if (items.length === 0) {
      toast({ tone: 'warning', title: 'No files selected' });
      return;
    }
    setUploading(true);

    try {
      // In practice this would use FormData + progress events.
      // Placeholder: hit a single endpoint per file.
      for (let index = 0; index < items.length; index += 1) {
        setItems((current) =>
          current.map((it, i) => (i === index ? { ...it, status: 'uploading' as const } : it)),
        );

        const formData = new FormData();
        formData.append('file', items[index].file);
        if (name) formData.append('name', name);
        formData.append('format', format);

        const res = await fetch('/v1/creatives', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });

        if (!res.ok) throw new Error(`Upload failed: ${items[index].file.name}`);

        setItems((current) =>
          current.map((it, i) => (i === index ? { ...it, status: 'done' as const, progress: 100 } : it)),
        );
      }

      toast({ tone: 'success', title: `${items.length} creatives uploaded` });
      onUploaded();
      onClose();
      setItems([]);
      setName('');
    } catch (error: any) {
      toast({ tone: 'critical', title: 'Upload failed', description: error?.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => { if (!uploading) onClose(); }}
      title="Upload creatives"
      description="Drag and drop files, or browse to select."
      size="lg"
      preventBackdropClose={uploading}
      preventEscapeClose={uploading}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
          <Button variant="primary" loading={uploading} onClick={handleUpload}>
            Upload {items.length > 0 ? `${items.length} file${items.length === 1 ? '' : 's'}` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`
            relative rounded-xl border-2 border-dashed p-8 text-center transition-colors
            ${dragOver
              ? 'border-brand-500 bg-surface-active'
              : 'border-[color:var(--dusk-border-default)] hover:border-[color:var(--dusk-border-strong)]'}
          `}
        >
          <Upload className="mx-auto h-8 w-8 text-[color:var(--dusk-text-muted)]" />
          <p className="mt-3 text-sm font-medium text-[color:var(--dusk-text-primary)]">
            Drag and drop files here
          </p>
          <p className="mt-1 text-xs text-[color:var(--dusk-text-muted)]">
            Or click to browse — HTML5, MP4, JPG, PNG up to 10 MB
          </p>
          <input
            type="file"
            multiple
            accept=".html,.zip,.mp4,.webm,.jpg,.jpeg,.png,.gif"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="absolute inset-0 opacity-0 cursor-pointer"
            aria-label="Browse files"
          />
        </div>

        {/* Upload metadata */}
        {items.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Name (optional)" helper="Defaults to filename if blank">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 hero banner" />
            </FormField>
            <FormField label="Format">
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as CreativeFormat)}
                options={FORMAT_OPTIONS.filter((opt) => opt.value !== 'all')}
              />
            </FormField>
          </div>
        )}

        {/* File list */}
        {items.length > 0 && (
          <ul className="space-y-1.5 max-h-48 overflow-y-auto dusk-scrollbar">
            {items.map((item, index) => (
              <li
                key={`${item.file.name}-${index}`}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[color:var(--dusk-surface-muted)]"
              >
                <FileText className="h-4 w-4 text-[color:var(--dusk-text-muted)] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[color:var(--dusk-text-primary)] truncate">
                    {item.file.name}
                  </p>
                  <p className="text-[10px] text-[color:var(--dusk-text-soft)]">
                    {formatFileSize(item.file.size)}
                    {item.status === 'uploading' && ' · uploading…'}
                    {item.status === 'done' && ' · ready'}
                    {item.status === 'error' && ` · ${item.error ?? 'error'}`}
                  </p>
                </div>
                {!uploading && item.status === 'pending' && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="shrink-0 p-1 rounded text-[color:var(--dusk-text-soft)] hover:text-[color:var(--dusk-text-primary)]"
                    aria-label="Remove file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
