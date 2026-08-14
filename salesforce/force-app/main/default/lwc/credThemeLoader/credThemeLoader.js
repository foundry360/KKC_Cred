import { LightningElement, api } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import credAppTheme from '@salesforce/resourceUrl/credAppTheme';

export default class CredThemeLoader extends LightningElement {
    @api label = 'Theme';
    _loaded = false;

    connectedCallback() {
        this.loadTheme();
    }

    renderedCallback() {
        this.loadTheme();
        this.stripDuplicateLogos();
    }

    loadTheme() {
        if (this._loaded) {
            return;
        }
        this._loaded = true;
        // Cache-bust so header CSS updates are not stuck on an old static resource
        loadStyle(this, `${credAppTheme}?v=20260813c`).catch(() => {
            this._loaded = false;
        });
    }

    stripDuplicateLogos() {
        try {
            const header = document.querySelector('.oneHeader, header.slds-global-header');
            if (!header) return;

            const logos = header.querySelectorAll('.slds-global-header__logo, .themeLogo');
            logos.forEach((el, idx) => {
                if (idx === 0) {
                    const imgs = el.querySelectorAll('img');
                    imgs.forEach((img) => {
                        img.style.opacity = '0';
                    });
                    return;
                }
                el.style.display = 'none';
                el.style.backgroundImage = 'none';
            });

            header
                .querySelectorAll(
                    'img[src*="Meridian"], img[src*="file-asset"], img[alt*="Meridian"], .themeLogo'
                )
                .forEach((el) => {
                    if (el.closest && el.closest('.slds-global-header__item:first-child')) {
                        return;
                    }
                    el.style.display = 'none';
                });
        } catch (e) {
            // ignore — header markup varies by LEX version
        }
    }
}
