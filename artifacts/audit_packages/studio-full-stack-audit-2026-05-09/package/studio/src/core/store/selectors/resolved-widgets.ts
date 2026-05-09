import type { StudioState } from '../../../domain/document/types';
import { buildResolvedWidgetsById } from '../../../domain/document/canvas-variants';

export function selectResolvedWidgetsById(state: StudioState) {
  return buildResolvedWidgetsById(state.document);
}
