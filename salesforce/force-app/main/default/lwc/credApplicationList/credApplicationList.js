import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import listAllApplications from '@salesforce/apex/CredProviderController.listAllApplications';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import credProvider360Header from '@salesforce/resourceUrl/credProvider360Header';

const COLUMNS = [
    {
        label: 'Application',
        fieldName: 'recordUrl',
        type: 'url',
        sortable: true,
        typeAttributes: { label: { fieldName: 'name' } }
    },
    {
        label: 'Provider',
        fieldName: 'providerUrl',
        type: 'url',
        sortable: true,
        typeAttributes: { label: { fieldName: 'providerName' } }
    },
    { label: 'Type', fieldName: 'applicationType', type: 'text', sortable: true },
    { label: 'Path', fieldName: 'pathValue', type: 'text', sortable: true },
    { label: 'Subject', fieldName: 'subjectType', type: 'text', sortable: true },
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

const STATUS_FILTERS = [
    { key: 'All', label: 'All' },
    { key: 'Draft', label: 'Draft' },
    { key: 'Intake', label: 'Intake' },
    { key: 'In_Review', label: 'In Review' },
    { key: 'Pending_Committee', label: 'Pending Committee' }
];

/** Map datatable sort field to the value used for comparison. */
const SORT_VALUE_FIELD = {
    recordUrl: 'name',
    providerUrl: 'providerName'
};

function sortRows(rows, fieldName, direction) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!fieldName) return list;
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
        // Dates come as ISO strings from Apex
        if (valueField === 'dueDate') {
            const at = Date.parse(av);
            const bt = Date.parse(bv);
            if (!Number.isNaN(at) && !Number.isNaN(bt)) {
                return (at - bt) * reverse;
            }
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

export default class CredApplicationList extends NavigationMixin(LightningElement) {
    @track statusFilter = 'All';
    @track searchTerm = '';
    @track draftSearch = '';
    columns = COLUMNS;
    themeStyleLoaded = false;
    sortedBy = 'name';
    sortedDirection = 'asc';

    @wire(listAllApplications, { statusFilter: '$statusFilter', searchTerm: '$searchTerm' })
    wiredApps;

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        Promise.all([
            loadStyle(this, credAppTheme),
            loadStyle(this, credProvider360Header)
        ]).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get applications() {
        const data = this.wiredApps?.data || [];
        const mapped = data.map((row) => ({
            ...row,
            recordUrl: '/' + row.id,
            providerUrl: row.providerId ? '/' + row.providerId : null
        }));
        return sortRows(mapped, this.sortedBy, this.sortedDirection);
    }

    get recordCountLabel() {
        const n = this.applications.length;
        return n === 1 ? '1 application' : `${n} applications`;
    }

    get isLoading() {
        return this.wiredApps?.data === undefined && !this.wiredApps?.error;
    }

    get errorMessage() {
        const err = this.wiredApps?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load applications.';
    }

    get filterButtons() {
        return STATUS_FILTERS.map((f) => ({
            ...f,
            className:
                'slds-button slds-m-right_xx-small ' +
                (this.statusFilter === f.key ? 'slds-button_brand' : 'slds-button_neutral')
        }));
    }

    handleFilter(event) {
        this.statusFilter = event.currentTarget.dataset.key;
    }

    handleSearchChange(event) {
        this.draftSearch = event.target.value;
    }

    handleSearchKeyup(event) {
        if (event.key === 'Enter') {
            this.handleSearch();
        }
    }

    handleSearch() {
        this.searchTerm = this.draftSearch || '';
    }

    handleSort(event) {
        this.sortedBy = event.detail.fieldName;
        this.sortedDirection = event.detail.sortDirection;
    }
}
