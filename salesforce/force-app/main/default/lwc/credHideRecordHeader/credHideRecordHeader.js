import { LightningElement } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import hideHeader from '@salesforce/resourceUrl/credHideRecordHeader';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

export default class CredHideRecordHeader extends LightningElement {
    _loaded = false;

    renderedCallback() {
        if (this._loaded) return;
        this._loaded = true;
        Promise.all([
            loadStyle(this, hideHeader),
            loadStyle(this, credAppTheme)
        ]).catch(() => {
            // non-fatal — page still usable if CSS fails to load
        });
    }
}
