import { LightningElement, api, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { loadStyle } from 'lightning/platformResourceLoader';
import STATUS_FIELD from '@salesforce/schema/Credentialing_Application__c.Status__c';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

const STEPS = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Intake', label: 'Intake' },
    { value: 'In_Review', label: 'In Review' },
    { value: 'Pending_Committee', label: 'Committee' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Denied', label: 'Denied' }
];

export default class CredApplicationStatusBar extends LightningElement {
    @api recordId;
    themeStyleLoaded = false;

    @wire(getRecord, {
        recordId: '$recordId',
        fields: [STATUS_FIELD]
    })
    record;

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get status() {
        return getFieldValue(this.record.data, STATUS_FIELD);
    }

    get hasError() {
        return !!this.record?.error;
    }

    get isLoading() {
        return !this.record?.data && !this.record?.error;
    }

    get isWithdrawn() {
        return this.status === 'Withdrawn';
    }

    get steps() {
        const current = this.status;
        // Approved and Denied are alternate end states — do not treat one as after the other.
        const approvedIndex = STEPS.findIndex((s) => s.value === 'Approved');
        const deniedIndex = STEPS.findIndex((s) => s.value === 'Denied');
        const currentIndex = STEPS.findIndex((s) => s.value === current);

        return STEPS.map((step, index) => {
            let state = 'upcoming';

            if (current === 'Denied') {
                if (index < approvedIndex) {
                    state = 'complete';
                } else if (index === deniedIndex) {
                    state = 'denied';
                } else if (index === approvedIndex) {
                    state = 'upcoming';
                }
            } else if (current === 'Approved') {
                if (index < approvedIndex) {
                    state = 'complete';
                } else if (index === approvedIndex) {
                    state = 'current';
                } else {
                    state = 'upcoming';
                }
            } else if (current === 'Withdrawn') {
                if (index < approvedIndex) {
                    state = 'complete';
                }
            } else if (currentIndex >= 0) {
                if (index < currentIndex) {
                    state = 'complete';
                } else if (index === currentIndex) {
                    state = 'current';
                }
            }

            return {
                ...step,
                key: step.value,
                className: `step step_${state}`
            };
        });
    }
}
