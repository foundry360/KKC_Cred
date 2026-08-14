import { LightningElement, api, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import listWorkHistory from '@salesforce/apex/CredProviderController.listWorkHistory';

const COLUMNS = [
    { label: 'Employer', fieldName: 'employerName', type: 'text', sortable: true },
    { label: 'Title', fieldName: 'title', type: 'text', sortable: true },
    { label: 'Department', fieldName: 'department', type: 'text', sortable: true },
    {
        label: 'Start',
        fieldName: 'startDate',
        type: 'date-local',
        sortable: true,
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    },
    {
        label: 'End',
        fieldName: 'endDate',
        type: 'date-local',
        sortable: true,
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    },
    { label: 'Current', fieldName: 'isCurrent', type: 'boolean', sortable: true },
    { label: 'Location', fieldName: 'location', type: 'text', sortable: true }
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

export default class CredWorkHistoryPanel extends LightningElement {
    themeStyleLoaded = false;
    sortedBy = 'startDate';
    sortedDirection = 'desc';

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

    @wire(listWorkHistory, { providerId: '$recordId' })
    wiredWork;

    get rows() {
        return sortRows(this.wiredWork?.data, this.sortedBy, this.sortedDirection);
    }

    get isLoading() {
        return this.wiredWork?.data === undefined && !this.wiredWork?.error;
    }

    get errorMessage() {
        const err = this.wiredWork?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load work history.';
    }

    get isEmpty() {
        return (
            !this.isLoading &&
            !this.errorMessage &&
            !(this.wiredWork?.data || []).length
        );
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
    }
}
