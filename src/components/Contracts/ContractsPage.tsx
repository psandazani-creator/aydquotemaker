// src/components/Contracts/ContractsPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { DraftContract, ContractAgreement } from '../../types/contract';
import { ContractForm } from './ContractForm';
import { ContractList } from './ContractList';
import { ContractView } from './ContractView';
import { ContractsPaywall } from './ContractsPaywall';
import { apiFetch } from '../../config/supabase';
import { showNotification } from '../Notification/Notification';
import './ContractsPage.css';

const PAGE_SIZE = 10;

export const ContractsPage: React.FC = () => {
    const { user, isOnline } = useApp();
    const [contracts, setContracts] = useState<(ContractAgreement | DraftContract)[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingContract, setEditingContract] = useState<ContractAgreement | DraftContract | null>(null);
    const [viewingContract, setViewingContract] = useState<ContractAgreement | DraftContract | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPaywall, setShowPaywall] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalContracts, setTotalContracts] = useState(0);

    const hasContractsLicense = user?.contractsLicense?.active === true;
    const totalPages = Math.ceil(totalContracts / PAGE_SIZE);

    useEffect(() => {
        if (!loading && !hasContractsLicense) {
            setShowPaywall(true);
        }
    }, [loading, hasContractsLicense]);

    const loadContracts = useCallback(async () => {
        setLoading(true);
        if (!user?.id) {
            setLoading(false);
            return;
        }

        try {
            const from = (currentPage - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;

            const res = await apiFetch(`/api/contracts?page=${currentPage}&limit=${PAGE_SIZE}`);
            if (!res.ok) throw new Error('Failed to load contracts');
            const payload = await res.json();

            setTotalContracts(payload.total || 0);

            const allContracts: any[] = [
                ...(payload.contracts || []),
                ...(payload.drafts || []).map((d: any) => ({ ...d, isDraft: true })),
            ];

            const deserialized = allContracts.map((c: any) => ({
                ...c,
                createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
                updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
                senderSignedAt: c.senderSignedAt ? new Date(c.senderSignedAt) : undefined,
                receiverSignedAt: c.receiverSignedAt ? new Date(c.receiverSignedAt) : undefined,
                syncedAt: c.syncedAt ? new Date(c.syncedAt) : undefined,
            }));

            setContracts(deserialized);
        } catch (error) {
            console.error('Error loading contracts:', error);
            setContracts([]);
        } finally {
            setLoading(false);
        }
    }, [user?.id, currentPage]);

    useEffect(() => {
        loadContracts();
    }, [loadContracts]);

    const handleCreateNew = () => {
        setEditingContract(null);
        setShowForm(true);
    };

    const handleView = (contract: ContractAgreement | DraftContract) => {
        setViewingContract(contract);
    };

    const handleEdit = (contract: ContractAgreement | DraftContract) => {
        setEditingContract(contract);
        setShowForm(true);
    };

    const handleSaveContract = (_contract: DraftContract) => {
        setCurrentPage(1);
        loadContracts();
        setShowForm(false);
        setEditingContract(null);
    };

    const handleDeleteContract = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this contract?')) {
            try {
                if (!user?.id) {
                    showNotification('User not authenticated', 'error');
                    return;
                }

                const delRes = await apiFetch(`/api/contracts/${id}`, { method: 'DELETE' });
                if (!delRes.ok) throw new Error('Delete failed');

                loadContracts();
            } catch (error) {
                console.error('Error deleting contract:', error);
                showNotification('Failed to delete contract. Please try again.', 'error');
            }
        }
    };

    if (loading) {
        return (
            <div className="contracts-page">
                <div className="contracts-header">
                    <div style={{ width: '200px', height: '34px', borderRadius: '6px', background: 'var(--border-light, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                    <div style={{ width: '130px', height: '44px', borderRadius: '8px', background: 'var(--border-light, #e2e8f0)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ height: '72px', borderRadius: '10px', background: 'var(--bg-card, #f8fafc)', border: '1px solid var(--border-light, #e2e8f0)', marginBottom: '10px', animation: 'pulse 1.5s ease-in-out infinite', animationDelay: `${i * 0.08}s` }} />
                ))}
            </div>
        );
    }

    if (showPaywall) {
        return <ContractsPaywall onClose={() => setShowPaywall(false)} />;
    }

    if (showForm) {
        return (
            <div className="contracts-page">
                <ContractForm
                    contract={editingContract}
                    onSave={handleSaveContract}
                    onClose={() => { setShowForm(false); setEditingContract(null); }}
                />
            </div>
        );
    }

    if (viewingContract) {
        return (
            <ContractView
                contract={viewingContract}
                onClose={() => setViewingContract(null)}
            />
        );
    }

    return (
        <div className="contracts-page">
            <div className="contracts-header">
                <h2>Contract Agreements</h2>
                <button className="btn-primary" onClick={handleCreateNew}>+ New Contract</button>
            </div>

            {contracts.length > 0 ? (
                <>
                    <ContractList
                        contracts={contracts}
                        onEdit={handleEdit}
                        onDelete={handleDeleteContract}
                        onView={handleView}
                    />

                    {totalPages > 1 && (
                        <div className="contracts-pagination">
                            <span className="pagination-info">
                                Page {currentPage} of {totalPages} &nbsp;·&nbsp; {totalContracts} total
                            </span>
                            <div className="pagination-controls">
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                >
                                    ← Prev
                                </button>
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                                    const pg = start + i;
                                    return pg <= totalPages ? (
                                        <button
                                            key={pg}
                                            className={`page-btn ${currentPage === pg ? 'active' : ''}`}
                                            onClick={() => setCurrentPage(pg)}
                                        >
                                            {pg}
                                        </button>
                                    ) : null;
                                })}
                                <button
                                    className="pagination-btn"
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="empty-state">
                    <p>No contracts yet. Create your first contract agreement!</p>
                    <button className="btn-primary" onClick={handleCreateNew}>Create Contract</button>
                </div>
            )}
        </div>
    );
};
