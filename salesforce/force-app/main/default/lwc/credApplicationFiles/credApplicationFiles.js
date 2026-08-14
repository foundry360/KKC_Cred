import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { loadStyle } from 'lightning/platformResourceLoader';
import listDocumentRequirements from '@salesforce/apex/CredApplicationFilesController.listDocumentRequirements';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

const COLUMNS = [
    { label: 'Document', fieldName: 'name', type: 'text', sortable: true },
    { label: 'Required', fieldName: 'required', type: 'boolean', sortable: true },
    { label: 'Complete', fieldName: 'complete', type: 'boolean', sortable: true },
    {
        label: 'File',
        fieldName: 'fileUrl',
        type: 'url',
        typeAttributes: { label: { fieldName: 'fileTitle' }, target: '_self' },
        sortable: true
    }
];

function sortRows(rows, fieldName, direction) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!fieldName) return list;
    const valueField = fieldName === 'fileUrl' ? 'fileTitle' : fieldName;
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
        if (typeof av === 'boolean' && typeof bv === 'boolean') {
            return (av === bv ? 0 : av ? 1 : -1) * reverse;
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

export default class CredApplicationFiles extends LightningElement {
    @api recordId;
    columns = COLUMNS;
    themeStyleLoaded = false;
    sortedBy = 'sortOrder';
    sortedDirection = 'asc';
    wiredResult;

    @wire(listDocumentRequirements, { applicationId: '$recordId' })
    wiredDocs(result) {
        this.wiredResult = result;
    }

    renderedCallback() {
        if (this.themeStyleLoaded) return;
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    get rows() {
        const data = this.wiredResult?.data || [];
        const mapped = data.map((r) => ({
            ...r,
            fileUrl: r.contentDocumentId ? '/' + r.contentDocumentId : null,
            fileTitle: r.fileTitle || (r.complete ? 'On file' : '—')
        }));
        return sortRows(mapped, this.sortedBy, this.sortedDirection);
    }

    get isLoading() {
        return this.wiredResult?.data === undefined && !this.wiredResult?.error;
    }

    get errorMessage() {
        const err = this.wiredResult?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load documents.';
    }

    get isEmpty() {
        return !this.isLoading && !this.errorMessage && this.rows.length === 0;
    }

    get countLabel() {
        const n = this.rows.length;
        const done = this.rows.filter((r) => r.complete).length;
        return `${done}/${n} complete`;
    }

    handleSort(event) {
        this.sortedBy = event.detail.fieldName;
        this.sortedDirection = event.detail.sortDirection;
    }

    async handleRefresh() {
        if (this.wiredResult) {
            await refreshApex(this.wiredResult);
        }
    }
}
