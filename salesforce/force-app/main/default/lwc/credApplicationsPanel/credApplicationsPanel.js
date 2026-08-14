import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import listApplications from '@salesforce/apex/CredProviderController.listApplications';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

const COLUMNS = [
    {
        label: 'Application',
        fieldName: 'recordUrl',
        type: 'url',
        sortable: true,
        typeAttributes: { label: { fieldName: 'name' } }
    },
    { label: 'Type', fieldName: 'applicationType', type: 'text', sortable: true },
    { label: 'Path', fieldName: 'pathValue', type: 'text', sortable: true },
    { label: 'Status', fieldName: 'status', type: 'text', sortable: true },
    { label: 'Attempts', fieldName: 'attemptCount', type: 'number', sortable: true },
    {
        label: 'Due',
        fieldName: 'dueDate',
        type: 'date-local',
        sortable: true,
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    }
];

const SORT_VALUE_FIELD = {
    recordUrl: 'name'
};

function sortRows(rows, fieldName, direction) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!fieldName) {
        return list;
    }
    const valueField = SORT_VALUE_FIELD[fieldName] || fieldName;
    const reverse = direction === 'desc' ? -1 : 1;
    list.sort((a, b) => {
        const av = a?.[valueField];
        const bv = b?.[valueField];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
            return (av - bv) * reverse;
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

export default class CredApplicationsPanel extends NavigationMixin(LightningElement) {
    @api recordId;
    columns = COLUMNS;
    themeStyleLoaded = false;
    sortedBy = 'dueDate';
    sortedDirection = 'asc';

    @wire(listApplications, { providerId: '$recordId' })
    wiredApplications;

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get applications() {
        const data = (this.wiredApplications?.data || []).map((row) => ({
            ...row,
            recordUrl: '/' + row.id
        }));
        return sortRows(data, this.sortedBy, this.sortedDirection);
    }

    get isLoading() {
        return this.wiredApplications?.data === undefined && !this.wiredApplications?.error;
    }

    get errorMessage() {
        const err = this.wiredApplications?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load applications.';
    }

    get isEmpty() {
        return (
            !this.isLoading &&
            !this.errorMessage &&
            !(this.wiredApplications?.data || []).length
        );
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
    }
}
