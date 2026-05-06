import { useState } from 'react';
import {
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  loadCreativeSizeVariants,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  type Creative,
  type CreativeVersion,
} from '../catalog';
import type { VariantState } from './types';

type VariantFormField = 'label' | 'width' | 'height';
type VariantPreset = { label: string; width: number; height: number };

export function useVariantManager() {
  const [variantState, setVariantState] = useState<VariantState | null>(null);

  const openVariantManager = async (creative: Creative, version: CreativeVersion) => {
    setVariantState({
      creativeId: creative.id,
      creativeName: creative.name,
      versionId: version.id,
      loading: true,
      error: '',
      variants: [],
      selectedVariantIds: [],
      form: {
        label: version.width && version.height ? `${version.width}x${version.height}` : '',
        width: version.width ? String(version.width) : '',
        height: version.height ? String(version.height) : '',
      },
    });
    try {
      const variants = await loadCreativeSizeVariants(version.id);
      setVariantState((current) => current ? { ...current, loading: false, variants, selectedVariantIds: [] } : current);
    } catch (loadError: any) {
      setVariantState((current) => current ? {
        ...current,
        loading: false,
        error: loadError.message ?? 'Failed to load size variants',
        selectedVariantIds: [],
      } : current);
    }
  };

  const handleVariantStatusChange = async (variantId: string, status: 'active' | 'paused') => {
    setVariantState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateCreativeSizeVariant({ variantId, status });
      const variants = await loadCreativeSizeVariants(variantState?.versionId ?? '');
      setVariantState((current) => current ? { ...current, loading: false, variants } : current);
    } catch (updateError: any) {
      setVariantState((current) => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update variant' } : current);
    }
  };

  const toggleVariantSelection = (variantId: string) => {
    setVariantState((current) => {
      if (!current) return current;
      const selected = current.selectedVariantIds.includes(variantId)
        ? current.selectedVariantIds.filter((id) => id !== variantId)
        : [...current.selectedVariantIds, variantId];
      return { ...current, selectedVariantIds: selected };
    });
  };

  const toggleSelectAllVariants = () => {
    setVariantState((current) => {
      if (!current) return current;
      const selectableIds = current.variants.map((variant) => variant.id);
      const selectedVariantIds = current.selectedVariantIds.length === selectableIds.length
        ? []
        : selectableIds;
      return { ...current, selectedVariantIds };
    });
  };

  const handleCreateVariant = async () => {
    if (!variantState) return;
    const width = Number(variantState.form.width);
    const height = Number(variantState.form.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      setVariantState((current) => current ? { ...current, error: 'Width and height must be positive numbers.' } : current);
      return;
    }

    setVariantState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      await createCreativeSizeVariant({
        creativeVersionId: variantState.versionId,
        label: variantState.form.label.trim() || `${width}x${height}`,
        width,
        height,
        status: 'draft',
      });
      const variants = await loadCreativeSizeVariants(variantState.versionId);
      setVariantState((current) => current ? {
        ...current,
        loading: false,
        variants,
        selectedVariantIds: [],
        form: { ...current.form, label: '', width: '', height: '' },
      } : current);
    } catch (createError: any) {
      setVariantState((current) => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create variant' } : current);
    }
  };

  const handleCreatePresetVariants = async (presets: VariantPreset[]) => {
    if (!variantState || presets.length === 0) return;
    setVariantState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await createCreativeSizeVariantsBulk({
        creativeVersionId: variantState.versionId,
        variants: presets.map((preset) => ({
          label: preset.label,
          width: preset.width,
          height: preset.height,
          status: 'draft',
        })),
      });
      setVariantState((current) => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
        error: response.skippedCount > 0 ? `${response.skippedCount} duplicate size(s) skipped.` : '',
      } : current);
    } catch (createError: any) {
      setVariantState((current) => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create preset sizes' } : current);
    }
  };

  const handleBulkVariantStatusChange = async (status: 'active' | 'paused') => {
    if (!variantState || variantState.selectedVariantIds.length === 0) {
      setVariantState((current) => current ? { ...current, error: 'Select at least one size first.' } : current);
      return;
    }
    setVariantState((current) => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await updateCreativeSizeVariantsBulkStatus({
        creativeVersionId: variantState.versionId,
        variantIds: variantState.selectedVariantIds,
        status,
      });
      setVariantState((current) => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
      } : current);
    } catch (updateError: any) {
      setVariantState((current) => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update selected sizes' } : current);
    }
  };

  const handleVariantFormChange = (field: VariantFormField, value: string) => {
    setVariantState((current) => current ? { ...current, form: { ...current.form, [field]: value } } : current);
  };

  return {
    variantState,
    setVariantState,
    openVariantManager,
    handleVariantStatusChange,
    toggleVariantSelection,
    toggleSelectAllVariants,
    handleCreateVariant,
    handleCreatePresetVariants,
    handleBulkVariantStatusChange,
    handleVariantFormChange,
  };
}
