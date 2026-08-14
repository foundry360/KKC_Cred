import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { loadStyle } from 'lightning/platformResourceLoader';
import getDashboard from '@salesforce/apex/CredPsvController.getDashboard';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

const STATUS_LABELS = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    verified: 'Verified',
    exception: 'Exception',
    human_review: 'Human Review',
    credentialing_ready: 'Credentialing Ready',
    clear: 'Clear',
    pending: 'Pending',
    not_verified: 'Not Verified',
    failed: 'Failed'
};

const TYPE_LABELS = {
    npi_verification: 'NPI verification',
    state_license_verification: 'State license verification',
    oig_exclusion: 'OIG exclusion',
    sam_exclusion: 'SAM.gov exclusion',
    medicare_enrollment: 'Medicare enrollment',
    board_certification: 'Board certification',
    dea_verification: 'DEA verification',
    malpractice_documentation: 'Malpractice documentation',
    cv: 'CV',
    missing: 'Missing',
    expired: 'Expired',
    mismatch: 'Mismatch',
    verification_failure: 'Verification failure',
    human_review: 'Human review',
    other: 'Other'
};

const ACRONYMS = new Set(['npi', 'oig', 'dea', 'cv', 'psv', 'caqh', 'sam']);

function humanizeKey(raw) {
    if (!raw) return '';
    if (TYPE_LABELS[raw]) return TYPE_LABELS[raw];
    return String(raw)
        .replace(/_/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) return lower.toUpperCase();
            return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(' ');
}

export default class CredPsvPanel extends LightningElement {
    @api recordId;
    themeStyleLoaded = false;
    wiredResult;
    sourcesExpanded = true;
    exceptionsExpanded = true;

    @wire(getDashboard, { applicationId: '$recordId' })
    wiredDashboard(result) {
        this.wiredResult = result;
    }

    renderedCallback() {
        if (this.themeStyleLoaded) return;
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get dash() {
        return this.wiredResult?.data || null;
    }

    get isLoading() {
        return this.wiredResult?.data === undefined && !this.wiredResult?.error;
    }

    get errorMessage() {
        const err = this.wiredResult?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load verification.';
    }

    get hasRun() {
        return Boolean(this.dash?.psvStatus && this.dash.psvStatus !== 'not_started');
    }

    get isEmpty() {
        return (
            !this.isLoading &&
            !this.errorMessage &&
            !this.hasRun &&
            (this.dash?.verifications || []).length === 0
        );
    }

    get statusLabel() {
        const s = this.dash?.psvStatus;
        return STATUS_LABELS[s] || s || '—';
    }

    get statusClass() {
        const s = this.dash?.psvStatus || 'not_started';
        return `status-pill status-${s}`;
    }

    get scoreLabel() {
        const score = this.dash?.readinessScore;
        if (score == null) return '—';
        return `${score}%`;
    }

    get ranAtLabel() {
        const d = this.dash?.psvRanAt;
        if (!d) return null;
        try {
            return new Date(d).toLocaleString();
        } catch {
            return String(d);
        }
    }

    get ranAtDisplay() {
        return this.ranAtLabel || '—';
    }

    get verificationRows() {
        return (this.dash?.verifications || []).map((v) => ({
            ...v,
            statusLabel: STATUS_LABELS[v.status] || v.status,
            modeLabel: (v.sourceMode || '').toUpperCase(),
            modeClass: `mode-badge mode-${v.sourceMode || 'poc'}`,
            statusClass: `v-status v-${v.status || 'pending'}`,
            typeLabel: humanizeKey(v.verificationType)
        }));
    }

    get exceptionRows() {
        return (this.dash?.exceptions || []).map((e) => ({
            ...e,
            typeLabel: humanizeKey(e.exceptionType),
            severityClass: `sev sev-${e.severity || 'warning'}`
        }));
    }

    get verificationCount() {
        return this.verificationRows.length;
    }

    get exceptionCount() {
        return this.exceptionRows.length;
    }

    get disclaimer() {
        return this.dash?.disclaimer || '';
    }

    get sourcesChevron() {
        return this.sourcesExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    get exceptionsChevron() {
        return this.exceptionsExpanded ? 'utility:chevrondown' : 'utility:chevronright';
    }

    toggleSources() {
        this.sourcesExpanded = !this.sourcesExpanded;
    }

    toggleExceptions() {
        this.exceptionsExpanded = !this.exceptionsExpanded;
    }

    async handleRefresh() {
        if (this.wiredResult) {
            await refreshApex(this.wiredResult);
        }
    }
}
