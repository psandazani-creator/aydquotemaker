// src/types/contract.ts

export interface ContractParty {
    name: string;
    address: string;
    phone: string;
    email: string;
    representativeName?: string;
}

export interface ContractAgreement {
    id: string;
    senderParty: ContractParty;
    receiverParty: ContractParty;
    title: string;
    content: string;
    senderSignature?: string; // Base64 encoded signature
    receiverSignature?: string; // Base64 encoded signature
    senderSignedAt?: Date;
    receiverSignedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    status: 'draft' | 'sent' | 'signed' | 'executed';
    isOffline?: boolean;
    syncedAt?: Date;
}

export interface DraftContract extends Omit<ContractAgreement, 'id' | 'createdAt'> {
    id?: string;
    createdAt?: Date;
    isOffline: boolean;
}
