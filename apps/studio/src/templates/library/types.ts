import type { StudioDocument } from '../../domain/document/types';

export type StudioTemplateVertical = 'cpg' | 'finance' | 'auto' | 'sports' | 'ecommerce' | 'custom';

export type TemplateBuildOptions = {
  name?: string;
  teamId?: string;
  copy?: Record<string, string>;
};

export type StudioTemplateMetadata = {
  id: string;
  name: string;
  description: string;
  vertical: StudioTemplateVertical;
  canvasPresetId?: string;
  thumbnail?: string;
  previewComponent?: () => JSX.Element;
  tags?: string[];
  workspaceScopes?: string[];
  featured?: boolean;
  featuredLabel?: string;
  curationRank?: number;
  sceneCount?: number;
  moduleHighlights?: string[];
  recommendedFor?: string;
};

export type StudioTemplate = {
  metadata: StudioTemplateMetadata;
  buildDocument: (options?: TemplateBuildOptions) => StudioDocument;
};
