// src/components/Quotations/QuoteFilters.tsx
import React, { useState, useEffect } from 'react';
import { DateRangePicker } from './DateRangePicker';
import { useApp } from '../../context/AppContext';
import { saveDraftToStorage, loadDraftFromStorage, clearDraftFromStorage } from '../../utils/draftStorage';
import './QuoteFilters.css';

interface QuoteFiltersProps {
  onFiltersChange: (filters: {
    dateRange: { start: string; end: string } | null;
    searchTerm: string;
  }) => void;
  onClearFilters: () => void;
}

export function QuoteFilters({ onFiltersChange, onClearFilters }: QuoteFiltersProps) {
  const { user } = useApp();
  const FILTERS_KEY = user?.id ? `quotefilters_${user.id}` : null;

  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Restore persisted filter state on mount
  useEffect(() => {
    if (!FILTERS_KEY) return;
    const saved = loadDraftFromStorage<{ dateRange: { start: string; end: string } | null; searchTerm: string }>(FILTERS_KEY);
    if (!saved) return;
    if (saved.dateRange) {
      setDateRange(saved.dateRange);
      onFiltersChange({ dateRange: saved.dateRange, searchTerm: saved.searchTerm || '' });
    }
    if (saved.searchTerm) setSearchTerm(saved.searchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist filter changes
  useEffect(() => {
    if (!FILTERS_KEY) return;
    saveDraftToStorage(FILTERS_KEY, { dateRange, searchTerm });
  }, [dateRange, searchTerm, FILTERS_KEY]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      if (window.innerWidth > 768) {
        setIsMobileSearchOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    onFiltersChange({ dateRange, searchTerm: value });
  };


  const handleClearAll = () => {
    setDateRange(null);
    setSearchTerm('');
    if (FILTERS_KEY) clearDraftFromStorage(FILTERS_KEY);
    onClearFilters();
  };

  const hasActiveFilters = dateRange || searchTerm;


  // Desktop View
  if (!isMobile) {
    return (
      <>
        <div className="quote-filters">
          <div className="filters-header">
            <h4>Filter & Search</h4>
          </div>

          <div className="filters-content">
            {/* Date Range Filter */}
            <div className="filter-group">
              <label className="filter-label">Date Range</label>
              <DateRangePicker
                startDate={dateRange?.start || null}
                endDate={dateRange?.end || null}
                onDateChange={(start, end) => {
                  const newDateRange = start && end ? { start, end } : null;
                  setDateRange(newDateRange);
                  onFiltersChange({ dateRange: newDateRange, searchTerm });
                }}
                placeholder="Select date range..."
              />
            </div>

            {/* Search Filter */}
            <div className="filter-group">
              <label className="filter-label">Search</label>
              <input
                type="text"
                className="search-input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Management Controls (Sort) */}

      </>
    );
  }

  // Mobile View - Icon only, expands when clicked
  return (
    <>
      <div className="quote-filters mobile">
        <div className="filters-header">
          <h4>Filter & Search</h4>
        </div>

        <div className="filters-content">
          {/* Date Range Filter - Keep on mobile */}
          <div className="filter-group">
            <label className="filter-label">Date Range</label>
            <DateRangePicker
              startDate={dateRange?.start || null}
              endDate={dateRange?.end || null}
              onDateChange={(start, end) => {
                const newDateRange = start && end ? { start, end } : null;
                setDateRange(newDateRange);
                onFiltersChange({ dateRange: newDateRange, searchTerm });
              }}
              placeholder="Select date range..."
            />
          </div>
        </div>
      </div>



      {/* Mobile Full Search Overlay */}
      {isMobileSearchOpen && (
        <>
          <div className="mobile-search-overlay">
            <div className="mobile-search-header">
              <button
                className="mobile-search-close"
                onClick={() => {
                  setIsMobileSearchOpen(false);
                  setSearchTerm('');
                  onFiltersChange({ dateRange, searchTerm: '' });
                }}
              >
                <i className="fas fa-times"></i>
              </button>
              <input
                type="text"
                className="mobile-search-input"
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}