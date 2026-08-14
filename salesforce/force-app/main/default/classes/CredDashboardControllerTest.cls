@IsTest
private class CredDashboardControllerTest {
    @IsTest
    static void getSummaryReturnsCountsAndQueues() {
        Provider__c active = new Provider__c(
            Name = 'Dash Provider',
            External_Id__c = 'PRV-DASH-1',
            Subject_Type__c = 'Practitioner',
            Specialty__c = 'Cardiology',
            Credentialing_Status__c = 'Active',
            Recred_Due_Date__c = Date.today().addDays(30)
        );
        Provider__c pending = new Provider__c(
            Name = 'Pending Provider',
            External_Id__c = 'PRV-DASH-2',
            Subject_Type__c = 'Facility',
            Specialty__c = 'Imaging',
            Credentialing_Status__c = 'Pending'
        );
        insert new List<Provider__c>{ active, pending };

        insert new Provider_Credential__c(
            Provider__c = active.Id,
            External_Id__c = 'CRED-DASH-1',
            Credential_Type__c = 'Medical_License',
            Status__c = 'Expiring_Soon',
            Expiration_Date__c = Date.today().addDays(20)
        );

        Credentialing_Application__c app = new Credentialing_Application__c(
            Provider__c = active.Id,
            External_Id__c = 'APP-DASH-1',
            Application_Type__c = 'New',
            Path__c = 'CAQH',
            Status__c = 'Intake',
            Subject_Type__c = 'Practitioner',
            Attempt_Count__c = 1,
            Due_Date__c = Date.today().addDays(10)
        );
        insert app;

        insert new Checklist_Item__c(
            Name = 'Malpractice COI',
            Credentialing_Application__c = app.Id,
            External_Id__c = 'CHK-DASH-1',
            Item_Key__c = 'malpractice_coi',
            Required__c = true,
            Complete__c = false,
            Sort_Order__c = 1
        );

        insert new Credentialing_Application__c(
            Provider__c = pending.Id,
            External_Id__c = 'APP-DASH-2',
            Application_Type__c = 'New',
            Path__c = 'Facility',
            Status__c = 'Draft',
            Subject_Type__c = 'Facility',
            Attempt_Count__c = 0
        );

        insert new Case(
            Subject = 'Dashboard open case',
            Status = 'New',
            Origin = 'Web',
            Type = 'Electrical'
        );

        Test.startTest();
        CredDashboardController.DashboardSummary summary = CredDashboardController.getSummary();
        Test.stopTest();

        System.assert(summary.counts.activeProviders >= 1);
        System.assert(summary.counts.pendingApplications >= 1);
        System.assert(summary.counts.credentialsExpiringSoon >= 1);
        System.assert(summary.counts.recredDue >= 1);
        System.assert(summary.counts.openCases >= 1);
        System.assert(!summary.openApplicationStages.isEmpty());
        System.assertEquals(2, summary.openCaseWorkload.size());
        Boolean hasProvider = false;
        Boolean hasFacility = false;
        for (CredDashboardController.ChartSlice slice : summary.openCaseWorkload) {
            if (slice.label == 'Provider') {
                hasProvider = true;
            }
            if (slice.label == 'Facility') {
                hasFacility = true;
            }
        }
        System.assert(hasProvider);
        System.assert(hasFacility);
        System.assert(!summary.missingDocuments.isEmpty());
        System.assertEquals(2, summary.providerProfileHealth.size());
        System.assert(!summary.chaseQueue.isEmpty());
        System.assert(!summary.expiringCredentials.isEmpty());
        System.assert(!summary.recredQueue.isEmpty());
    }
}
