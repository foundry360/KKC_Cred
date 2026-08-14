import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import assist from '@salesforce/apex/CredAssistController.assist';
import createTaskFromDraft from '@salesforce/apex/CredAssistController.createTaskFromDraft';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

export default class CredAssistPanel extends NavigationMixin(LightningElement) {
    themeStyleLoaded = false;
    _recordId;
    _autoRunForId;

    loading = false;
    errorMessage;
    summary;
    draftNote;
    nextAction;
    missingItems = [];
    reconciledNames = [];
    exceptions = [];
    insights = [];
    completenessGaps = [];
    documentFindings = [];
    completenessScore = 0;
    completenessExplainer;
    intakeSummary;
    source;
    warning;
    taskId;
    hasResult = false;

    @api
    get recordId() {
        return this._recordId;
    }
    set recordId(value) {
        this._recordId = value;
        if (value && value !== this._autoRunForId) {
            this._autoRunForId = value;
            this.handleAssist();
        }
    }

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get sourceLabel() {
        return this.source === 'claude' ? 'AI-assisted' : 'Rule-based';
    }

    get sourceClass() {
        return this.source === 'claude'
            ? 'source-badge source-badge_ai'
            : 'source-badge source-badge_rules';
    }

    get showSourceBadge() {
        return this.hasResult && !!this.source;
    }

    get scoreLabel() {
        const score = Number.isFinite(this.completenessScore) ? this.completenessScore : 0;
        return `${Math.max(0, Math.min(100, Math.round(score)))}%`;
    }

    get scoreAriaLabel() {
        return `Completeness score ${this.scoreLabel}`;
    }

    get scoreDasharray() {
        const score = Number.isFinite(this.completenessScore) ? this.completenessScore : 0;
        const clamped = Math.max(0, Math.min(100, score));
        // Circumference of r=15.9155 ≈ 100, so score maps 1:1 to dash length.
        return `${clamped} ${100 - clamped}`;
    }

    get scoreStroke() {
        const score = Number.isFinite(this.completenessScore) ? this.completenessScore : 0;
        if (score >= 85) return '#0288d1';
        if (score >= 60) return '#29b6f6';
        return '#4fc3f7';
    }

    get hasMissing() {
        return this.missingItems && this.missingItems.length > 0;
    }

    get hasReconciled() {
        return this.reconciledNames && this.reconciledNames.length > 0;
    }

    get hasExceptions() {
        return this.exceptions && this.exceptions.length > 0;
    }

    get hasInsights() {
        return this.insights && this.insights.length > 0;
    }

    get hasCompletenessGaps() {
        return this.completenessGaps && this.completenessGaps.length > 0;
    }

    get hasDocumentFindings() {
        return this.documentFindings && this.documentFindings.length > 0;
    }

    get missingItemRows() {
        return (this.missingItems || []).map((label, index) => ({
            key: `m-${index}-${label}`,
            label
        }));
    }

    get reconciledRows() {
        return (this.reconciledNames || []).map((label, index) => ({
            key: `r-${index}-${label}`,
            label
        }));
    }

    get exceptionRows() {
        return (this.exceptions || []).map((label, index) => ({
            key: `e-${index}-${label}`,
            label
        }));
    }

    get insightRows() {
        return (this.insights || []).map((label, index) => ({
            key: `i-${index}-${label}`,
            label
        }));
    }

    get completenessRows() {
        return (this.completenessGaps || []).map((label, index) => ({
            key: `c-${index}-${label}`,
            label
        }));
    }

    get documentRows() {
        return (this.documentFindings || []).map((label, index) => ({
            key: `d-${index}-${label}`,
            label
        }));
    }

    async handleAssist() {
        if (!this.recordId || this.loading) return;
        this.loading = true;
        this.errorMessage = null;
        this.warning = null;
        try {
            const result = await assist({ recordId: this.recordId });
            this.summary = result.summary;
            this.draftNote = result.draftNote;
            this.nextAction = result.nextAction;
            this.missingItems = result.missingItems || [];
            this.reconciledNames = result.reconciledNames || [];
            this.exceptions = result.exceptions || [];
            this.insights = result.insights || [];
            this.completenessGaps = result.completenessGaps || [];
            this.documentFindings = result.documentFindings || [];
            this.completenessScore =
                result.completenessScore == null ? 0 : Number(result.completenessScore);
            this.completenessExplainer =
                result.completenessExplainer ||
                'Completeness score is based on structured Provider 360 checks.';
            this.intakeSummary = result.intakeSummary;
            this.source = result.source === 'claude' ? 'claude' : 'local';
            this.warning = result.warning;
            this.taskId = null;
            this.hasResult = true;
        } catch (e) {
            this.errorMessage = e?.body?.message || e?.message || 'Assist failed.';
            this.hasResult = false;
        } finally {
            this.loading = false;
        }
    }

    handleDraftChange(event) {
        this.draftNote = event.target.value;
    }

    async handleCreateTask() {
        if (!this.draftNote) return;
        this.loading = true;
        this.errorMessage = null;
        try {
            const result = await createTaskFromDraft({
                recordId: this.recordId,
                draftNote: this.draftNote,
                subject: null
            });
            this.taskId = result.taskId;
            this.nextAction = result.nextAction;
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Task created',
                    message: 'Chase draft saved as a Task. Application status unchanged.',
                    variant: 'success'
                })
            );
        } catch (e) {
            this.errorMessage = e?.body?.message || e?.message || 'Could not create Task.';
        } finally {
            this.loading = false;
        }
    }

    handleOpenTask() {
        if (!this.taskId) return;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.taskId,
                objectApiName: 'Task',
                actionName: 'view'
            }
        });
    }
}
