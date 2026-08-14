import { LightningElement, api, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import listCredentials from '@salesforce/apex/CredProviderController.listCredentials';

const COLUMNS = [
    { label: 'Type', fieldName: 'credentialType', type: 'text', sortable: true },
    { label: 'Number', fieldName: 'credentialNumber', type: 'text', sortable: true },
    { label: 'Issuer', fieldName: 'issuingAuthority', type: 'text', sortable: true },
    {
        label: 'Expires',
        fieldName: 'expirationDate',
        type: 'date-local',
        sortable: true,
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    },
    { label: 'Status', fieldName: 'status', type: 'text', sortable: true }
];

function sortRows(rows, fieldName, direction) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!fieldName) {
        return list;
    }
    const reverse = direction === 'desc' ? -1 : 1;
    list.sort((a, b) => {
        const av = a?.[fieldName];
        const bv = b?.[fieldName];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
            return (av - bv) * reverse;
        }
        if (typeof av === 'boolean' && typeof bv === 'boolean') {
            return ((av === bv ? 0 : av ? 1 : -1) * reverse);
        }
        return (
            String(av).localeCompare(String(bv), undefined, {
                numeric: true,
                sensitivity: 'base'
            }) * reverse
        );
    });
    return list;
}

export default class CredCredentialsPanel extends LightningElement {
    themeStyleLoaded = false;
    sortedBy = 'expirationDate';
    sortedDirection = 'asc';

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    @api recordId;
    columns = COLUMNS;

    @wire(listCredentials, { providerId: '$recordId' })
    wiredCredentials;

    get credentials() {
        return sortRows(
            this.wiredCredentials?.data,
            this.sortedBy,
            this.sortedDirection
        );
    }

    get isLoading() {
        return this.wiredCredentials?.data === undefined && !this.wiredCredentials?.error;
    }

    get errorMessage() {
        const err = this.wiredCredentials?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load credentials.';
    }

    get isEmpty() {
        return (
            !this.isLoading &&
            !this.errorMessage &&
            !(this.wiredCredentials?.data || []).length
        );
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
    }
}
