@IsTest
private class CredApplicationChecklistControllerTest {
    @IsTest
    static void listsFourCategoryRowsAndExcludesDocuments() {
        Provider__c p = new Provider__c(
            Name = 'Data Checklist Provider',
            External_Id__c = 'PRV-DATA-CHK',
            Subject_Type__c = 'Practitioner',
            First_Name__c = 'Ada',
            Last_Name__c = 'Lovelace',
            NPI__c = '1234567890',
            Date_Of_Birth__c = Date.newInstance(1980, 1, 1),
            Specialty__c = 'Cardiology',
            Email__c = 'ada@example.com',
            Phone__c = '555-0100',
            Credentialing_Status__c = 'Pending'
        );
        insert p;

        insert new Provider_Address__c(
            Provider__c = p.Id,
            External_Id__c = 'ADDR-DATA-CHK',
            Address_Type__c = 'Work',
            Line1__c = '1 Main St',
            City__c = 'Austin',
            State__c = 'TX',
            Postal_Code__c = '78701'
        );
        insert new Education_History__c(
            Provider__c = p.Id,
            External_Id__c = 'EDU-DATA-CHK',
            Institution_Name__c = 'State U',
            Degree_Type__c = 'MD'
        );
        insert new Work_History__c(
            Provider__c = p.Id,
            External_Id__c = 'WRK-DATA-CHK',
            Employer_Name__c = 'Clinic',
            Title__c = 'Physician'
        );
        insert new Provider_Credential__c(
            Provider__c = p.Id,
            External_Id__c = 'CRD-DATA-CHK',
            Credential_Type__c = 'Medical_License',
            Credential_Number__c = 'L-1',
            Status__c = 'Valid'
        );

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-DATA-CHK',
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0
        );
        insert app;

        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-DATA-LICENSE',
            Name = 'Medical license copy',
            Item_Key__c = 'medical_license_copy',
            Required__c = true,
            Complete__c = false,
            Sort_Order__c = 1
        );
        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-DATA-CAQH',
            Name = 'CAQH attestation',
            Item_Key__c = 'caqh_attestation',
            Required__c = true,
            Complete__c = true,
            Sort_Order__c = 5
        );

        Test.startTest();
        List<CredApplicationChecklistController.DataRow> rows =
            CredApplicationChecklistController.listDataChecklist(app.Id);
        Test.stopTest();

        System.assertEquals(4, rows.size(), 'Expected Demographics, Profile, History, Attestation');
        Set<String> cats = new Set<String>();
        Boolean sawLicense = false;
        for (CredApplicationChecklistController.DataRow row : rows) {
            cats.add(row.category);
            System.assertEquals(true, row.complete, row.category + ' should be complete');
            if (row.name != null && row.name.toLowerCase().contains('license')) {
                sawLicense = true;
            }
        }
        System.assert(cats.contains('Demographics'));
        System.assert(cats.contains('Profile'));
        System.assert(cats.contains('History'));
        System.assert(cats.contains('Attestation'));
        System.assert(!sawLicense, 'Document checklist items should not appear on data checklist');
    }
}
