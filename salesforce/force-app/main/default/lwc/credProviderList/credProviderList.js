import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import { loadStyle } from 'lightning/platformResourceLoader';
import listProviders from '@salesforce/apex/CredProviderController.listProviders';
import deleteProvider from '@salesforce/apex/CredProviderController.deleteProvider';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import credProvider360Header from '@salesforce/resourceUrl/credProvider360Header';

const ACTIONS = [
    { label: 'Open', name: 'open' },
    { label: 'Delete', name: 'delete' }
];

const COLUMNS = [
    {
        label: 'Name',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: {
            label: { fieldName: 'name' },
            tooltip: { fieldName: 'detailLabel' }
        },
        sortable: true
    },
    { label: 'Type', fieldName: 'subjectType', type: 'text', sortable: true },
    { label: 'External Id', fieldName: 'externalId', type: 'text', sortable: true },
    { label: 'NPI', fieldName: 'npi', type: 'text', sortable: true },
    { label: 'Organization', fieldName: 'organizationName', type: 'text', sortable: true },
    { label: 'Detail', fieldName: 'detailLabel', type: 'text', sortable: true },
    { label: 'Status', fieldName: 'status', type: 'text', sortable: true },
    {
        label: 'Recred due',
        fieldName: 'recredDueDate',
        type: 'date-local',
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' },
        sortable: true
    },
    {
        type: 'action',
        typeAttributes: { rowActions: ACTIONS }
    }
];

export default class CredProviderList extends NavigationMixin(LightningElement) {
    @track subjectType = 'All';
    @track searchTerm = '';
    @track draftSearch = '';
    @track sortedBy = 'name';
    @track sortedDirection = 'asc';
    columns = COLUMNS;
    themeStyleLoaded = false;
    wiredProviders;
    deleting = false;

    @wire(listProviders, { subjectType: '$subjectType', searchTerm: '$searchTerm' })
    wiredProvidersHandler(result) {
        this.wiredProviders = result;
    }

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

    get providers() {
        const data = this.wiredProviders?.data || [];
        const rows = data.map((row) => ({
            ...row,
            recordUrl: '/' + row.id
        }));
        return this.sortData(rows, this.sortedBy, this.sortedDirection);
    }

    get recordCountLabel() {
        const n = this.providers.length;
        return `${n} record${n === 1 ? '' : 's'}`;
    }

    get isLoading() {
        return (
            (this.wiredProviders?.data === undefined && !this.wiredProviders?.error) ||
            this.deleting
        );
    }

    get errorMessage() {
        const err = this.wiredProviders?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load providers.';
    }

    get filterButtons() {
        return [
            { key: 'All', label: 'All', className: this.chipClass('All') },
            { key: 'Practitioner', label: 'Practitioners', className: this.chipClass('Practitioner') },
            { key: 'Facility', label: 'Facilities', className: this.chipClass('Facility') }
        ];
    }

    chipClass(key) {
        return this.subjectType === key
            ? 'slds-button slds-button_brand slds-m-right_xx-small'
            : 'slds-button slds-button_neutral slds-m-right_xx-small';
    }

    handleFilter(event) {
        this.subjectType = event.currentTarget.dataset.key;
    }

    handleSearchChange(event) {
        this.draftSearch = event.target.value;
    }

    handleSearch() {
        this.searchTerm = (this.draftSearch || '').trim();
    }

    handleSearchKeyup(event) {
        if (event.key === 'Enter') {
            this.handleSearch();
        }
    }

    handleSort(event) {
        this.sortedBy = event.detail.fieldName;
        this.sortedDirection = event.detail.sortDirection;
    }

    sortData(data, fieldName, direction) {
        const clone = [...data];
        const isReverse = direction === 'desc' ? -1 : 1;
        clone.sort((a, b) => {
            let x = a[fieldName];
            let y = b[fieldName];
            x = x === undefined || x === null ? '' : x;
            y = y === undefined || y === null ? '' : y;
            if (typeof x === 'string') x = x.toLowerCase();
            if (typeof y === 'string') y = y.toLowerCase();
            if (x > y) return 1 * isReverse;
            if (x < y) return -1 * isReverse;
            return 0;
        });
        return clone;
    }

    async handleRowAction(event) {
        const action = event.detail.action;
        const row = event.detail.row;
        if (!row?.id) return;

        if (action.name === 'delete') {
            await this.confirmAndDelete(row);
            return;
        }

        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: row.id,
                objectApiName: 'Provider__c',
                actionName: 'view'
            }
        });
    }

    async confirmAndDelete(row) {
        const confirmed = await LightningConfirm.open({
            message:
                `Delete ${row.name}? This removes the provider and related applications, credentials, and history from Salesforce.`,
            variant: 'header',
            label: 'Delete provider',
            theme: 'error'
        });
        if (!confirmed) return;

        this.deleting = true;
        try {
            await deleteProvider({ providerId: row.id });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Provider deleted',
                    message: `${row.name} was deleted.`,
                    variant: 'success'
                })
            );
            await refreshApex(this.wiredProviders);
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Delete failed',
                    message: e?.body?.message || e?.message || 'Unable to delete provider.',
                    variant: 'error',
                    mode: 'sticky'
                })
            );
        } finally {
            this.deleting = false;
        }
    }
}
