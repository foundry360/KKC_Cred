public with sharing class CredApplicationFilesController {
    public class DocumentRequirementRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String itemKey;
        @AuraEnabled public Boolean required;
        @AuraEnabled public Boolean complete;
        @AuraEnabled public Integer sortOrder;
        @AuraEnabled public Id contentDocumentId;
        @AuraEnabled public String fileTitle;
    }

    @AuraEnabled(cacheable=true)
    public static List<DocumentRequirementRow> listDocumentRequirements(Id applicationId) {
        List<DocumentRequirementRow> rows = new List<DocumentRequirementRow>();
        if (applicationId == null) {
            return rows;
        }

        Set<String> documentKeys = CredApplicationChecklistController.documentKeys();

        List<Checklist_Item__c> items = [
            SELECT Id, Name, Item_Key__c, Required__c, Complete__c, Sort_Order__c
            FROM Checklist_Item__c
            WHERE Credentialing_Application__c = :applicationId
            ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
        ];

        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId,
                   ContentDocument.Title,
                   ContentDocument.FileType
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :applicationId
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT 200
        ];

        List<FileMatch> files = new List<FileMatch>();
        for (ContentDocumentLink link : links) {
            if (link.ContentDocumentId == null || link.ContentDocument == null) continue;
            FileMatch fm = new FileMatch();
            fm.contentDocumentId = link.ContentDocumentId;
            fm.title = link.ContentDocument.Title;
            fm.titleLower = fm.title == null ? '' : fm.title.toLowerCase();
            files.add(fm);
        }

        Set<Id> claimedFiles = new Set<Id>();
        for (Checklist_Item__c item : items) {
            String key = item.Item_Key__c == null ? '' : item.Item_Key__c.toLowerCase();
            if (!documentKeys.contains(key) && !isDocumentLikeName(item.Name)) {
                continue;
            }

            DocumentRequirementRow row = new DocumentRequirementRow();
            row.id = item.Id;
            row.name = item.Name;
            row.itemKey = item.Item_Key__c;
            row.required = item.Required__c == true;
            row.sortOrder = item.Sort_Order__c == null ? 0 : Integer.valueOf(item.Sort_Order__c);

            FileMatch matched = matchFile(item, files, claimedFiles);
            if (matched != null) {
                claimedFiles.add(matched.contentDocumentId);
                row.contentDocumentId = matched.contentDocumentId;
                row.fileTitle = matched.title;
                row.complete = true;
            } else {
                row.complete = false;
            }
            rows.add(row);
        }
        return rows;
    }

    @AuraEnabled(cacheable=true)
    public static List<DocumentRequirementRow> listFiles(Id applicationId) {
        return listDocumentRequirements(applicationId);
    }

    private class FileMatch {
        Id contentDocumentId;
        String title;
        String titleLower;
    }

    private static FileMatch matchFile(
        Checklist_Item__c item,
        List<FileMatch> files,
        Set<Id> claimedFiles
    ) {
        List<String> tokens = tokensForItem(item);
        if (tokens.isEmpty() || files.isEmpty()) {
            return null;
        }
        for (FileMatch fm : files) {
            if (claimedFiles.contains(fm.contentDocumentId)) continue;
            for (String tok : tokens) {
                if (String.isNotBlank(tok) && fm.titleLower.contains(tok)) {
                    return fm;
                }
            }
        }
        return null;
    }

    private static List<String> tokensForItem(Checklist_Item__c item) {
        String key = item.Item_Key__c == null ? '' : item.Item_Key__c.toLowerCase();
        Map<String, List<String>> expected = new Map<String, List<String>>{
            'medical_license_copy' => new List<String>{ 'license', 'lic' },
            'dea_certificate' => new List<String>{ 'dea' },
            'board_certification' => new List<String>{ 'board', 'cert' },
            'malpractice_coi' => new List<String>{ 'malpractice', 'coi', 'insurance' },
            'cv_resume' => new List<String>{ 'cv', 'resume', 'curriculum' },
            'npi_confirmation' => new List<String>{ 'npi' },
            'w9' => new List<String>{ 'w9', 'w-9' },
            'facility_license' => new List<String>{ 'license', 'facility' },
            'accreditation' => new List<String>{ 'accredit' },
            'ownership_documentation' => new List<String>{ 'ownership', 'owner' },
            'insurance_certificate' => new List<String>{ 'insurance', 'coi' }
        };
        if (expected.containsKey(key)) {
            return expected.get(key);
        }

        String nameLower = item.Name == null ? '' : item.Name.toLowerCase();
        if (nameLower.contains('license')) return new List<String>{ 'license', 'lic' };
        if (nameLower.contains('dea')) return new List<String>{ 'dea' };
        if (nameLower.contains('board')) return new List<String>{ 'board', 'cert' };
        if (nameLower.contains('cv') || nameLower.contains('resume')) {
            return new List<String>{ 'cv', 'resume' };
        }
        if (nameLower.contains('malpractice') || nameLower.contains('coi')) {
            return new List<String>{ 'malpractice', 'coi' };
        }
        if (nameLower.contains('npi')) return new List<String>{ 'npi' };
        if (nameLower.contains('ownership')) return new List<String>{ 'ownership', 'owner' };
        if (nameLower.contains('accredit')) return new List<String>{ 'accredit' };
        if (String.isNotBlank(key)) {
            return new List<String>{ key.replace('_', ' ') };
        }
        return new List<String>();
    }

    private static Boolean isDocumentLikeName(String name) {
        if (String.isBlank(name)) return false;
        String n = name.toLowerCase();
        if (n.contains('attestation')) return false;
        return n.contains('copy')
            || n.contains('certificate')
            || n.contains('documentation')
            || n.contains('license')
            || n.contains('cv')
            || n.contains('resume')
            || n.contains('coi');
    }
}
