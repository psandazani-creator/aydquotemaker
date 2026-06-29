// src/components/Contracts/ContractForm.tsx
import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { ContractAgreement, DraftContract } from '../../types/contract';
import { generatePDF } from '../../utils/contractPdfGenerator';
import { apiFetch } from '../../config/supabase';
import { showNotification } from '../Notification/Notification';
import { saveDraftToStorage, loadDraftFromStorage, clearDraftFromStorage } from '../../utils/draftStorage';
import './ContractForm.css';

interface ContractFormProps {
    contract?: ContractAgreement | DraftContract | null;
    onSave?: (contract: DraftContract) => void;
    onClose?: () => void;
}

export const ContractForm: React.FC<ContractFormProps> = ({ contract, onSave, onClose }) => {
    const { user, isOnline } = useApp();
    const [formData, setFormData] = useState<DraftContract>(
        contract || {
            id: undefined,
            senderParty: {
                name: user?.companyName || '',
                address: user?.companyAddress || '',
                phone: user?.companyPhone || '',
                email: user?.email || '',
            },
            receiverParty: {
                name: '',
                address: '',
                phone: '',
                email: '',
            },
            title: 'Contract Agreement',
            content: '',
            status: 'draft',
            isOffline: !isOnline,
            createdAt: new Date(),
        }
    );

    const DRAFT_KEY = !contract && user?.id ? `contractform_${user.id}` : null;
    const draftSaveTimer = useRef<ReturnType<typeof setTimeout>>();

    const [activeTab, setActiveTab] = useState<'details' | 'sign'>('details');
    const senderCanvasRef = useRef<HTMLCanvasElement>(null);
    const receiverCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawingSender, setIsDrawingSender] = useState(false);
    const [isDrawingReceiver, setIsDrawingReceiver] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    // Initialize contract ID on mount (prevent duplicate creation)
    useEffect(() => {
        if (!formData.id) {
            setFormData((prev) => ({
                ...prev,
                id: `contract-${Date.now()}`,
            }));
        }
    }, []);

    // Restore unsaved contract draft from localStorage on mount (new contracts only)
    useEffect(() => {
        if (!DRAFT_KEY) return;
        const saved = loadDraftFromStorage<Partial<DraftContract>>(DRAFT_KEY);
        if (!saved) return;
        // Restore text fields only — skip canvas signatures
        const { senderSignature, receiverSignature, ...textFields } = saved as any;
        setFormData(prev => ({
            ...prev,
            ...textFields,
            createdAt: textFields.createdAt ? new Date(textFields.createdAt) : prev.createdAt,
        }));
        showNotification('Contract draft restored from your last session', 'info');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-save contract draft (debounced 600ms, skip large signature data)
    useEffect(() => {
        if (!DRAFT_KEY) return;
        clearTimeout(draftSaveTimer.current);
        draftSaveTimer.current = setTimeout(() => {
            const { senderSignature, receiverSignature, ...persistable } = formData as any;
            saveDraftToStorage(DRAFT_KEY, persistable);
        }, 600);
        return () => clearTimeout(draftSaveTimer.current);
    }, [formData]);

    const handleInputChange = (
        field: keyof DraftContract,
        value: any,
        parentField?: keyof ContractAgreement
    ) => {
        if (parentField) {
            setFormData({
                ...formData,
                [parentField]: {
                    ...(formData[parentField] as any),
                    [field]: value,
                },
            });
        } else {
            setFormData({
                ...formData,
                [field]: value,
            });
        }
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>, isReceiver: boolean) => {
        const canvas = isReceiver ? receiverCanvasRef.current : senderCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
        isReceiver ? setIsDrawingReceiver(true) : setIsDrawingSender(true);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>, isReceiver: boolean) => {
        if (isReceiver && !isDrawingReceiver) return;
        if (!isReceiver && !isDrawingSender) return;
        const canvas = isReceiver ? receiverCanvasRef.current : senderCanvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        ctx.stroke();
    };

    const stopDrawing = () => {
        setIsDrawingSender(false);
        setIsDrawingReceiver(false);
    };

    const clearSignature = (isReceiver: boolean) => {
        const canvas = isReceiver ? receiverCanvasRef.current : senderCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (isReceiver) {
            setFormData({ ...formData, receiverSignature: undefined });
        } else {
            setFormData({ ...formData, senderSignature: undefined });
        }
    };

    const captureSignature = (isReceiver: boolean) => {
        const canvas = isReceiver ? receiverCanvasRef.current : senderCanvasRef.current;
        if (!canvas) return;
        const signature = canvas.toDataURL('image/png');
        if (isReceiver) {
            setFormData({ ...formData, receiverSignature: signature, receiverSignedAt: new Date() });
        } else {
            setFormData({ ...formData, senderSignature: signature, senderSignedAt: new Date() });
        }
    };

    // Auto-save to Supabase (online) or offline drafts
    useEffect(() => {
        const saveToStorage = async () => {
            try {
                const contractId = formData.id || `contract-${Date.now()}`;
                const userId = user?.id;
                if (!userId) return;

                const serializedContract: any = {
                    ...formData,
                    id: contractId,
                    userId,
                    status: formData.status || 'draft',
                    createdAt: formData.createdAt ? new Date(formData.createdAt).toISOString() : new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    syncedAt: isOnline ? new Date().toISOString() : undefined,
                    isOffline: !isOnline,
                    senderSignedAt: formData.senderSignedAt ? new Date(formData.senderSignedAt).toISOString() : undefined,
                    receiverSignedAt: formData.receiverSignedAt ? new Date(formData.receiverSignedAt).toISOString() : undefined,
                };

                const saveRes = await apiFetch('/api/contracts', {
                    method: 'POST',
                    body: JSON.stringify({ ...serializedContract, status: isOnline ? (serializedContract.status || 'draft') : 'draft' }),
                });
                if (!saveRes.ok) throw new Error('Failed to save contract');

                setSaveStatus('saved');
                setTimeout(() => setSaveStatus('idle'), 2000);
            } catch (error) {
                console.error('Error saving contract:', error);
                setSaveStatus('idle');
            }
        };

        const timer = setTimeout(saveToStorage, 1000);
        return () => clearTimeout(timer);
    }, [formData, isOnline, user?.id]);

    const handleSave = async () => {
        setSaveStatus('saving');
        try {
            const contractId = formData.id || `contract-${Date.now()}`;
            const userId = user?.id;
            if (!userId) throw new Error('User not authenticated');

            const serializedContract = {
                ...formData,
                id: contractId,
                userId,
                status: isOnline && formData.status === 'draft' ? 'sent' : formData.status,
                createdAt: formData.createdAt ? new Date(formData.createdAt).toISOString() : new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                senderSignedAt: formData.senderSignedAt ? new Date(formData.senderSignedAt).toISOString() : undefined,
                receiverSignedAt: formData.receiverSignedAt ? new Date(formData.receiverSignedAt).toISOString() : undefined,
                syncedAt: isOnline ? new Date().toISOString() : undefined,
                isOffline: !isOnline,
            };

            const saveRes = await apiFetch('/api/contracts', {
                method: 'POST',
                body: JSON.stringify(serializedContract),
            });
            if (!saveRes.ok) throw new Error('Failed to save contract');

            if (DRAFT_KEY) clearDraftFromStorage(DRAFT_KEY);
            setSaveStatus('saved');
            if (onSave) onSave(serializedContract as DraftContract);
            setTimeout(() => setSaveStatus('idle'), 2000);
        } catch (error) {
            console.error('Error saving contract:', error);
            showNotification('Failed to save contract. Please try again.', 'error');
            setSaveStatus('idle');
        }
    };

    const handleDownloadPDF = async () => {
        try {
            await generatePDF(formData as any);
        } catch (error) {
            console.error('Error generating PDF:', error);
            showNotification('Failed to generate PDF', 'error');
        }
    };

    return (
        <div className="contract-form-container">
            <div className="contract-form-header">
                <h2>Contract Agreement</h2>
                <div className="contract-header-actions">
                    <span className={`sync-status ${saveStatus}`}>
                        {saveStatus === 'saved' && '✓ Saved'}
                        {saveStatus === 'saving' && '⟳ Saving...'}
                    </span>
                    <span className={`online-status ${isOnline ? 'online' : 'offline'}`}>
                        {isOnline ? '● Online' : '● Offline'}
                    </span>
                </div>
            </div>

            <div className="contract-tabs">
                <button
                    className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`}
                    onClick={() => setActiveTab('details')}
                >
                    Contract Details
                </button>
                <button
                    className={`tab-btn ${activeTab === 'sign' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sign')}
                >
                    Sign Agreement
                </button>
            </div>

            {activeTab === 'details' && (
                <div className="contract-details-section">
                    <div className="form-group">
                        <label htmlFor="title">Contract Title</label>
                        <input
                            id="title"
                            type="text"
                            value={formData.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="e.g., Contract Agreement, Confidentiality Agreement"
                        />
                    </div>

                    <div className="two-column-layout">
                        <div className="party-section">
                            <h3>Your Company Details</h3>
                            <div className="form-group">
                                <label htmlFor="senderName">Company Name</label>
                                <input id="senderName" type="text" value={formData.senderParty.name}
                                    onChange={(e) => handleInputChange('name', e.target.value, 'senderParty')}
                                    placeholder="Your company name" readOnly={!!user?.companyName} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="senderAddress">Address</label>
                                <input id="senderAddress" type="text" value={formData.senderParty.address}
                                    onChange={(e) => handleInputChange('address', e.target.value, 'senderParty')}
                                    placeholder="Company address" readOnly={!!user?.companyAddress} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="senderPhone">Phone</label>
                                <input id="senderPhone" type="tel" value={formData.senderParty.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value, 'senderParty')}
                                    placeholder="Phone number" readOnly={!!user?.companyPhone} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="senderEmail">Email</label>
                                <input id="senderEmail" type="email" value={formData.senderParty.email}
                                    onChange={(e) => handleInputChange('email', e.target.value, 'senderParty')}
                                    placeholder="Email address" readOnly={!!user?.email} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="senderRep">Representative Name</label>
                                <input id="senderRep" type="text"
                                    value={formData.senderParty.representativeName || ''}
                                    onChange={(e) => handleInputChange('representativeName', e.target.value, 'senderParty')}
                                    placeholder="Name of authorized representative" />
                            </div>
                        </div>

                        <div className="party-section">
                            <h3>Receiver Company Details</h3>
                            <div className="form-group">
                                <label htmlFor="receiverName">Company Name *</label>
                                <input id="receiverName" type="text" value={formData.receiverParty.name}
                                    onChange={(e) => handleInputChange('name', e.target.value, 'receiverParty')}
                                    placeholder="Receiver company name" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="receiverAddress">Address *</label>
                                <input id="receiverAddress" type="text" value={formData.receiverParty.address}
                                    onChange={(e) => handleInputChange('address', e.target.value, 'receiverParty')}
                                    placeholder="Receiver address" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="receiverPhone">Phone *</label>
                                <input id="receiverPhone" type="tel" value={formData.receiverParty.phone}
                                    onChange={(e) => handleInputChange('phone', e.target.value, 'receiverParty')}
                                    placeholder="Phone number" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="receiverEmail">Email *</label>
                                <input id="receiverEmail" type="email" value={formData.receiverParty.email}
                                    onChange={(e) => handleInputChange('email', e.target.value, 'receiverParty')}
                                    placeholder="Email address" required />
                            </div>
                            <div className="form-group">
                                <label htmlFor="receiverRep">Representative Name</label>
                                <input id="receiverRep" type="text"
                                    value={formData.receiverParty.representativeName || ''}
                                    onChange={(e) => handleInputChange('representativeName', e.target.value, 'receiverParty')}
                                    placeholder="Name of authorized representative" />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="content">Contract Content</label>
                        <textarea id="content" value={formData.content}
                            onChange={(e) => handleInputChange('content', e.target.value)}
                            placeholder="Type or paste your contract terms and conditions here..."
                            rows={12} className="contract-textarea" />
                    </div>
                </div>
            )}

            {activeTab === 'sign' && (
                <div className="contract-sign-section">
                    <div className="sign-container">
                        <div className="signature-box">
                            <h3>Your Signature</h3>
                            <p className="signature-label">{formData.senderParty.representativeName || formData.senderParty.name}</p>
                            <div className="canvas-wrapper">
                                <canvas ref={senderCanvasRef} width={300} height={150}
                                    onMouseDown={(e) => startDrawing(e, false)}
                                    onMouseMove={(e) => draw(e, false)}
                                    onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                                    className="signature-canvas" />
                            </div>
                            <div className="signature-actions">
                                <button type="button" onClick={() => clearSignature(false)} className="btn-secondary">Clear</button>
                                <button type="button" onClick={() => captureSignature(false)} className="btn-primary">Confirm Signature</button>
                            </div>
                            {formData.senderSignedAt && (
                                <p className="signed-date">Signed on {new Date(formData.senderSignedAt).toLocaleDateString()}</p>
                            )}
                        </div>

                        <div className="signature-box">
                            <h3>Receiver Signature</h3>
                            <p className="signature-label">{formData.receiverParty.representativeName || formData.receiverParty.name}</p>
                            <div className="canvas-wrapper">
                                <canvas ref={receiverCanvasRef} width={300} height={150}
                                    onMouseDown={(e) => startDrawing(e, true)}
                                    onMouseMove={(e) => draw(e, true)}
                                    onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                                    className="signature-canvas" />
                            </div>
                            <div className="signature-actions">
                                <button type="button" onClick={() => clearSignature(true)} className="btn-secondary">Clear</button>
                                <button type="button" onClick={() => captureSignature(true)} className="btn-primary">Confirm Signature</button>
                            </div>
                            {formData.receiverSignedAt && (
                                <p className="signed-date">Signed on {new Date(formData.receiverSignedAt).toLocaleDateString()}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="contract-form-actions">
                <button type="button" onClick={handleSave} className="btn-primary"
                    disabled={saveStatus === 'saving'}>
                    {saveStatus === 'saving' ? 'Saving...' : 'Save Contract'}
                </button>
                <button type="button" onClick={handleDownloadPDF} className="btn-secondary">
                    Download PDF
                </button>
                {onClose && (
                    <button type="button" onClick={onClose} className="btn-secondary">Close</button>
                )}
            </div>
        </div>
    );
};
