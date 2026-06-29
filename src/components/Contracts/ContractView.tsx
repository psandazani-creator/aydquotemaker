// src/components/Contracts/ContractView.tsx
import React from 'react';
import { ContractAgreement, DraftContract } from '../../types/contract';
import './ContractView.css';

interface ContractViewProps {
    contract: ContractAgreement | DraftContract;
    onClose: () => void;
}

export const ContractView: React.FC<ContractViewProps> = ({ contract, onClose }) => {
    console.log('ContractView contract data:', contract);
    console.log('Sender party:', contract.senderParty);
    console.log('Receiver party:', contract.receiverParty);

    const formatDate = (date?: Date | string) => {
        if (!date) return 'N/A';
        const d = new Date(date);
        return d.toLocaleDateString();
    };

    return (
        <div className="contract-view-overlay">
            <div className="contract-view-container">
                <div className="contract-view-header">
                    <h2>{contract.title}</h2>
                    <button className="btn-close" onClick={onClose}>✕</button>
                </div>

                <div className="contract-view-content">
                    {/* Date */}
                    <div className="view-section">
                        <p className="date-info">
                            <strong>Date:</strong> {formatDate(contract.createdAt)}
                        </p>
                    </div>

                    {/* Parties Section */}
                    <div className="view-section parties-section">
                        <div className="party-info">
                            <h3>FROM:</h3>
                            <div className="party-details">
                                <p><strong>{contract.senderParty.name || 'N/A'}</strong></p>
                                <p>{contract.senderParty.address || 'N/A'}</p>
                                <p>Phone: {contract.senderParty.phone || 'N/A'}</p>
                                <p>Email: {contract.senderParty.email || 'N/A'}</p>
                                {contract.senderParty.representativeName && (
                                    <p>Representative: {contract.senderParty.representativeName}</p>
                                )}
                            </div>
                        </div>

                        <div className="party-info">
                            <h3>TO:</h3>
                            <div className="party-details">
                                <p><strong>{contract.receiverParty.name || 'N/A'}</strong></p>
                                <p>{contract.receiverParty.address || 'N/A'}</p>
                                <p>Phone: {contract.receiverParty.phone || 'N/A'}</p>
                                <p>Email: {contract.receiverParty.email || 'N/A'}</p>
                                {contract.receiverParty.representativeName && (
                                    <p>Representative: {contract.receiverParty.representativeName}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Contract Content */}
                    <div className="view-section">
                        <h3>Contract Content</h3>
                        <div className="contract-content">
                            {contract.content ? (
                                <pre className="content-text">{contract.content}</pre>
                            ) : (
                                <p className="no-content">No contract content available</p>
                            )}
                        </div>
                    </div>

                    {/* Signatures Section */}
                    {(contract.senderSignature || contract.receiverSignature) && (
                        <div className="view-section signatures-section">
                            <h3>SIGNATURES:</h3>
                            <div className="signatures-container">
                                <div className="signature-info">
                                    <h4>FROM:</h4>
                                    {contract.senderSignature ? (
                                        <div className="signature-item">
                                            <img
                                                src={contract.senderSignature}
                                                alt="Sender Signature"
                                                className="signature-image"
                                            />
                                            <p className="signature-name">
                                                {contract.senderParty.representativeName || contract.senderParty.name}
                                            </p>
                                            {contract.senderSignedAt && (
                                                <p className="signature-date">
                                                    Signed: {formatDate(contract.senderSignedAt)}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="signature-placeholder">
                                            <div className="signature-line"></div>
                                            <p className="signature-name">
                                                {contract.senderParty.representativeName || contract.senderParty.name}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="signature-info">
                                    <h4>TO:</h4>
                                    {contract.receiverSignature ? (
                                        <div className="signature-item">
                                            <img
                                                src={contract.receiverSignature}
                                                alt="Receiver Signature"
                                                className="signature-image"
                                            />
                                            <p className="signature-name">
                                                {contract.receiverParty.representativeName || contract.receiverParty.name}
                                            </p>
                                            {contract.receiverSignedAt && (
                                                <p className="signature-date">
                                                    Signed: {formatDate(contract.receiverSignedAt)}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="signature-placeholder">
                                            <div className="signature-line"></div>
                                            <p className="signature-name">
                                                {contract.receiverParty.representativeName || contract.receiverParty.name}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
