import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import listAllCredentials from '@salesforce/apex/CredProviderController.listAllCredentials';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import credProvider360Header from '@salesforce/resourceUrl/credProvider360Header';

const COLUMNS = [
    {
        label: 'Credential',
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
    { label: 'Type', fieldName: 'credentialType', type: 'text' },
    { label: 'Number', fieldName: 'credentialNumber', type: 'text' },
    { label: 'Authority', fieldName: 'issuingAuthority', type: 'text' },
    { label: 'Status', fieldName: 'status', type: 'text' },
    {
        label: 'Expires',
        fieldName: 'expirationDate',
        type: 'date-local',
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    }
];

const STATUS_FILTERS = [
    { key: 'All', label: 'All' },
    { key: 'Valid', label: 'Valid' },
    { key: 'Expiring_Soon', label: 'Expiring Soon' },
    { key: 'Expired', label: 'Expired' }
];

export default class CredCredentialList extends NavigationMixin(LightningElement) {
    @track statusFilter = 'All';
    @track searchTerm = '';
    @track draftSearch = '';
    columns = COLUMNS;
    themeStyleLoaded = false;

    @wire(listAllCredentials, { statusFilter: '$statusFilter', searchTerm: '$searchTerm' })
    wiredCreds;

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

    get credentials() {
        const data = this.wiredCreds?.data || [];
        return data.map((row) => ({
            ...row,
            recordUrl: '/' + row.id,
            providerUrl: row.providerId ? '/' + row.providerId : null
        }));
    }

    get recordCountLabel() {
        const n = this.credentials.length;
        return n === 1 ? '1 credential' : `${n} credentials`;
    }

    get isLoading() {
        return this.wiredCreds?.data === undefined && !this.wiredCreds?.error;
    }

    get errorMessage() {
        const err = this.wiredCreds?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load credentials.';
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
