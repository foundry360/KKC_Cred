@IsTest
private class CredPortalIntakeTest {
    @IsTest
    static void createsProviderApplicationAndChecklist() {
        CredPortalIntake.IntakeRequest body = new CredPortalIntake.IntakeRequest();
        body.subjectType = 'practitioner';
        body.applicationType = 'new';
        body.path = 'caqh';
        body.provider = new CredPortalIntake.ProviderPayload();
        body.provider.displayName = 'Portal Test MD';
        body.provider.npi = '1999999999';
        body.provider.specialty = 'Family Medicine';
        body.provider.email = 'portal.test@example.com';
        body.checklistComplete = new Map<String, Boolean>{
            'medical_license_copy' => true,
            'dea_certificate' => true,
            'board_certification' => true,
            'malpractice_coi' => true,
            'caqh_attestation' => true
        };

        Test.startTest();
        CredPortalIntake.IntakeResponse result = CredPortalIntake.createIntakeInternal(body);
        Test.stopTest();

        System.assertNotEquals(null, result.providerId);
        System.assertNotEquals(null, result.applicationId);
        System.assertEquals('In_Review', result.status);
        System.assertEquals(5, result.checklistItems.size());

        Provider__c p = [
            SELECT Name, Subject_Type__c, NPI__c, Credentialing_Status__c
            FROM Provider__c
            WHERE Id = :result.providerId
        ];
        System.assertEquals('Portal Test MD', p.Name);
        System.assertEquals('Practitioner', p.Subject_Type__c);
        System.assertEquals('Pending', p.Credentialing_Status__c);

        Integer checklistCount = [
            SELECT COUNT()
            FROM Checklist_Item__c
            WHERE Credentialing_Application__c = :result.applicationId
        ];
        System.assertEquals(5, checklistCount);
    }

    @IsTest
    static void reusesExistingProviderByExternalId() {
        Provider__c existing = new Provider__c(
            Name = 'Existing Facility',
            External_Id__c = 'FAC-PORTAL-EXIST',
            Subject_Type__c = 'Facility',
            Credentialing_Status__c = 'Active'
        );
        insert existing;

        CredPortalIntake.IntakeRequest body = new CredPortalIntake.IntakeRequest();
        body.subjectType = 'facility';
        body.applicationType = 'recred';
        body.path = 'facility';
        body.providerExternalId = 'FAC-PORTAL-EXIST';
        body.provider = new CredPortalIntake.ProviderPayload();
        body.provider.displayName = 'Existing Facility Updated';
        body.checklistComplete = new Map<String, Boolean>();

        Test.startTest();
        CredPortalIntake.IntakeResponse result = CredPortalIntake.createIntakeInternal(body);
        Test.stopTest();

        System.assertEquals(existing.Id, result.providerId);
        System.assertEquals('Intake', result.status);
        System.assertEquals(1, [SELECT COUNT() FROM Provider__c WHERE External_Id__c = 'FAC-PORTAL-EXIST']);
    }

    @IsTest
    static void lookupFindsProviders() {
        insert new Provider__c(
            Name = 'Lookup Physician',
            External_Id__c = 'PRV-LOOKUP-1',
            Subject_Type__c = 'Practitioner',
            NPI__c = '1888888888',
            Credentialing_Status__c = 'Active'
        );

        Test.startTest();
        List<CredPortalIntake.LookupRow> rows = CredPortalIntake.lookupProvidersInternal('Lookup');
        Test.stopTest();

        System.assertEquals(1, rows.size());
        System.assertEquals('practitioner', rows[0].subjectType);
        System.assertEquals('1888888888', rows[0].npi);
    }

    @IsTest
    static void restPostAndGetEndpoints() {
        RestRequest postReq = new RestRequest();
        RestResponse postRes = new RestResponse();
        postReq.requestUri = '/services/apexrest/cred/portal/intake';
        postReq.httpMethod = 'POST';
        postReq.requestBody = Blob.valueOf(JSON.serialize(new Map<String, Object>{
            'subjectType' => 'practitioner',
            'applicationType' => 'new',
            'path' => 'in_house',
            'provider' => new Map<String, Object>{
                'displayName' => 'REST Provider',
                'npi' => '1777777777'
            },
            'checklistComplete' => new Map<String, Object>()
        }));
        RestContext.request = postReq;
        RestContext.response = postRes;

        Test.startTest();
        CredPortalIntake.createIntake();

        RestRequest getReq = new RestRequest();
        RestResponse getRes = new RestResponse();
        getReq.requestUri = '/services/apexrest/cred/portal/lookup';
        getReq.httpMethod = 'GET';
        getReq.addParameter('q', 'REST');
        RestContext.request = getReq;
        RestContext.response = getRes;
        CredPortalIntake.lookupProviders();
        Test.stopTest();

        System.assertEquals(200, postRes.statusCode);
        System.assertEquals(200, getRes.statusCode);
    }
}
