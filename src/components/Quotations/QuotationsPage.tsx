// src/components/Quotations/QuotationsPage.tsx
import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { useQuotes } from "../../hooks/useQuotes";
import { formatCurrency, formatDate } from "../../utils/formatters";
import { Quote, DraftQuote } from "../../types";
import { QuoteCard } from "./QuoteCard";
import { QuotePreview } from "./QuotePreview";
import { QuoteFilters } from "./QuoteFilters";
import "./QuotationsPage.css";

export const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useApp();
  const { quotes, drafts, loading, fetchFullQuote, refetch, deleteQuote } = useQuotes(user?.id);

  // ── Dashboard statistics ────────────────────────────────────────────────
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const quotesSentTotal = quotes.length;

  const allTimeRevenue = useMemo(
    () => quotes.reduce((sum, q) => sum + (q.total || 0), 0),
    [quotes],
  );

  const outstandingValue = useMemo(
    () => drafts.reduce((sum, d) => sum + (d.total || 0), 0),
    [drafts],
  );

  const thisMonthQuotes = useMemo(
    () =>
      [...quotes, ...drafts].filter((q) => {
        const d = new Date(q.createdAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      }).length,
    [quotes, drafts],
  );

  const lastMonthQuotes = useMemo(() => {
    const lm = currentMonth === 0 ? 11 : currentMonth - 1;
    const ly = currentMonth === 0 ? currentYear - 1 : currentYear;
    return [...quotes, ...drafts].filter((q) => {
      const d = new Date(q.createdAt);
      return d.getMonth() === lm && d.getFullYear() === ly;
    }).length;
  }, [quotes, drafts]);

  const greetingHour = now.getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 18
        ? "Good afternoon"
        : "Good evening";

  const currency = user?.preferences?.currency || "USD";

  const recentActivity = useMemo(() => {
    return [...quotes, ...drafts]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 5);
  }, [quotes, drafts]);

  const relativeTime = (date: Date | string) => {
    const d = new Date(date);
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return formatDate(d);
  };

  const [showAllQuotations, setShowAllQuotations] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "drafts" | "finals">(
    "all",
  );
  const [filters, setFilters] = useState({
    dateRange: null,
    searchTerm: "",
  });
  const [sortBy, setSortBy] = useState<
    "date" | "number" | "customer" | "amount"
  >("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [previewQuote, setPreviewQuote] = useState<Quote | DraftQuote | null>(
    null,
  );
  const [isViewingFinal, setIsViewingFinal] = useState(false);
  const [loadingQuoteId, setLoadingQuoteId] = useState<string | null>(null);

  // Filter logic
  const filteredData = useMemo(() => {
    let data;
    if (activeTab === "all") {
      data = [...quotes, ...drafts];
    } else if (activeTab === "drafts") {
      data = drafts;
    } else {
      data = quotes;
    }

    // Start with all data
    let filtered = data;

    // Apply existing filters
    filtered = filtered.filter((quote: Quote | DraftQuote) => {
      // Date range filter
      if (filters.dateRange) {
        const quoteDate = new Date(quote.createdAt);
        const startDate = new Date(filters.dateRange.start);
        const endDate = new Date(filters.dateRange.end);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (quoteDate < startDate || quoteDate > endDate) {
          return false;
        }
      }

      // Search filter - always search all fields
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesNumber = quote.quoteNumber
          ?.toLowerCase()
          .includes(searchLower);
        const matchesCustomer = quote.customer.name
          ?.toLowerCase()
          .includes(searchLower);
        const matchesAmount = quote.total.toString().includes(searchLower);
        const matchesEmail = quote.customer.email
          ?.toLowerCase()
          .includes(searchLower);

        if (
          !matchesNumber &&
          !matchesCustomer &&
          !matchesAmount &&
          !matchesEmail
        ) {
          return false;
        }

        // Store match information on the quote object
        (quote as any).searchMatches = {
          quoteNumber: matchesNumber,
          customerName: matchesCustomer,
          amount: matchesAmount,
          email: matchesEmail,
        };
      } else {
        // Clear match information when no search term
        (quote as any).searchMatches = null;
      }

      return true;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      try {
        let comparison = 0;

        switch (sortBy) {
          case "date":
            comparison =
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case "number":
            comparison = (a.quoteNumber || "").localeCompare(
              b.quoteNumber || "",
            );
            break;
          case "customer":
            comparison = a.customer.name.localeCompare(b.customer.name);
            break;
          case "amount":
            comparison = a.total - b.total;
            break;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      } catch (error) {
        console.error("QuotationsPage: Error sorting quotes:", error);
        return 0;
      }
    });

    return filtered;
  }, [quotes, drafts, activeTab, filters, sortBy, sortOrder]);

  // Pagination logic
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Sort handler
  const handleSort = (column: "date" | "number" | "customer" | "amount") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Get sort icon
  const getSortIcon = (column: "date" | "number" | "customer" | "amount") => {
    if (sortBy !== column) {
      return <i className="fas fa-sort sort-icon"></i>;
    }
    return sortOrder === "asc" ? (
      <i className="fas fa-sort-up sort-icon active"></i>
    ) : (
      <i className="fas fa-sort-down sort-icon active"></i>
    );
  };

  // Filter handlers
  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleTabChange = (tab: "all" | "drafts" | "finals") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleItemsPerPageChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setItemsPerPage(Number(e.target.value));
    setCurrentPage(1);
  };

  const handleViewQuote = async (quote: Quote | DraftQuote) => {
    if (quote.id) {
      setLoadingQuoteId(quote.id);
      try {
        const full = await fetchFullQuote(quote.id);
        setPreviewQuote(full || quote);
        setIsViewingFinal((full || quote).status !== "draft");
      } finally {
        setLoadingQuoteId(null);
      }
    } else {
      setPreviewQuote(quote);
      setIsViewingFinal(quote.status !== "draft");
    }
  };

  const handleEditQuote = async (quote: Quote | DraftQuote) => {
    if (quote.id) {
      navigate(`/create-quote?id=${quote.id}`);
    } else {
      navigate('/create-quote');
    }
  };

  const handleDeleteQuote = async (quote: Quote | DraftQuote) => {
    if (!quote.id) return;
    const label = quote.quoteNumber ? `quote ${quote.quoteNumber}` : 'this draft';
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await deleteQuote(quote.id, quote.status || 'draft');
    } catch {
      // error already logged in hook
    }
  };

  if (loading) {
    return (
      <div className="quotations-page">
        <div className="dash-summary">
          <div className="dash-greeting">
            <div className="dash-greeting-text">
              <div
                className="skeleton skeleton--h2"
                style={{
                  width: "220px",
                  height: "28px",
                  borderRadius: "6px",
                  background: "var(--skeleton-bg,#e2e8f0)",
                  marginBottom: "6px",
                }}
              />
              <div
                className="skeleton"
                style={{
                  width: "180px",
                  height: "16px",
                  borderRadius: "4px",
                  background: "var(--skeleton-bg,#e2e8f0)",
                }}
              />
            </div>
          </div>
          <div className="dash-cards">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="dash-card"
                style={{
                  background: "var(--skeleton-card,#f8fafc)",
                  border: "1px solid var(--border,#e2e8f0)",
                }}
              >
                <div
                  style={{
                    height: "60px",
                    borderRadius: "6px",
                    background: "var(--skeleton-bg,#e2e8f0)",
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="quotes-section">
          <div className="quotes-header">
            <h3>Recent Quotations</h3>
          </div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="quotes-table-header"
              style={{
                marginBottom: "8px",
                borderRadius: "8px",
                background: "var(--skeleton-bg,#f1f5f9)",
                height: "52px",
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="quotations-page">
      {/* ── Dashboard summary ─────────────────────────────────────────── */}
      <div className="dash-summary">
        <div className="dash-greeting">
          <div className="dash-greeting-text">
            <h2 className="dash-hello">
              {greeting}
              {user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
            </h2>
            <p className="dash-sub">Here's your business overview</p>
          </div>
          <button
            className="btn btn-primary dash-new-btn"
            onClick={() => navigate('/create-quote')}
          >
            + New Quote
          </button>
        </div>

        <div className="dash-cards">
          {/* All Quotations */}
          <div
            className="dash-card dash-card--amber dash-card--clickable"
            onClick={() => setShowAllQuotations(true)}
            title="View all quotations"
          >
            <div className="dash-card-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect
                  x="3"
                  y="2"
                  width="16"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M7 7h8M7 11h8M7 15h8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="dash-card-body">
              <p className="dash-card-value">{quotes.length + drafts.length}</p>
              <p className="dash-card-label">All Quotations</p>
              <p className="dash-card-sub">Click to view all</p>
            </div>
          </div>

          {/* Quotes Sent */}
          <div className="dash-card dash-card--blue">
            <div className="dash-card-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <rect
                  x="3"
                  y="2"
                  width="16"
                  height="18"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M7 7h8M7 11h8M7 15h5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="dash-card-body">
              <p className="dash-card-value">{quotesSentTotal}</p>
              <p className="dash-card-label">Quotes Sent</p>
              <p className="dash-card-sub">
                {drafts.length} draft{drafts.length !== 1 ? "s" : ""} pending
              </p>
            </div>
          </div>

          {/* Total Revenue */}
          <div className="dash-card dash-card--green">
            <div className="dash-card-icon">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle
                  cx="11"
                  cy="11"
                  r="9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M11 6v1.5M11 14.5V16M8.5 13.5c0 1.1.9 2 2.5 2s2.5-.9 2.5-2-1-1.7-2.5-2-2.5-.9-2.5-2 .9-2 2.5-2 2.5.9 2.5 2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="dash-card-body">
              <p className="dash-card-value">
                {formatCurrency(allTimeRevenue, currency)}
              </p>
              <p className="dash-card-label">Total Revenue</p>
              <p className="dash-card-sub">all finalised quotes</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Activity feed ──────────────────────────────────────── */}
      {recentActivity.length > 0 && !showAllQuotations && (
        <div className="ra-wrap">
          <div className="ra-header">
            <h3 className="ra-title">Recent Activity</h3>
            <span className="ra-count">
              {recentActivity.length} of {quotes.length + drafts.length}
            </span>
          </div>
          <div className="ra-list">
            {recentActivity.map((q) => {
              const isDraft = q.status === "draft";
              const initials = q.customer.name
                .split(" ")
                .map((w: string) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <div key={q.id || q.quoteNumber} className="ra-row">
                  <div className="ra-avatar">{initials}</div>

                  <div className="ra-info">
                    <p className="ra-customer">{q.customer.name}</p>
                    <p className="ra-qnum">{q.quoteNumber || "Draft"}</p>
                  </div>

                  <div className="ra-amount">
                    <p className="ra-total">
                      {formatCurrency(q.total, q.currency)}
                    </p>
                    <p className="ra-date">{relativeTime(q.createdAt)}</p>
                  </div>

                  <span
                    className={`ra-badge ${isDraft ? "ra-badge--draft" : "ra-badge--final"}`}
                  >
                    {isDraft ? "Draft" : "Final"}
                  </span>

                  <button
                    className={`ra-view-btn${loadingQuoteId === q.id ? " ra-view-btn--loading" : ""}`}
                    onClick={() => handleViewQuote(q)}
                    disabled={loadingQuoteId === q.id}
                    title="View quote"
                  >
                    {loadingQuoteId === q.id ? (
                      <span className="ra-spinner" />
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                        <circle
                          cx="7.5"
                          cy="7.5"
                          r="4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
                        <path
                          d="M1 7.5C2.5 4 5 2 7.5 2s5 2 6.5 5.5C12.5 11 10 13 7.5 13S2.5 11 1 7.5z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    )}
                    {loadingQuoteId === q.id ? "Loading…" : "View"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showAllQuotations && (
        <div className="quotes-section">
          <button
            className="back-to-dashboard-btn"
            onClick={() => setShowAllQuotations(false)}
          >
            ← Back to Dashboard
          </button>
          <QuoteFilters onFiltersChange={handleFiltersChange} />

          <div className="quotes-header">
            <h3>
              Recent Quotations
              {filteredData.length !==
                (activeTab === "all"
                  ? quotes.length + drafts.length
                  : activeTab === "drafts"
                    ? drafts.length
                    : quotes.length) && (
                <span className="filtered-count">
                  {" "}
                  ({filteredData.length} filtered)
                </span>
              )}
            </h3>

            <div className="quotes-tabs">
              <button
                className="btn-add-square"
                onClick={() => navigate('/create-quote')}
              >
                + Add
              </button>
              <button
                className={`tab ${activeTab === "all" ? "active" : ""}`}
                onClick={() => handleTabChange("all")}
              >
                All ({quotes.length + drafts.length})
              </button>
              <button
                className={`tab ${activeTab === "drafts" ? "active" : ""}`}
                onClick={() => handleTabChange("drafts")}
              >
                Drafts ({drafts.length})
              </button>
              <button
                className={`tab ${activeTab === "finals" ? "active" : ""}`}
                onClick={() => handleTabChange("finals")}
              >
                Final ({quotes.length})
              </button>
            </div>
          </div>

          {/* Table Headers */}
          <div className="quotes-table-header">
            <div
              className="header-cell quote-date"
              onClick={() => handleSort("date")}
            >
              Date
              {getSortIcon("date")}
            </div>
            <div
              className="header-cell quote-number"
              onClick={() => handleSort("number")}
            >
              Quote #{getSortIcon("number")}
            </div>
            <div
              className="header-cell customer-name"
              onClick={() => handleSort("customer")}
            >
              Customer
              {getSortIcon("customer")}
            </div>
            <div
              className="header-cell quote-amount"
              onClick={() => handleSort("amount")}
            >
              Amount
              {getSortIcon("amount")}
            </div>
            <div className="header-cell quote-status">Status</div>
            <div className="header-cell quote-actions">Actions</div>
          </div>

          {filteredData.length > 0 ? (
            <>
              <div className="quotes-list">
                {paginatedData.map((quote: Quote | DraftQuote) => (
                  <QuoteCard
                    key={quote.id}
                    quote={quote}
                    isDraft={activeTab === "drafts"}
                    onView={handleViewQuote}
                    onEdit={handleEditQuote}
                    onDelete={handleDeleteQuote}
                    searchMatches={(quote as any).searchMatches}
                  />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    <span>
                      Showing {startIndex + 1}-
                      {Math.min(endIndex, filteredData.length)} of{" "}
                      {filteredData.length}
                    </span>
                    <div className="items-per-page">
                      <label htmlFor="itemsSelect">Items per page:</label>
                      <select
                        id="itemsSelect"
                        value={itemsPerPage}
                        onChange={handleItemsPerPageChange}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  <div className="pagination-controls">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                    >
                      Previous
                    </button>

                    <div className="page-numbers">
                      {Array.from(
                        { length: Math.min(totalPages, 7) },
                        (_, i) => {
                          let pageNum;
                          if (totalPages <= 7) {
                            pageNum = i + 1;
                          } else if (currentPage <= 4) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 3) {
                            pageNum = totalPages - 6 + i;
                          } else {
                            pageNum = currentPage - 3 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              className={`page-btn ${currentPage === pageNum ? "active" : ""}`}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        },
                      )}
                    </div>

                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <p>
                {filters.dateRange || filters.searchTerm
                  ? `No ${activeTab === "drafts" ? "draft " : activeTab === "finals" ? "final " : ""}quotations match your filters.`
                  : `No ${activeTab === "drafts" ? "draft " : activeTab === "finals" ? "final " : ""}quotations yet.`}
              </p>
            </div>
          )}
        </div>
      )}

      {previewQuote && (
        <QuotePreview
          quote={previewQuote}
          onClose={() => {
            setPreviewQuote(null);
            setIsViewingFinal(false);
          }}
          isFinal={isViewingFinal}
        />
      )}
    </div>
  );
};
