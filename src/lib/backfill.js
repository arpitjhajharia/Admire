import { db, appId } from './firebase';
import { getFinancialYear, formatQuoteRef } from './utils';

/**
 * Backfills quote references for all existing quotes.
 * Sorting is done by createdAt date.
 * Quotes linked across collections share the same reference.
 */
export const backfillQuoteRefs = async () => {
    console.log("Starting backfill...");
    
    // 1. Fetch all Global Quotes
    const globalQuotesSnap = await db.collection('artifacts').doc(appId).collection('public')
        .doc('data').collection('quotes').get();
    const globalQuotes = globalQuotesSnap.docs.map(d => ({ id: d.id, coll: 'global', ...d.data() }));

    // 2. Fetch all CRM Quotes (from all leads)
    const leadsSnap = await db.collection('artifacts').doc(appId).collection('public')
        .doc('data').collection('crm_leads').get();
    
    let crmQuotes = [];
    for (const leadDoc of leadsSnap.docs) {
        const qSnap = await leadDoc.ref.collection('quotes').get();
        crmQuotes.push(...qSnap.docs.map(d => ({ 
            id: d.id, 
            coll: 'crm', 
            leadId: leadDoc.id, 
            ...d.data() 
        })));
    }

    console.log(`Found ${globalQuotes.length} global and ${crmQuotes.length} CRM quotes.`);

    // 3. Group linked quotes
    // Key: globalQuoteId or global ID itself
    const groups = {};

    const addToGroup = (quote) => {
        let groupId = quote.id;
        if (quote.coll === 'crm' && quote.globalQuoteId) {
            groupId = quote.globalQuoteId;
        } else if (quote.coll === 'global' && quote.crmQuoteId) {
            // we'll use the global one as the primary ID
        }

        if (!groups[groupId]) {
            groups[groupId] = [];
        }
        groups[groupId].push(quote);
    };

    globalQuotes.forEach(addToGroup);
    crmQuotes.forEach(q => {
        // If it's a CRM quote with a globalQuoteId, it belongs to that global ID's group
        if (q.globalQuoteId) {
            if (!groups[q.globalQuoteId]) groups[q.globalQuoteId] = [];
            groups[q.globalQuoteId].push(q);
        } else {
            // Standalone CRM quote or one with no link yet
            addToGroup(q);
        }
    });

    // 4. Summarize groups (find earliest createdAt per group)
    const sortedGroups = Object.entries(groups).map(([groupId, members]) => {
        const earliestDate = members.reduce((min, q) => {
            const dateStr = q.createdAt || q.updatedAt || q.date;
            const date = dateStr?.toDate ? dateStr.toDate() : (dateStr ? new Date(dateStr) : new Date());
            return (!min || date < min) ? date : min;
        }, null);
        return { groupId, members, earliestDate };
    }).sort((a, b) => (a.earliestDate || 0) - (b.earliestDate || 0));


    // 5. Assign Refs per Financial Year
    const fyCounters = {};
    const updates = [];

    for (const group of sortedGroups) {
        const fy = getFinancialYear(group.earliestDate);
        if (!fyCounters[fy]) fyCounters[fy] = 51;
        
        const newRef = formatQuoteRef(fyCounters[fy], fy);
        fyCounters[fy]++;

        group.members.forEach(member => {
            const docRef = member.coll === 'global' 
                ? db.collection('artifacts').doc(appId).collection('public').doc('data').collection('quotes').doc(member.id)
                : db.collection('artifacts').doc(appId).collection('public').doc('data').collection('crm_leads').doc(member.leadId).collection('quotes').doc(member.id);
            
            const newData = { ref: newRef };
            // Also update internal state if it exists
            if (member.calculatorState) {
                newData.calculatorState = { ...member.calculatorState, ref: newRef };
            }
            if (member.items && Array.isArray(member.items) && member.coll === 'crm') {
               // actually crm quotes sometimes have items as allScreensData if generated from calculator
            }

            updates.push(docRef.update(newData));
        });
    }

    // 6. Execute updates
    console.log(`Executing ${updates.length} updates...`);
    await Promise.all(updates);

    // 7. Update global counters to the latest values
    const countersData = { quotes: {} };
    Object.keys(fyCounters).forEach(fy => {
        countersData.quotes[fy] = fyCounters[fy] - 1;
    });

    await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('settings').doc('counters').set(countersData, { merge: true });

    console.log("Backfill complete!");
    return fyCounters;
};
