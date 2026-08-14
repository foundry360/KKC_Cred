import { LightningElement, api, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';
import listEducation from '@salesforce/apex/CredProviderController.listEducation';

const COLUMNS = [
    { label: 'Institution', fieldName: 'institutionName', type: 'text', sortable: true },
    { label: 'Degree', fieldName: 'degreeType', type: 'text', sortable: true },
    { label: 'Field', fieldName: 'fieldOfStudy', type: 'text', sortable: true },
    {
        label: 'End',
        fieldName: 'endDate',
        type: 'date-local',
        sortable: true,
        typeAttributes: { month: '2-digit', day: '2-digit', year: 'numeric' }
    },
    { label: 'Year', fieldName: 'graduationYear', type: 'number', sortable: true },
    { label: 'Country', fieldName: 'country', type: 'text', sortable: true }
];

function sortRows(rows, fieldName, direction) {
    const list = Array.isArray(rows) ? [...rows] : [];
    if (!fieldName) {
        return list;
    }
    const reverse = direction === 'desc' ? -1 : 1;
    list.sort((a, b) => {
        const av = a?.[fieldName];
        const bv = b?.[fieldName];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (typeof av === 'number' && typeof bv === 'number') {
            return (av - bv) * reverse;
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

export default class CredEducationPanel extends LightningElement {
    themeStyleLoaded = false;
    sortedBy = 'endDate';
    sortedDirection = 'desc';

    renderedCallback() {
        if (this.themeStyleLoaded) {
            return;
        }
        this.themeStyleLoaded = true;
        loadStyle(this, credAppTheme).catch(() => {
            this.themeStyleLoaded = false;
        });
    }

    @api recordId;
    columns = COLUMNS;

    @wire(listEducation, { providerId: '$recordId' })
    wiredEducation;

    get rows() {
        return sortRows(this.wiredEducation?.data, this.sortedBy, this.sortedDirection);
    }

    get isLoading() {
        return this.wiredEducation?.data === undefined && !this.wiredEducation?.error;
    }

    get errorMessage() {
        const err = this.wiredEducation?.error;
        if (!err) return null;
        return err.body?.message || err.message || 'Unable to load education history.';
    }

    get isEmpty() {
        return (
            !this.isLoading &&
            !this.errorMessage &&
            !(this.wiredEducation?.data || []).length
        );
    }

    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;
        this.sortedBy = fieldName;
        this.sortedDirection = sortDirection;
    }
}
