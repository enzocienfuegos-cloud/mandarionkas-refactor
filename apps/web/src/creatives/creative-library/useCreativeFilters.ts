import { useCallback, useState } from 'react';

export function useCreativeFilters(initialSearch = '') {
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'publishing' | 'inactive' | 'attention' | 'preview'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'video' | 'display' | 'native'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');

  const resetAll = useCallback(() => {
    setSelectedClientIds([]);
    setSearchTerm('');
    setStatusFilter('all');
    setFormatFilter('all');
    setSizeFilter('all');
  }, []);

  return {
    selectedClientIds,
    setSelectedClientIds,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    formatFilter,
    setFormatFilter,
    sizeFilter,
    setSizeFilter,
    resetAll,
  };
}
