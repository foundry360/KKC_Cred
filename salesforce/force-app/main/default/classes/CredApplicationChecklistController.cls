public with sharing class CredApplicationChecklistController {
    public class DataRow {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String category;
        @AuraEnabled public Boolean required;
        @AuraEnabled public Boolean complete;
        @AuraEnabled public Integer sortOrder;
    }

    private static final Set<String> DOCUMENT_KEYS = new Set<String>{
        'npi_copy',
        'state_license_copy',
        'medical_license_copy',
        'dea_cds_certificates',
        'dea_certificate',
        'social_security_card',
        'medical_degrees_training',
        'work_background',
        'board_certificate',
        'board_certification',
        'malpractice_insurance',
        'malpractice_coi',
        'curriculum_vitae',
        'cv_resume',
        'drivers_license',
        'npi_confirmation',
        'w9',
        'facility_license',
        'accreditation',
        'ownership_documentation',
        'insurance_certificate',
        'caqh_attestation'
    };

    private static final Set<String> DATA_KEYS = new Set<String>{
        'personal_information',
        'federal_tax_id',
        'medicaid_number',
        'medicare_number'
    };

    @AuraEnabled(cacheable=true)
    public static List<DataRow> listDataChecklist(Id applicationId) {
        List<DataRow> rows = new List<DataRow>();
        if (applicationId == null) {
            return rows;
        }

        List<Credentialing_Application__c> apps = [
            SELECT Id, Subject_Type__c, Provider__c,
                   Provider__r.Subject_Type__c,
                   Provider__r.NPI__c,
                   Provider__r.Date_Of_Birth__c,
                   Provider__r.Specialty__c,
                   Provider__r.Facility_Type__c,
                   Provider__r.First_Name__c,
                   Provider__r.Last_Name__c,
                   Provider__r.Email__c,
                   Provider__r.Phone__c,
                   Provider__r.Federal_Tax_ID__c,
                   Provider__r.Medicaid_Number__c,
                   Provider__r.Medicare_Number__c
            FROM Credentialing_Application__c
            WHERE Id = :applicationId
            LIMIT 1
        ];
        if (apps.isEmpty() || apps[0].Provider__c == null) {
            return rows;
        }

        Credentialing_Application__c app = apps[0];
        Provider__c provider = app.Provider__r;
        Boolean isPractitioner = (app.Subject_Type__c == 'Practitioner')
            || (provider != null && provider.Subject_Type__c == 'Practitioner');
        Id providerId = app.Provider__c;

        Integer addressCount = [
            SELECT COUNT() FROM Provider_Address__c WHERE Provider__c = :providerId
        ];
        Integer educationCount = [
            SELECT COUNT() FROM Education_History__c WHERE Provider__c = :providerId
        ];
        Integer workCount = [
            SELECT COUNT() FROM Work_History__c WHERE Provider__c = :providerId
        ];
        Integer credentialCount = [
            SELECT COUNT() FROM Provider_Credential__c WHERE Provider__c = :providerId
        ];

        // Roll up to exactly four categories: Demographics, Profile, History, Attestation
        List<String> demoChecks = new List<String>();
        List<String> demoMissing = new List<String>();
        if (isPractitioner) {
            Boolean hasName = String.isNotBlank(provider.First_Name__c)
                && String.isNotBlank(provider.Last_Name__c);
            Boolean hasNpi = String.isNotBlank(provider.NPI__c);
            Boolean hasDob = provider.Date_Of_Birth__c != null;
            demoChecks.add('Legal name');
            demoChecks.add('NPI');
            demoChecks.add('Date of birth');
            if (!hasName) demoMissing.add('Legal name');
            if (!hasNpi) demoMissing.add('NPI');
            if (!hasDob) demoMissing.add('Date of birth');
            rows.add(categoryRow(
                'cat-demographics',
                'Demographics',
                demoChecks,
                demoMissing,
                true,
                1
            ));
        }

        List<String> profileChecks = new List<String>();
        List<String> profileMissing = new List<String>();
        if (isPractitioner) {
            profileChecks.add('Specialty');
            if (String.isBlank(provider.Specialty__c)) profileMissing.add('Specialty');
        } else {
            profileChecks.add('Facility type');
            if (String.isBlank(provider.Facility_Type__c)) profileMissing.add('Facility type');
        }
        profileChecks.add('Email');
        profileChecks.add('Phone');
        profileChecks.add('Address');
        profileChecks.add('Federal Tax ID');
        profileChecks.add('Medicaid number');
        profileChecks.add('Medicare number');
        if (String.isBlank(provider.Email__c)) profileMissing.add('Email');
        if (String.isBlank(provider.Phone__c)) profileMissing.add('Phone');
        if (addressCount == 0) profileMissing.add('Address');
        if (String.isBlank(provider.Federal_Tax_ID__c)) profileMissing.add('Federal Tax ID');
        if (String.isBlank(provider.Medicaid_Number__c)) profileMissing.add('Medicaid number');
        if (String.isBlank(provider.Medicare_Number__c)) profileMissing.add('Medicare number');
        rows.add(categoryRow(
            'cat-profile',
            'Profile',
            profileChecks,
            profileMissing,
            true,
            2
        ));

        if (isPractitioner) {
            List<String> historyChecks = new List<String>{
                'Education', 'Work history', 'Credential'
            };
            List<String> historyMissing = new List<String>();
            if (educationCount == 0) historyMissing.add('Education');
            if (workCount == 0) historyMissing.add('Work history');
            if (credentialCount == 0) historyMissing.add('Credential');
            rows.add(categoryRow(
                'cat-history',
                'History',
                historyChecks,
                historyMissing,
                true,
                3
            ));
        }

        List<String> attestChecks = new List<String>();
        List<String> attestMissing = new List<String>();
        Boolean anyAttestation = false;
        for (Checklist_Item__c item : [
            SELECT Id, Name, Item_Key__c, Required__c, Complete__c
            FROM Checklist_Item__c
            WHERE Credentialing_Application__c = :applicationId
            ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
        ]) {
            String key = item.Item_Key__c == null ? '' : item.Item_Key__c.toLowerCase();
            if (DOCUMENT_KEYS.contains(key) || DATA_KEYS.contains(key) || isDocumentLikeName(item.Name)) {
                continue;
            }
            anyAttestation = true;
            String label = String.isBlank(item.Name) ? 'Attestation' : item.Name;
            attestChecks.add(label);
            if (item.Required__c == true && item.Complete__c != true) {
                attestMissing.add(label);
            }
        }
        if (anyAttestation) {
            rows.add(categoryRow(
                'cat-attestation',
                'Attestation',
                attestChecks,
                attestMissing,
                true,
                4
            ));
        }

        return rows;
    }

    public static Set<String> documentKeys() {
        return DOCUMENT_KEYS;
    }

    private static DataRow categoryRow(
        String id,
        String category,
        List<String> checks,
        List<String> missing,
        Boolean required,
        Integer sortOrder
    ) {
        DataRow row = new DataRow();
        row.id = id;
        row.category = category;
        row.required = required;
        row.complete = missing.isEmpty();
        row.sortOrder = sortOrder;
        if (missing.isEmpty()) {
            row.name = String.join(checks, ', ');
        } else {
            row.name = 'Missing: ' + String.join(missing, ', ');
        }
        return row;
    }

    private static Boolean isDocumentLikeName(String name) {
        if (String.isBlank(name)) return false;
        String n = name.toLowerCase();
        return n.contains('copy')
            || n.contains('certificate')
            || n.contains('documentation')
            || n.contains('license')
            || n.contains('cv')
            || n.contains('resume')
            || n.contains('vitae')
            || n.contains('coi')
            || n.contains('background')
            || n.contains('degrees')
            || n.contains('card');
    }
}
