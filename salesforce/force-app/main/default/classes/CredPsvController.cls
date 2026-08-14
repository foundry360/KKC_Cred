public with sharing class CredPsvController {
    public class VerificationRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String sourceName;
        @AuraEnabled public String sourceMode;
        @AuraEnabled public String verificationType;
        @AuraEnabled public String status;
        @AuraEnabled public String resultSummary;
        @AuraEnabled public String sourceUrl;
        @AuraEnabled public Datetime retrievedAt;
        @AuraEnabled public String verifiedBy;
    }

    public class ExceptionRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String exceptionType;
        @AuraEnabled public String severity;
        @AuraEnabled public String description;
        @AuraEnabled public String source;
        @AuraEnabled public String status;
    }

    public class PsvDashboard {
        @AuraEnabled public String applicationName;
        @AuraEnabled public String providerName;
        @AuraEnabled public String psvStatus;
        @AuraEnabled public Decimal readinessScore;
        @AuraEnabled public Datetime psvRanAt;
        @AuraEnabled public List<VerificationRow> verifications;
        @AuraEnabled public List<ExceptionRow> exceptions;
        @AuraEnabled public String disclaimer;
    }

    @AuraEnabled(cacheable=true)
    public static PsvDashboard getDashboard(Id applicationId) {
        PsvDashboard dash = new PsvDashboard();
        dash.verifications = new List<VerificationRow>();
        dash.exceptions = new List<ExceptionRow>();
        dash.disclaimer =
            'Credentialing Readiness is a POC workflow indicator — not a regulatory or compliance determination.';

        if (applicationId == null) {
            return dash;
        }

        List<Credentialing_Application__c> apps = [
            SELECT Id, Name, PSV_Status__c, Readiness_Score__c, PSV_Ran_At__c,
                   Provider__r.Name
            FROM Credentialing_Application__c
            WHERE Id = :applicationId
            LIMIT 1
        ];
        if (apps.isEmpty()) {
            return dash;
        }

        Credentialing_Application__c app = apps[0];
        dash.applicationName = app.Name;
        dash.providerName = app.Provider__r != null ? app.Provider__r.Name : null;
        dash.psvStatus = app.PSV_Status__c;
        dash.readinessScore = app.Readiness_Score__c;
        dash.psvRanAt = app.PSV_Ran_At__c;

        for (PSV_Verification__c v : [
            SELECT Id, Name, Source_Name__c, Source_Mode__c, Verification_Type__c,
                   Status__c, Result_Summary__c, Source_URL__c, Retrieved_At__c, Verified_By__c
            FROM PSV_Verification__c
            WHERE Credentialing_Application__c = :applicationId
            ORDER BY Retrieved_At__c DESC NULLS LAST, CreatedDate DESC
        ]) {
            VerificationRow row = new VerificationRow();
            row.id = v.Id;
            row.name = v.Name;
            row.sourceName = v.Source_Name__c;
            row.sourceMode = v.Source_Mode__c;
            row.verificationType = v.Verification_Type__c;
            row.status = v.Status__c;
            row.resultSummary = v.Result_Summary__c;
            row.sourceUrl = v.Source_URL__c;
            row.retrievedAt = v.Retrieved_At__c;
            row.verifiedBy = v.Verified_By__c;
            dash.verifications.add(row);
        }

        for (PSV_Exception__c e : [
            SELECT Id, Name, Exception_Type__c, Severity__c, Description__c, Source__c, Status__c
            FROM PSV_Exception__c
            WHERE Credentialing_Application__c = :applicationId
            ORDER BY CreatedDate DESC
        ]) {
            ExceptionRow row = new ExceptionRow();
            row.id = e.Id;
            row.name = e.Name;
            row.exceptionType = e.Exception_Type__c;
            row.severity = e.Severity__c;
            row.description = e.Description__c;
            row.source = e.Source__c;
            row.status = e.Status__c;
            dash.exceptions.add(row);
        }

        return dash;
    }
}
