@IsTest
private class CredPsvControllerTest {
    @IsTest
    static void returnsDashboardForApplication() {
        Provider__c p = new Provider__c(
            Name = 'PSV Panel Provider',
            External_Id__c = 'PRV-PSV-PANEL',
            Subject_Type__c = 'Practitioner',
            Credentialing_Status__c = 'Pending'
        );
        insert p;

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-PSV-PANEL',
            Application_Type__c = 'New',
            Path__c = 'In_House',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0,
            PSV_Status__c = 'human_review',
            Readiness_Score__c = 42,
            PSV_Ran_At__c = System.now()
        );
        insert app;

        insert new PSV_Verification__c(
            Name = 'NPPES',
            Credentialing_Application__c = app.Id,
            External_Id__c = 'VER-PSV-PANEL-1',
            Source_Name__c = 'CMS NPPES NPI Registry',
            Source_Mode__c = 'live',
            Verification_Type__c = 'npi_verification',
            Status__c = 'not_verified',
            Result_Summary__c = 'NPI not found',
            Retrieved_At__c = System.now(),
            Verified_By__c = 'NPIProvider'
        );

        insert new PSV_Exception__c(
            Name = 'Mismatch',
            Credentialing_Application__c = app.Id,
            External_Id__c = 'EXC-PSV-PANEL-1',
            Exception_Type__c = 'mismatch',
            Severity__c = 'critical',
            Description__c = 'Identity discrepancy',
            Source__c = 'NPPES',
            Status__c = 'open'
        );

        Test.startTest();
        CredPsvController.PsvDashboard dash = CredPsvController.getDashboard(app.Id);
        Test.stopTest();

        System.assertEquals('human_review', dash.psvStatus);
        System.assertEquals(42, dash.readinessScore);
        System.assertEquals(1, dash.verifications.size());
        System.assertEquals(1, dash.exceptions.size());
        System.assertEquals('live', dash.verifications[0].sourceMode);
    }
}
