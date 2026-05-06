import React, { useState, type FormEvent } from 'react';
import { Button, Input, Modal, Select } from '../../system';
import { normalizeExperiment, type Experiment, type Tag, type Variant } from './types';

export function CreateExperimentModal({
  tags,
  onClose,
  onCreated,
}: {
  tags: Tag[];
  onClose: () => void;
  onCreated: (experiment: Experiment) => void;
}) {
  const [name, setName] = useState('');
  const [tagId, setTagId] = useState('');
  const [variants, setVariants] = useState<Variant[]>([
    { name: 'Control', weight: 50 },
    { name: 'Variant A', weight: 50 },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const totalWeight = variants.reduce((sum, variant) => sum + variant.weight, 0);
  const weightValid = totalWeight === 100;

  const addVariant = () => setVariants((current) => [...current, { name: `Variant ${String.fromCharCode(64 + current.length)}`, weight: 0 }]);
  const removeVariant = (index: number) => setVariants((current) => current.filter((_, currentIndex) => currentIndex !== index));
  const setVariantField = (index: number, field: keyof Variant, value: string | number) =>
    setVariants((current) => current.map((variant, currentIndex) => (currentIndex === index ? { ...variant, [field]: value } : variant)));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) { setError('Experiment name is required.'); return; }
    if (!tagId) { setError('Select a tag.'); return; }
    if (variants.length < 2) { setError('At least 2 variants required.'); return; }
    if (!weightValid) { setError(`Variant weights must sum to 100 (currently ${totalWeight}).`); return; }
    if (variants.some((variant) => !variant.name.trim())) { setError('All variants must have a name.'); return; }

    setSaving(true);
    try {
      const response = await fetch('/v1/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), tagId, variants }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.message ?? 'Failed to create experiment');
      }
      const data = await response.json();
      onCreated(normalizeExperiment(data?.experiment ?? data));
    } catch (createError: any) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title="New Experiment">
      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50/90 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            Experiment Name <span className="text-critical-fg">*</span>
          </label>
          <Input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Homepage CTA Test"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-text-secondary">
            Tag <span className="text-critical-fg">*</span>
          </label>
          <Select
            value={tagId}
            onChange={(event) => setTagId(event.target.value)}
            options={[
              { value: '', label: 'Select tag' },
              ...tags.map((tag) => ({ value: tag.id, label: tag.name })),
            ]}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-text-secondary">
              Variants
              {!weightValid && (
                <span className="ml-2 text-xs text-critical-fg">Weights: {totalWeight}/100</span>
              )}
              {weightValid && (
                <span className="ml-2 text-xs text-success-fg">100%</span>
              )}
            </label>
            <Button type="button" variant="ghost" size="sm" onClick={addVariant}>
              Add Variant
            </Button>
          </div>
          <div className="space-y-2">
            {variants.map((variant, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="text"
                  value={variant.name}
                  onChange={(event) => setVariantField(index, 'name', event.target.value)}
                  className="flex-1"
                  placeholder="Variant name"
                />
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={variant.weight}
                    onChange={(event) => setVariantField(index, 'weight', Number(event.target.value))}
                    className="w-16 text-center"
                  />
                  <span className="text-xs text-text-muted">%</span>
                </div>
                {variants.length > 2 && (
                  <Button type="button" onClick={() => removeVariant(index)} variant="ghost" size="sm" aria-label={`Remove ${variant.name}`}>
                    ×
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={saving} className="flex-1">
            Create Experiment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
