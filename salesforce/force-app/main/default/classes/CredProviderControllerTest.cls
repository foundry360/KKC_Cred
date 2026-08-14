@IsTest
private class CredProviderControllerTest {
    @IsTest
    static void coversListAndDetail() {
        Provider__c p = new Provider__c(
            Name = 'Test Provider',
            External_Id__c = 'PRV-TEST-LWC',
            Subject_Type__c = 'Practitioner',
            NPI__c = '1234567890',
            Specialty__c = 'Cardiology',
            Organization_Name__c = 'Test Group',
            Credentialing_Status__c = 'Active',
            Recred_Due_Date__c = Date.today().addDays(100)
        );
        insert p;

        insert new Provider_Credential__c(
            Provider__c = p.Id,
            External_Id__c = 'CRED-TEST-LWC',
            Credential_Type__c = 'Medical_License',
            Credential_Number__c = 'MD-1',
            Status__c = 'Valid',
            Expiration_Date__c = Date.today().addDays(200)
        );

        insert new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-TEST-LWC',
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Draft',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0
        );

        insert new Education_History__c(
            Provider__c = p.Id,
            External_Id__c = 'EDU-TEST-LWC',
            Institution_Name__c = 'State University',
            Degree_Type__c = 'MD',
            Field_Of_Study__c = 'Medicine',
            Graduation_Year__c = 2012
        );

        insert new Work_History__c(
            Provider__c = p.Id,
            External_Id__c = 'WRK-TEST-LWC',
            Employer_Name__c = 'City Hospital',
            Title__c = 'Attending Physician',
            Is_Current__c = true,
            Start_Date__c = Date.today().addYears(-3)
        );

        p.Date_Of_Birth__c = Date.newInstance(1980, 5, 15);
        p.Gender__c = 'Female';
        p.SSN_Last_4__c = '1234';
        p.CAQH_ID__c = 'CAQH-TEST';
        p.Practice_State__c = 'NY';
        update p;

        insert new Provider_Address__c(
            Provider__c = p.Id,
            External_Id__c = 'ADDR-TEST-HOME',
            Address_Type__c = 'Home',
            Line1__c = '100 Main St',
            City__c = 'Albany',
            State__c = 'NY',
            Postal_Code__c = '12207',
            Country__c = 'US',
            Is_Primary__c = true
        );

        Test.startTest();
        List<CredProviderController.ProviderRow> rows = CredProviderController.listProviders('Practitioner', 'Test');
        System.assert(!rows.isEmpty());
        CredProviderController.ProviderDetail detail = CredProviderController.getProvider(p.Id);
        System.assertEquals(p.Id, detail.id);
        System.assertEquals(1, CredProviderController.listCredentials(p.Id).size());
        System.assertEquals(1, CredProviderController.listApplications(p.Id).size());
        System.assertEquals(1, CredProviderController.listEducation(p.Id).size());
        System.assertEquals(1, CredProviderController.listWorkHistory(p.Id).size());
        System.assertEquals(1, CredProviderController.listAddresses(p.Id).size());
        System.assertEquals('CAQH-TEST', CredProviderController.getProvider(p.Id).caqhId);
        Test.stopTest();
    }

    @IsTest
    static void coversDeleteProvider() {
        Provider__c p = new Provider__c(
            Name = 'Delete Me Provider',
            External_Id__c = 'PRV-TEST-DEL',
            Subject_Type__c = 'Practitioner',
            Credentialing_Status__c = 'Pending'
        );
        insert p;

        insert new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-TEST-DEL',
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Draft',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0
        );

        insert new Provider_Credential__c(
            Provider__c = p.Id,
            External_Id__c = 'CRED-TEST-DEL',
            Credential_Type__c = 'Medical_License',
            Credential_Number__c = 'MD-DEL',
            Status__c = 'Valid'
        );

        Test.startTest();
        CredProviderController.deleteProvider(p.Id);
        Test.stopTest();

        System.assertEquals(
            0,
            [SELECT COUNT() FROM Provider__c WHERE Id = :p.Id],
            'Provider should be deleted'
        );
        System.assertEquals(
            0,
            [SELECT COUNT() FROM Credentialing_Application__c WHERE External_Id__c = 'APP-TEST-DEL'],
            'Applications should be deleted with provider'
        );
    }
}
