@IsTest
private class CredAssistControllerTest {
    private class AssistMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);
            Map<String, Object> assist = new Map<String, Object>{
                'summary' => req.getEndpoint().contains('/api/cred-assist')
                    ? 'Bridge summary'
                    : 'Claude summary',
                'missingItems' => new List<String>{ 'Medical license copy' },
                'draftNote' => req.getEndpoint().contains('/api/cred-assist')
                    ? 'Bridge draft'
                    : 'Claude draft',
                'nextAction' => 'Follow up with provider',
                'intakeSummary' => 'Intake reviewed',
                'reconciledNames' => new List<String>{
                    'Name variants appear to be the same person (John A. Smith; John Smith MD).'
                },
                'exceptions' => new List<String>{
                    'Specialty mismatch across sources requires review.'
                }
            };
            if (req.getEndpoint().contains('/api/cred-assist')) {
                res.setBody(JSON.serialize(new Map<String, Object>{ 'data' => assist }));
            } else {
                res.setBody(
                    JSON.serialize(
                        new Map<String, Object>{
                            'content' => new List<Object>{
                                new Map<String, Object>{
                                    'type' => 'text',
                                    'text' => JSON.serialize(assist)
                                }
                            }
                        }
                    )
                );
            }
            return res;
        }
    }

    private static Id seedIncompleteApp() {
        Provider__c p = new Provider__c(
            Name = 'Assist Provider',
            External_Id__c = 'PRV-ASSIST-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Subject_Type__c = 'Practitioner',
            Specialty__c = 'Cardiology',
            Credentialing_Status__c = 'Active'
        );
        insert p;

        insert new Provider_Credential__c(
            Provider__c = p.Id,
            External_Id__c = 'CRED-ASSIST-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Credential_Type__c = 'Medical_License',
            Status__c = 'Valid',
            Expiration_Date__c = Date.today().addDays(200)
        );

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-ASSIST-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 1,
            Due_Date__c = Date.today().addDays(7)
        );
        insert app;

        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-ASSIST-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Name = 'Medical license copy',
            Item_Key__c = 'medical_license_copy',
            Required__c = true,
            Complete__c = false,
            Sort_Order__c = 1
        );
        return app.Id;
    }

    @IsTest
    static void localAssistAndTask() {
        CredAssistController.testConfigOverride = null;
        Id appId = seedIncompleteApp();
        Test.startTest();
        CredAssistController.AssistResult result = CredAssistController.assist(appId);
        System.assertEquals('local', result.source);
        System.assert(!result.missingItems.isEmpty());
        System.assertNotEquals(null, result.completenessScore);
        System.assert(result.completenessScore >= 0 && result.completenessScore <= 100);
        System.assert(String.isNotBlank(result.completenessExplainer));

        CredAssistController.AssistResult taskResult =
            CredAssistController.createTaskFromDraft(appId, result.draftNote, 'Test chase task');
        System.assertNotEquals(null, taskResult.taskId);
        Test.stopTest();
    }

    @IsTest
    static void completeChecklistLocalPath() {
        CredAssistController.testConfigOverride = null;
        Id appId = seedIncompleteApp();
        List<Checklist_Item__c> items = [
            SELECT Id, Complete__c FROM Checklist_Item__c WHERE Credentialing_Application__c = :appId
        ];
        for (Checklist_Item__c item : items) {
            item.Complete__c = true;
        }
        update items;

        Test.startTest();
        CredAssistController.AssistResult result = CredAssistController.assist(appId);
        Test.stopTest();
        System.assertEquals(0, result.missingItems.size());
        System.assert(result.summary.contains('checklist-complete'));
    }

    @IsTest
    static void claudeCalloutPath() {
        Id appId = seedIncompleteApp();
        Cred_Assist_Config__mdt cfg = new Cred_Assist_Config__mdt(
            DeveloperName = 'Default',
            MasterLabel = 'Default',
            Claude_Api_Key__c = 'test-key',
            Model__c = 'claude-test'
        );
        CredAssistController.testConfigOverride = cfg;

        Test.setMock(HttpCalloutMock.class, new AssistMock());
        Test.startTest();
        CredAssistController.AssistResult result = CredAssistController.assist(appId);
        Test.stopTest();
        System.assertEquals(
            'claude',
            result.source,
            'summary=' + result.summary + ' err=' + CredAssistController.lastCalloutError
        );
        System.assert(result.draftNote.contains('Claude'));
    }

    @IsTest
    static void bridgeCalloutPath() {
        Id appId = seedIncompleteApp();
        Cred_Assist_Config__mdt cfg = new Cred_Assist_Config__mdt(
            DeveloperName = 'Default',
            MasterLabel = 'Default',
            Bridge_URL__c = 'https://example.test',
            Bridge_Secret__c = 'secret'
        );
        CredAssistController.testConfigOverride = cfg;

        Test.setMock(HttpCalloutMock.class, new AssistMock());
        Test.startTest();
        CredAssistController.AssistResult result = CredAssistController.assist(appId);
        Test.stopTest();
        System.assertEquals('claude', result.source, 'summary=' + result.summary);
        System.assert(result.draftNote.contains('Bridge'));
    }

    @IsTest
    static void intakeReconcilesNamesAndFlagsSpecialty() {
        CredAssistController.testConfigOverride = null;
        System.assertEquals(
            true,
            CredAssistController.namesCompatible('John A. Smith', 'John Smith MD')
        );
        System.assertEquals(
            true,
            CredAssistController.namesCompatible('John Smith MD', 'John Andrew Smith')
        );
        System.assertEquals(
            false,
            CredAssistController.namesCompatible('John Smith', 'Jane Smith')
        );
        System.assertEquals('CARDIOLOGY', CredAssistController.specialtyFamily('Cardiology'));
        System.assertEquals('INTERNAL_MEDICINE', CredAssistController.specialtyFamily('Internal Medicine'));
        System.assertEquals(
            'CARDIOTHORACIC',
            CredAssistController.specialtyFamily('Cardiothoracic Surgery')
        );

        Provider__c p = new Provider__c(
            Name = 'John Andrew Smith',
            First_Name__c = 'John',
            Middle_Name__c = 'A',
            Last_Name__c = 'Smith',
            External_Id__c = 'PRV-INTAKE-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Subject_Type__c = 'Practitioner',
            Specialty__c = 'Cardiothoracic Surgery',
            Credentialing_Status__c = 'Pending'
        );
        insert p;

        insert new Provider_Credential__c(
            Provider__c = p.Id,
            External_Id__c = 'CRED-LIC-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Credential_Type__c = 'Medical_License',
            Status__c = 'Valid'
        );
        insert new Provider_Credential__c(
            Provider__c = p.Id,
            External_Id__c = 'CRED-BRD-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Credential_Type__c = 'Board_Certification',
            Issuing_Authority__c = 'Internal Medicine',
            Status__c = 'Valid'
        );
        insert new Education_History__c(
            Provider__c = p.Id,
            External_Id__c = 'EDU-INTAKE-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Institution_Name__c = 'State University',
            Degree_Type__c = 'MD',
            Field_Of_Study__c = 'Cardiology'
        );

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-INTAKE-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0
        );
        insert app;

        insert new ContentVersion(
            Title = 'John_A_Smith_CV',
            PathOnClient = 'John_A_Smith_CV.pdf',
            VersionData = Blob.valueOf('cv'),
            FirstPublishLocationId = app.Id
        );

        // Simulate license-presented name via a second document title
        insert new ContentVersion(
            Title = 'John_Smith_MD_License',
            PathOnClient = 'John_Smith_MD_License.pdf',
            VersionData = Blob.valueOf('license'),
            FirstPublishLocationId = app.Id
        );

        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-INTAKE-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Name = 'Medical license copy',
            Item_Key__c = 'medical_license_copy',
            Required__c = true,
            Complete__c = true,
            Sort_Order__c = 1
        );

        Test.startTest();
        CredAssistController.AssistResult result = CredAssistController.assist(app.Id);
        Test.stopTest();

        System.assertEquals(true, result.hasExceptions, 'Specialty conflict should exception');
        System.assert(!result.exceptions.isEmpty());
        System.assert(!result.reconciledNames.isEmpty(), 'Name variants should reconcile');
        System.assertNotEquals(null, result.intakeSummary);
    }

    @IsTest
    static void providerScopedAssistCompleteness() {
        CredAssistController.testConfigOverride = null;
        Provider__c p = new Provider__c(
            Name = 'Provider 360 Assist',
            First_Name__c = 'Pat',
            Last_Name__c = 'Assist',
            External_Id__c = 'PRV-360-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Subject_Type__c = 'Practitioner',
            Specialty__c = 'Cardiology',
            Credentialing_Status__c = 'Pending'
            // NPI and DOB intentionally blank for completeness gaps
        );
        insert p;

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = p.Id,
            External_Id__c = 'APP-360-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 0,
            Due_Date__c = Date.today().addDays(5)
        );
        insert app;

        insert new Checklist_Item__c(
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-360-' + String.valueOf(Math.abs(Crypto.getRandomInteger())),
            Name = 'Medical license copy',
            Item_Key__c = 'medical_license_copy',
            Required__c = true,
            Complete__c = false,
            Sort_Order__c = 1
        );

        Test.startTest();
        CredAssistController.AssistResult result = CredAssistController.assist(p.Id);
        Test.stopTest();

        System.assertEquals('local', result.source);
        System.assert(
            (result.completenessGaps != null && !result.completenessGaps.isEmpty())
                || (result.insights != null && !result.insights.isEmpty()),
            'Provider-scoped assist should populate completenessGaps or insights'
        );
        System.assertNotEquals(null, result.intakeSummary);
        System.assert(!result.missingItems.isEmpty(), 'Open incomplete checklist should surface');
    }
}
