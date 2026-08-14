import { LightningElement, api, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import LightningConfirm from 'lightning/confirm';
import { loadStyle } from 'lightning/platformResourceLoader';
import getProvider from '@salesforce/apex/CredProviderController.getProvider';
import deleteProvider from '@salesforce/apex/CredProviderController.deleteProvider';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

export default class CredProviderHeader extends NavigationMixin(LightningElement) {
    @api recordId;
    themeStyleLoaded = false;
    deleting = false;

    @wire(getProvider, { providerId: '$recordId' })
    wiredProvider;

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get provider() {
        return this.wiredProvider?.data || null;
    }

    get isLoading() {
        return (!this.wiredProvider?.data && !this.wiredProvider?.error) || this.deleting;
    }

    get errorMessage() {
        const err = this.wiredProvider?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load provider.';
    }

    get subtitle() {
        const p = this.provider;
        if (!p) return '';
        const parts = [];
        if (p.externalId) parts.push(p.externalId);
        if (p.npi) parts.push('NPI ' + p.npi);
        return parts.join(' · ');
    }

    get specialtyOrFacilityLabel() {
        return this.provider?.subjectType === 'Facility' ? 'Facility type' : 'Specialty';
    }

    get specialtyOrFacilityValue() {
        const p = this.provider;
        if (!p) return '—';
        return p.subjectType === 'Facility'
            ? (p.facilityType || '—')
            : (p.specialty || '—');
    }

    get fields() {
        const p = this.provider;
        if (!p) return [];
        return [
            { key: 'org', label: 'Organization', value: p.organizationName || '—' },
            { key: 'spec', label: this.specialtyOrFacilityLabel, value: this.specialtyOrFacilityValue },
            { key: 'dob', label: 'Date of birth', value: this.formatDate(p.dateOfBirth) },
            { key: 'gender', label: 'Gender', value: p.gender || '—' },
            { key: 'ssn', label: 'SSN', value: this.formatSsnLast4(p.ssnLast4) },
            { key: 'caqh', label: 'CAQH ID', value: p.caqhId || '—' },
            { key: 'lang', label: 'Languages', value: p.preferredLanguages || '—' },
            { key: 'pracState', label: 'Practice state', value: p.practiceState || '—' },
            { key: 'recred', label: 'Recred due', value: this.formatDate(p.recredDueDate) },
            { key: 'email', label: 'Email', value: p.email || '—' },
            { key: 'phone', label: 'Phone', value: this.formatPhone(p.phone) },
            { key: 'mobile', label: 'Mobile', value: this.formatPhone(p.mobilePhone) }
        ];
    }

    formatDate(value) {
        if (!value) return '—';
        try {
            return new Date(value).toLocaleDateString();
        } catch (e) {
            return value;
        }
    }

    formatSsnLast4(value) {
        if (!value) return '—';
        const digits = String(value).replace(/\D/g, '').slice(-4);
        if (digits.length !== 4) return '—';
        return `***-**-${digits}`;
    }

    formatPhone(value) {
        if (!value) return '—';
        const digits = String(value).replace(/\D/g, '');
        const ten = digits.length === 11 && digits.startsWith('1')
            ? digits.slice(1)
            : digits.slice(-10);
        if (ten.length !== 10) return String(value);
        return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
    }

    async handleDelete() {
        const p = this.provider;
        if (!p?.id || this.deleting) return;

        const confirmed = await LightningConfirm.open({
            message:
                `Delete ${p.name}? This removes the provider and related applications, credentials, and history from Salesforce.`,
            variant: 'header',
            label: 'Delete provider',
            theme: 'error'
        });
        if (!confirmed) return;

        this.deleting = true;
        try {
            await deleteProvider({ providerId: p.id });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Provider deleted',
                    message: `${p.name} was deleted.`,
                    variant: 'success'
                })
            );
            this[NavigationMixin.Navigate]({
                type: 'standard__navItemPage',
                attributes: {
                    apiName: 'Providers_Workspace'
                }
            });
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Delete failed',
                    message: e?.body?.message || e?.message || 'Unable to delete provider.',
                    variant: 'error',
                    mode: 'sticky'
                })
            );
            this.deleting = false;
        }
    }
}
