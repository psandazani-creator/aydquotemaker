// src/components/Contracts/ContractList.tsx
import React from 'react';
import { DraftContract, ContractAgreement } from '../../types/contract';
import './ContractList.css';

interface ContractListProps {
    contracts: (ContractAgreement | DraftContract)[];
    onEdit: (contract: ContractAgreement | DraftContract) => void;
    onDelete: (id: string) => void;
    onView: (contract: ContractAgreement | DraftContract) => void;
}

export const ContractList: React.FC<ContractListProps> = ({ contracts, onEdit, onDelete, onView }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft':
                return 'draft';
            case 'sent':
                return 'sent';
            case 'signed':
                return 'signed';
            case 'executed':
                return 'executed';
            default:
                return 'draft';
        }
    };

    return (
        <div className="contract-list">
            <div className="contract-table-header">
                <div className="col-title">Contract Title</div>
                <div className="col-receiver">Receiver</div>
                <div className="col-date">Created</div>
                <div className="col-status">Status</div>
                <div className="col-actions">Actions</div>
            </div>

            {contracts.map((contract) => (
                <div key={contract.id} className="contract-row">
                    <div className="col-title">
                        <h4>{contract.title}</h4>
                        <p className="sync-info">
                            {(contract as any).isOffline ? '📱 Offline' : '☁️ Synced'}
                        </p>
                    </div>
                    <div className="col-receiver">
                        <p>{contract.receiverParty.name}</p>
                        <p className="email">{contract.receiverParty.email}</p>
                    </div>
                    <div className="col-date">
                        {contract.createdAt
                            ? new Date(contract.createdAt).toLocaleDateString()
                            : 'N/A'}
                    </div>
                    <div className="col-status">
                        <span className={`status-badge ${getStatusColor(contract.status)}`}>
                            {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                        </span>
                    </div>
                    <div className="col-actions">
                        <button
                            className="action-btn view"
                            onClick={() => onView(contract)}
                            title="View"
                        >
                            👁 View
                        </button>
                        <button
                            className="action-btn edit"
                            onClick={() => onEdit(contract)}
                            title="Edit"
                        >
                            ✎ Edit
                        </button>
                        <button
                            className="action-btn delete"
                            onClick={() => onDelete(contract.id!)}
                            title="Delete"
                        >
                            🗑 Delete
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};
