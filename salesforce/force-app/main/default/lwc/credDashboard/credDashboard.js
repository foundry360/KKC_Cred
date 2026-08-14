import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import getSummary from '@salesforce/apex/CredDashboardController.getSummary';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import credOpsPageHeader from '@salesforce/resourceUrl/credOpsPageHeader';

const APP_COLUMNS = [
    {
        label: 'Provider',
        fieldName: 'providerUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'providerName' } }
    },
    { label: 'Application', fieldName: 'name', type: 'text' },
    { label: 'Type', fieldName: 'applicationType', type: 'text' },
    { label: 'Path', fieldName: 'pathValue', type: 'text' },
    { label: 'Attempts', fieldName: 'attemptCount', type: 'number' },
    {
        label: 'Due',
        fieldName: 'dueDate',
        type: 'date-local',
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    }
];

const COMMITTEE_COLUMNS = [
    {
        label: 'Provider',
        fieldName: 'providerUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'providerName' } }
    },
    { label: 'Application', fieldName: 'name', type: 'text' },
    { label: 'Path', fieldName: 'pathValue', type: 'text' },
    { label: 'Status', fieldName: 'status', type: 'text' },
    {
        label: 'Due',
        fieldName: 'dueDate',
        type: 'date-local',
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    }
];

const CRED_COLUMNS = [
    {
        label: 'Provider',
        fieldName: 'providerUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'providerName' } }
    },
    { label: 'Credential', fieldName: 'name', type: 'text' },
    { label: 'Type', fieldName: 'credentialType', type: 'text' },
    {
        label: 'Expires',
        fieldName: 'expirationDate',
        type: 'date-local',
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    },
    { label: 'Status', fieldName: 'status', type: 'text' }
];

const RECRED_COLUMNS = [
    {
        label: 'Provider',
        fieldName: 'recordUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'name' } }
    },
    { label: 'External Id', fieldName: 'externalId', type: 'text' },
    { label: 'Type', fieldName: 'subjectType', type: 'text' },
    {
        label: 'Recred due',
        fieldName: 'recredDueDate',
        type: 'date-local',
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    },
    { label: 'Status', fieldName: 'status', type: 'text' }
];

const DONUT_RADIUS = 15.9155;
const DONUT_CIRCUMFERENCE = 100;

function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function enrichSlices(slices) {
    const list = Array.isArray(slices) ? slices : [];
    const max = list.reduce((m, s) => Math.max(m, toNumber(s.value)), 0) || 1;
    let offset = 25; // start at top
    return list.map((slice) => {
        const value = toNumber(slice.value);
        const percent = toNumber(slice.percent);
        const length = Math.max(0, Math.min(DONUT_CIRCUMFERENCE, percent));
        const row = {
            ...slice,
            value,
            percent,
            percentLabel: `${percent}%`,
            valueLabel: String(value),
            metaLabel: `${value} · ${percent}%`,
            swatchStyle: `background:${slice.color || '#0288D1'}`,
            dasharray: `${length} ${DONUT_CIRCUMFERENCE - length}`,
            dashoffset: String(offset),
            stroke: slice.color || '#0288D1',
            barStyle: `width:${Math.round((value / max) * 100)}%;background:${slice.color || '#0288D1'};`
        };
        offset -= length;
        return row;
    });
}

function sliceTotal(slices) {
    return (slices || []).reduce((sum, s) => sum + toNumber(s.value), 0);
}

export default class CredDashboard extends NavigationMixin(LightningElement) {
    appColumns = APP_COLUMNS;
    committeeColumns = COMMITTEE_COLUMNS;
    credColumns = CRED_COLUMNS;
    recredColumns = RECRED_COLUMNS;
    donutRadius = DONUT_RADIUS;
    themeStyleLoaded = false;

    @wire(getSummary)
    wiredSummary;

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        Promise.all([
            loadStyle(this, credAppTheme),
            loadStyle(this, credOpsPageHeader)
        ]).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get isLoading() {
        return this.wiredSummary?.data === undefined && !this.wiredSummary?.error;
    }

    get errorMessage() {
        const err = this.wiredSummary?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load dashboard.';
    }

