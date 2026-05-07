import { useCallback, useState } from 'react';

export function useCreativeSelection() {
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedCreativeIds((current) => (
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id]
    ));
  }, []);

  const clearSelection = useCallback(() => setSelectedCreativeIds([]), []);
  const selectAll = useCallback((ids: string[]) => setSelectedCreativeIds(ids), []);

  return {
    selectedCreativeIds,
    setSelectedCreativeIds,
    toggleSelection,
    clearSelection,
    selectAll,
  };
}
