@IsTest
private class CredApplicationFilesControllerTest {
    @IsTest
    static void listsOnlyDocumentRequirements() {
        Provider__c p = new Provider__c(
            Name = 'Files Test Provider',
            External_Id__c = 'PRV-FILE-TEST',
            Subject_Type__c = 'Practitioner',
            Credentialing_Status__c = 'Pending'
        );
        insert p;

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-FILE-TEST',
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0
        );
        insert app;

        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-FILE-LICENSE',
            Name = 'Medical license copy',
            Item_Key__c = 'medical_license_copy',
            Required__c = true,
            Complete__c = false,
            Sort_Order__c = 1
        );
        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-FILE-CAQH',
            Name = 'CAQH attestation',
            Item_Key__c = 'caqh_attestation',
            Required__c = true,
            Complete__c = true,
            Sort_Order__c = 5
        );

        ContentVersion cv = new ContentVersion(
            Title = 'State License Copy',
            PathOnClient = 'license.pdf',
            VersionData = Blob.valueOf('test-file'),
            FirstPublishLocationId = app.Id
        );
        insert cv;

        Test.startTest();
        List<CredApplicationFilesController.DocumentRequirementRow> rows =
            CredApplicationFilesController.listDocumentRequirements(app.Id);
        Test.stopTest();

        System.assertEquals(1, rows.size(), 'Only document items should appear');
        System.assertEquals('Medical license copy', rows[0].name);
        System.assertEquals(true, rows[0].complete);
        System.assertNotEquals(null, rows[0].contentDocumentId);
    }
}
