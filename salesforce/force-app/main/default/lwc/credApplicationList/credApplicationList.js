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
        typeAttributes: { label: { fieldName: 'name' } }
    },
    {
        label: 'Provider',
        fieldName: 'providerUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'providerName' } }
    },
    { label: 'Type', fieldName: 'applicationType', type: 'text' },
    { label: 'Path', fieldName: 'pathValue', type: 'text' },
    { label: 'Subject', fieldName: 'subjectType', type: 'text' },
    { label: 'Status', fieldName: 'status', type: 'text' },
    { label: 'Attempts', fieldName: 'attemptCount', type: 'number' },
    {
        label: 'Due',
        fieldName: 'dueDate',
        type: 'date-local',
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

export default class CredApplicationList extends NavigationMixin(LightningElement) {
    @track statusFilter = 'All';
    @track searchTerm = '';
    @track draftSearch = '';
    columns = COLUMNS;
    themeStyleLoaded = false;

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
        return data.map((row) => ({
            ...row,
            recordUrl: '/' + row.id,
            providerUrl: row.providerId ? '/' + row.providerId : null
        }));
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
}
