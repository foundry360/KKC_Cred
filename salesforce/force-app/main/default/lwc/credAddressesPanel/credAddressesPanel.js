import { LightningElement, api, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import listAddresses from '@salesforce/apex/CredProviderController.listAddresses';

const COLUMNS = [
    { label: 'Type', fieldName: 'addressType', type: 'text', sortable: true },
    { label: 'Street', fieldName: 'line1', type: 'text', sortable: true },
    { label: 'Line 2', fieldName: 'line2', type: 'text', sortable: true },
    { label: 'City', fieldName: 'city', type: 'text', sortable: true },
    { label: 'State', fieldName: 'stateCode', type: 'text', sortable: true },
    { label: 'Postal', fieldName: 'postalCode', type: 'text', sortable: true },
    { label: 'Country', fieldName: 'country', type: 'text', sortable: true },
    { label: 'Primary', fieldName: 'isPrimary', type: 'boolean', sortable: true }
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
            return (av === bv ? 0 : av ? 1 : -1) * reverse;
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

export default class CredAddressesPanel extends LightningElement {
    themeStyleLoaded = false;
    sortedBy = 'addressType';
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

    @wire(listAddresses, { providerId: '$recordId' })
    wiredAddresses;

    get rows() {
        return sortRows(this.wiredAddresses?.data, this.sortedBy, this.sortedDirection);
    }

    get isLoading() {
        return this.wiredAddresses?.data === undefined && !this.wiredAddresses?.error;
    }

    get errorMessage() {
        const err = this.wiredAddresses?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load addresses.';
    }

    get isEmpty() {
        return (
            !this.isLoading &&
            !this.errorMessage &&
            !(this.wiredAddresses?.data || []).length
        );
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
    }
}