    get counts() {
        return this.wiredSummary?.data?.counts || {};
    }

    get microCards() {
        const c = this.counts;
        return [
            {
                key: 'openCases',
                label: 'Open Cases',
                value: c.openCases ?? 0,
                tone: 'accent',
                target: 'Case',
                iconName: 'utility:case'
            },
            {
                key: 'expiring',
                label: 'Expiring Credentials',
                value: c.credentialsExpiringSoon ?? 0,
                tone: 'warn',
                target: 'Provider_Credential__c',
                iconName: 'utility:ribbon'
            },
            {
                key: 'activeProviders',
                label: 'Active Providers',
                value: c.activeProviders ?? 0,
                tone: '',
                target: 'Provider__c',
                iconName: 'utility:user'
            },
            {
                key: 'pendingApps',
                label: 'Pending Applications',
                value: c.pendingApplications ?? 0,
                tone: 'warn',
                target: 'Credentialing_Application__c',
                iconName: 'utility:file'
            },
            {
                key: 'recredDue',
                label: 'Recreds < 120 Days',
                value: c.recredDue ?? 0,
                tone: 'accent',
                target: 'Provider__c',
                iconName: 'utility:event'
            }
        ].map((card) => ({
            ...card,
            className:
                'micro-card micro-card_' +
                card.key +
                (card.tone ? ' micro-card_' + card.tone : '')
        }));
    }

    get openApplicationStages() {
        return enrichSlices(this.wiredSummary?.data?.openApplicationStages);
    }

    get openCaseWorkload() {
        return enrichSlices(this.wiredSummary?.data?.openCaseWorkload);
    }

    get missingDocuments() {
        return enrichSlices(this.wiredSummary?.data?.missingDocuments);
    }

    get providerProfileHealth() {
        return enrichSlices(this.wiredSummary?.data?.providerProfileHealth);
    }

    get openAppsTotal() {
        return sliceTotal(this.openApplicationStages);
    }

    get openAppsTotalLabel() {
        return String(this.openAppsTotal);
    }

    get openAppsEmpty() {
        return this.openAppsTotal === 0;
    }

    get caseQueueEmpty() {
        return sliceTotal(this.openCaseWorkload) === 0;
    }

    get missingDocsEmpty() {
        return sliceTotal(this.missingDocuments) === 0;
    }

    get profileHealthTotal() {
        return sliceTotal(this.providerProfileHealth);
    }

    get profileHealthTotalLabel() {
        return String(this.profileHealthTotal);
    }

    get profileHealthEmpty() {
        return this.profileHealthTotal === 0;
    }

    get chaseQueue() {
        return this.wiredSummary?.data?.chaseQueue || [];
    }

    get committeeQueue() {
        return this.wiredSummary?.data?.committeeQueue || [];
    }

    get expiringCredentials() {
        return this.wiredSummary?.data?.expiringCredentials || [];
    }

    get recredQueue() {
        return this.wiredSummary?.data?.recredQueue || [];
    }

    get chaseEmpty() {
        return !this.isLoading && !this.errorMessage && this.chaseQueue.length === 0;
    }

    get committeeEmpty() {
        return !this.isLoading && !this.errorMessage && this.committeeQueue.length === 0;
    }

    get credEmpty() {
        return !this.isLoading && !this.errorMessage && this.expiringCredentials.length === 0;
    }

    get recredEmpty() {
        return !this.isLoading && !this.errorMessage && this.recredQueue.length === 0;
    }

    handleMicroClick(event) {
        const objectApiName = event.currentTarget.dataset.target;
        if (!objectApiName) return;
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName,
                actionName: 'list'
            }
        });
    }

    navigateToObject(objectApiName) {
        this[NavigationMixin.Navigate]({
            type: 'standard__objectPage',
            attributes: {
                objectApiName,
                actionName: 'list'
            }
        });
    }

    handleViewApps() {
        this.navigateToObject('Credentialing_Application__c');
    }

    handleViewCreds() {
        this.navigateToObject('Provider_Credential__c');
    }

    handleViewProviders() {
        this.navigateToObject('Provider__c');
    }
}
