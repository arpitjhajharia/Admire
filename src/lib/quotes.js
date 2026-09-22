import { db, dataDoc } from './firebase';
import { runTransaction } from 'firebase/firestore';
import { getFinancialYear, formatQuoteRef } from './utils';

/**
 * Atomicly gets the next quote sequence number and formats the reference.
 * Common for both LED Calc and CRM quotes.
 */
export const getNextQuoteRef = async () => {
    const fy = getFinancialYear();
    const countersRef = dataDoc('settings', 'counters');

    return await runTransaction(db, async (transaction) => {
        const doc = await transaction.get(countersRef);
        let nextSeq = 51; // Start at 051 as requested

        if (doc.exists()) {
            const data = doc.data();
            const quotes = data.quotes || {};
            // If sequence exists for CURRENT financial year, increment it.
            if (quotes[fy]) {
                nextSeq = quotes[fy] + 1;
            }
        }

        // Update the counter for the specific FY
        transaction.set(countersRef, {
            quotes: {
                [fy]: nextSeq
            }
        }, { merge: true });

        return formatQuoteRef(nextSeq, fy);
    });
};
