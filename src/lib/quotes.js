import { db, appId } from './firebase';
import { getFinancialYear, formatQuoteRef } from './utils';

/**
 * Atomicly gets the next quote sequence number and formats the reference.
 * Common for both LED Calc and CRM quotes.
 */
export const getNextQuoteRef = async () => {
    const fy = getFinancialYear();
    const countersRef = db.collection('artifacts').doc(appId).collection('public')
        .doc('data').collection('settings').doc('counters');

    return await db.runTransaction(async (transaction) => {
        const doc = await transaction.get(countersRef);
        let nextSeq = 51; // Start at 051 as requested

        if (doc.exists) {
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
