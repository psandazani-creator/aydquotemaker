import React from 'react';
import './HelpPage.css';

export function HelpPage() {
    return (
        <div className="help-page">
            <h2>Help & Support</h2>

            <div className="help-section">
                <h3>How to Create a Quote</h3>
                <p>1. Click on "Create Quote" from the menu</p>
                <p>2. Fill in customer information</p>
                <p>3. Add line items with descriptions, quantities, and prices</p>
                <p>4. Review the total and apply VAT if needed</p>
                <p>5. Save as draft or generate final quote</p>
            </div>

            <div className="help-section">
                <h3>Quote Templates</h3>
                <p>Free tier includes 2 template. Upgrade to Pro or Business for more templates and customization options.</p>
            </div>
            //contracts informatiomn



            <div className="help-section">
                <h3>Contact Support</h3>
                <p>Email: support@aydquotemaker.com</p>
                <p>Phone: +263 771 926 832</p>
            </div>
        </div>
    );
}