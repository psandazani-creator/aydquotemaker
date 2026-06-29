// src/utils/contractPdfGenerator.ts
import jsPDF from 'jspdf';
import { ContractAgreement, DraftContract } from '../types/contract';

export const generatePDF = async (contract: ContractAgreement | DraftContract) => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const contentWidth = pageWidth - 2 * margin;
        let yPosition = margin;

        // Title
        doc.setFontSize(20);
        doc.setTextColor(0, 0, 0); // Gold color
        doc.text(contract.title, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += 15;

        // Divider line
        doc.setDrawColor(0, 0, 0);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        // Date only
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        const createdDate = new Date(contract.createdAt || new Date());
        doc.text(
            `Date: ${createdDate.toLocaleDateString()}`,
            margin,
            yPosition
        );
        yPosition += 8;

        // Side-by-side party sections
        const columnWidth = contentWidth / 2;
        const leftColumnX = margin;
        const rightColumnX = margin + columnWidth + 10;
        const startY = yPosition;

        // Sender Party Section (Left Column)
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('FROM:', leftColumnX, startY);
        let senderY = startY + 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const senderLines = [
            contract.senderParty.name,
            contract.senderParty.address,
            `Phone: ${contract.senderParty.phone}`,
            `Email: ${contract.senderParty.email}`,
        ];
        if (contract.senderParty.representativeName) {
            senderLines.push(`Representative: ${contract.senderParty.representativeName}`);
        }

        senderLines.forEach((line) => {
            doc.text(line, leftColumnX + 5, senderY);
            senderY += 6;
        });

        // Receiver Party Section (Right Column)
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('TO:', rightColumnX, startY);
        let receiverY = startY + 7;

        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        const receiverLines = [
            contract.receiverParty.name,
            contract.receiverParty.address,
            `Phone: ${contract.receiverParty.phone}`,
            `Email: ${contract.receiverParty.email}`,
        ];
        if (contract.receiverParty.representativeName) {
            receiverLines.push(`Representative: ${contract.receiverParty.representativeName}`);
        }

        receiverLines.forEach((line) => {
            doc.text(line, rightColumnX + 5, receiverY);
            receiverY += 6;
        });

        // Set yPosition to the height of the taller column
        yPosition = Math.max(senderY, receiverY) + 10;

        // Contract Content
        if (contract.content) {
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);

            // Split content into multiple lines
            const splitContent = doc.splitTextToSize(contract.content, contentWidth);

            splitContent.forEach((line: string) => {
                if (yPosition > pageHeight - 40) {
                    doc.addPage();
                    yPosition = margin;
                }
                doc.text(line, margin, yPosition);
                yPosition += 5;
            });
        }

        yPosition += 10;

        // Signatures Section - Always show signature lines
        if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = margin;
        }

        // Divider before signatures
        doc.setDrawColor(0, 0, 0);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 10;

        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text('SIGNATURES:', margin, yPosition);
        yPosition += 10;

        // // Side-by-side signature layout
        // const columnWidth = contentWidth / 2;
        // const leftColumnX = margin;
        // const rightColumnX = margin + columnWidth + 10;
        const signatureStartY = yPosition;

        // Sender Signature (Left Column)
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        // doc.text('FROM:', leftColumnX, signatureStartY);

        // Signature line (always shown)
        doc.setDrawColor(100, 100, 100);
        doc.line(leftColumnX, signatureStartY + 25, leftColumnX + 80, signatureStartY + 25);

        // Add signature image only if it exists
        if (contract.senderSignature) {
            doc.addImage(contract.senderSignature, 'PNG', leftColumnX, signatureStartY + 8, 60, 20);
        }

        // Name and date below the line
        doc.setFontSize(9);
        doc.text(contract.senderParty.representativeName || contract.senderParty.name, leftColumnX, signatureStartY + 30);
        doc.setTextColor(150, 150, 150);
        if (contract.senderSignedAt) {
            doc.text(`Signed: ${new Date(contract.senderSignedAt).toLocaleDateString()}`, leftColumnX, signatureStartY + 37);
        }

        // Receiver Signature (Right Column)
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        // doc.text('TO:', rightColumnX, signatureStartY);

        // Signature line (always shown)
        doc.setDrawColor(100, 100, 100);
        doc.line(rightColumnX, signatureStartY + 25, rightColumnX + 80, signatureStartY + 25);

        // Add signature image only if it exists
        if (contract.receiverSignature) {
            doc.addImage(contract.receiverSignature, 'PNG', rightColumnX, signatureStartY + 8, 60, 20);
        }

        // Name and date below the line
        doc.setFontSize(9);
        doc.text(contract.receiverParty.representativeName || contract.receiverParty.name, rightColumnX, signatureStartY + 30);
        doc.setTextColor(150, 150, 150);
        if (contract.receiverSignedAt) {
            doc.text(`Signed: ${new Date(contract.receiverSignedAt).toLocaleDateString()}`, rightColumnX, signatureStartY + 37);
        }

        yPosition = signatureStartY + 50;

        // Save the PDF
        const fileName = `${contract.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
        doc.save(fileName);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
};
