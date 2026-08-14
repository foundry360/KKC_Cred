public with sharing class CredDashboardController {
    public class MicroCounts {
        @AuraEnabled public Integer openCases;
        @AuraEnabled public Integer credentialsExpiringSoon;
        @AuraEnabled public Integer activeProviders;
        @AuraEnabled public Integer pendingApplications;
        @AuraEnabled public Integer recredDue;
    }

    public class ChartSlice {
        @AuraEnabled public String key;
        @AuraEnabled public String label;
        @AuraEnabled public Integer value;
        @AuraEnabled public Decimal percent;
        @AuraEnabled public String color;
    }

    public class AppQueueRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String providerName;
        @AuraEnabled public Id providerId;
        @AuraEnabled public String applicationType;
        @AuraEnabled public String pathValue;
        @AuraEnabled public String status;
        @AuraEnabled public String subjectType;
        @AuraEnabled public Decimal attemptCount;
        @AuraEnabled public Date dueDate;
        @AuraEnabled public String recordUrl;
        @AuraEnabled public String providerUrl;
    }

    public class CredQueueRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String providerName;
        @AuraEnabled public Id providerId;
        @AuraEnabled public String credentialType;
        @AuraEnabled public String status;
        @AuraEnabled public Date expirationDate;
        @AuraEnabled public String providerUrl;
    }

    public class RecredQueueRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String externalId;
        @AuraEnabled public String subjectType;
        @AuraEnabled public String status;
        @AuraEnabled public Date recredDueDate;
        @AuraEnabled public String recordUrl;
    }

    public class DashboardSummary {
        @AuraEnabled public MicroCounts counts;
        @AuraEnabled public List<ChartSlice> openApplicationStages;
        @AuraEnabled public List<ChartSlice> openCaseWorkload;
        @AuraEnabled public List<ChartSlice> missingDocuments;
        @AuraEnabled public List<ChartSlice> providerProfileHealth;
        @AuraEnabled public List<AppQueueRow> chaseQueue;
        @AuraEnabled public List<AppQueueRow> committeeQueue;
        @AuraEnabled public List<CredQueueRow> expiringCredentials;
        @AuraEnabled public List<RecredQueueRow> recredQueue;
    }

    private static final List<String> OPEN_APP_STATUSES = new List<String>{
        'Draft', 'Intake', 'In_Review', 'Pending_Committee'
    };

    private static final Map<String, String> APP_STATUS_LABELS = new Map<String, String>{
        'Draft' => 'Draft',
        'Intake' => 'Intake',
        'In_Review' => 'In Review',
        'Pending_Committee' => 'Pending Committee'
    };

    private static final List<String> CHART_COLORS = new List<String>{
        '#0288D1', '#29B6F6', '#4FC3F7', '#81D4FA', '#B3E5FC', '#0288D1', '#29B6F6', '#4FC3F7'
    };

    @AuraEnabled(cacheable=true)
    public static DashboardSummary getSummary() {
        Date today = Date.today();
        Date in90 = today.addDays(90);
        Date in120 = today.addDays(120);

        MicroCounts counts = new MicroCounts();
        counts.openCases = [SELECT COUNT() FROM Case WHERE IsClosed = false];
        counts.credentialsExpiringSoon = [
            SELECT COUNT() FROM Provider_Credential__c
            WHERE Status__c = 'Expiring_Soon'
               OR (Expiration_Date__c >= :today AND Expiration_Date__c <= :in90)
        ];
        counts.activeProviders = [
            SELECT COUNT() FROM Provider__c WHERE Credentialing_Status__c = 'Active'
        ];
        counts.pendingApplications = [
            SELECT COUNT() FROM Credentialing_Application__c
            WHERE Status__c IN :OPEN_APP_STATUSES
        ];
        counts.recredDue = [
            SELECT COUNT() FROM Provider__c
            WHERE Recred_Due_Date__c >= :today AND Recred_Due_Date__c <= :in120
        ];

        DashboardSummary summary = new DashboardSummary();
        summary.counts = counts;
        summary.openApplicationStages = buildOpenApplicationStages();
        summary.openCaseWorkload = buildOpenCaseWorkload();
        summary.missingDocuments = buildMissingDocuments();
        summary.providerProfileHealth = buildProviderProfileHealth();
        summary.chaseQueue = mapApps([
            SELECT Id, Name, Application_Type__c, Path__c, Status__c, Subject_Type__c,
                   Attempt_Count__c, Due_Date__c, Provider__c, Provider__r.Name
            FROM Credentialing_Application__c
            WHERE Status__c = 'Intake'
            ORDER BY Due_Date__c ASC NULLS LAST
            LIMIT 8
        ]);
        summary.committeeQueue = mapApps([
            SELECT Id, Name, Application_Type__c, Path__c, Status__c, Subject_Type__c,
                   Attempt_Count__c, Due_Date__c, Provider__c, Provider__r.Name
            FROM Credentialing_Application__c
            WHERE Status__c = 'Pending_Committee'
            ORDER BY Due_Date__c ASC NULLS LAST
            LIMIT 8
        ]);
        summary.expiringCredentials = mapCreds([
            SELECT Id, Name, Credential_Type__c, Status__c, Expiration_Date__c,
                   Provider__c, Provider__r.Name
            FROM Provider_Credential__c
            WHERE Status__c IN ('Expired', 'Expiring_Soon')
               OR Expiration_Date__c < :today
               OR (Expiration_Date__c >= :today AND Expiration_Date__c <= :in90)
            ORDER BY Expiration_Date__c ASC NULLS LAST
            LIMIT 8
        ]);
        summary.recredQueue = mapRecred([
            SELECT Id, Name, External_Id__c, Subject_Type__c, Credentialing_Status__c, Recred_Due_Date__c
            FROM Provider__c
            WHERE Recred_Due_Date__c <= :in120
            ORDER BY Recred_Due_Date__c ASC NULLS LAST
            LIMIT 8
        ]);
        return summary;
    }

    private static List<ChartSlice> buildOpenApplicationStages() {
        Map<String, Integer> byStatus = new Map<String, Integer>();
        for (String statusValue : OPEN_APP_STATUSES) {
            byStatus.put(statusValue, 0);
        }
        for (AggregateResult ar : [
            SELECT Status__c statusValue, COUNT(Id) cnt
            FROM Credentialing_Application__c
            WHERE Status__c IN :OPEN_APP_STATUSES
            GROUP BY Status__c
        ]) {
            byStatus.put((String) ar.get('statusValue'), (Integer) ar.get('cnt'));
        }

        List<ChartSlice> raw = new List<ChartSlice>();
        for (String statusValue : OPEN_APP_STATUSES) {
            ChartSlice slice = new ChartSlice();
            slice.key = statusValue;
            slice.label = APP_STATUS_LABELS.containsKey(statusValue)
                ? APP_STATUS_LABELS.get(statusValue)
                : statusValue;
            slice.value = byStatus.get(statusValue);
            raw.add(slice);
        }
        return withPercentsAndColors(raw);
    }

    private static List<ChartSlice> buildOpenCaseWorkload() {
        // Open applications by subject type (Provider vs Facility).
        Map<String, Integer> bySubject = new Map<String, Integer>{
            'Practitioner' => 0,
            'Facility' => 0
        };
        for (AggregateResult ar : [
            SELECT Subject_Type__c subjectType, COUNT(Id) cnt
            FROM Credentialing_Application__c
            WHERE Status__c IN :OPEN_APP_STATUSES
            GROUP BY Subject_Type__c
        ]) {
            String subjectType = (String) ar.get('subjectType');
            if (String.isBlank(subjectType)) {
                subjectType = 'Unspecified';
            }
            bySubject.put(subjectType, (Integer) ar.get('cnt'));
        }

        List<ChartSlice> raw = new List<ChartSlice>();
        for (String subjectType : bySubject.keySet()) {
            Integer value = bySubject.get(subjectType);
            if (value == null || value == 0) {
                continue;
            }
            ChartSlice slice = new ChartSlice();
            slice.key = subjectType;
            slice.label = subjectTypeLabel(subjectType);
            slice.value = value;
            raw.add(slice);
        }
        raw.sort(new ChartSliceValueDescComparator());
        return withPercentsAndColors(raw);
    }

    private static String subjectTypeLabel(String subjectType) {
        if (subjectType == 'Practitioner') {
            return 'Provider';
        }
        if (subjectType == 'Facility') {
            return 'Facility';
        }
        return subjectType;
    }

    private static List<ChartSlice> buildMissingDocuments() {
        List<ChartSlice> raw = new List<ChartSlice>();
        for (AggregateResult ar : [
            SELECT Item_Key__c itemKey, COUNT(Id) cnt
            FROM Checklist_Item__c
            WHERE Required__c = true AND Complete__c = false
            GROUP BY Item_Key__c
            ORDER BY COUNT(Id) DESC
            LIMIT 8
        ]) {
            String key = (String) ar.get('itemKey');
            if (String.isBlank(key)) {
                key = 'unknown';
            }
            ChartSlice slice = new ChartSlice();
            slice.key = key;
            slice.label = humanizeKey(key);
            slice.value = (Integer) ar.get('cnt');
            raw.add(slice);
        }
        return withPercentsAndColors(raw);
    }

    private static List<ChartSlice> buildProviderProfileHealth() {
        Integer activeCount = [
            SELECT COUNT() FROM Provider__c WHERE Credentialing_Status__c = 'Active'
        ];
        Integer incompleteCount = [
            SELECT COUNT() FROM Provider__c
            WHERE Credentialing_Status__c IN ('Pending', 'Inactive')
        ];

        List<ChartSlice> raw = new List<ChartSlice>();
        ChartSlice active = new ChartSlice();
        active.key = 'Active';
        active.label = 'Active Providers';
        active.value = activeCount;
        active.color = '#0288D1';
        raw.add(active);

        ChartSlice incomplete = new ChartSlice();
        incomplete.key = 'Pending';
        incomplete.label = 'Pending / Inactive Profiles';
        incomplete.value = incompleteCount;
        incomplete.color = '#4FC3F7';
        raw.add(incomplete);

        return withPercents(raw);
    }

    private static List<ChartSlice> withPercents(List<ChartSlice> slices) {
        Integer total = 0;
        for (ChartSlice slice : slices) {
            total += slice.value == null ? 0 : slice.value;
        }
        for (Integer i = 0; i < slices.size(); i++) {
            ChartSlice slice = slices[i];
            if (String.isBlank(slice.color)) {
                slice.color = CHART_COLORS[Math.mod(i, CHART_COLORS.size())];
            }
            if (total == 0) {
                slice.percent = 0;
            } else {
                slice.percent = ((Decimal) slice.value * 100 / total).setScale(1);
            }
        }
        return slices;
    }

    private static List<ChartSlice> withPercentsAndColors(List<ChartSlice> slices) {
        for (Integer i = 0; i < slices.size(); i++) {
            slices[i].color = CHART_COLORS[Math.mod(i, CHART_COLORS.size())];
        }
        return withPercents(slices);
    }

    private static String humanizeKey(String key) {
        if (String.isBlank(key)) {
            return 'Unknown';
        }
        Set<String> acronyms = new Set<String>{ 'coi', 'caqh', 'npi', 'dea', 'tin', 'ssn' };
        List<String> parts = key.replace('_', ' ').toLowerCase().split(' ');
        List<String> titled = new List<String>();
        for (String part : parts) {
            if (String.isBlank(part)) {
                continue;
            }
            if (acronyms.contains(part)) {
                titled.add(part.toUpperCase());
            } else {
                titled.add(part.substring(0, 1).toUpperCase() + part.substring(1));
            }
        }
        return String.join(titled, ' ');
    }

    private class ChartSliceValueDescComparator implements Comparator<ChartSlice> {
        public Integer compare(ChartSlice a, ChartSlice b) {
            Integer av = a.value == null ? 0 : a.value;
            Integer bv = b.value == null ? 0 : b.value;
            if (av == bv) {
                return 0;
            }
            return av > bv ? -1 : 1;
        }
    }

    private static List<AppQueueRow> mapApps(List<Credentialing_Application__c> records) {
        List<AppQueueRow> rows = new List<AppQueueRow>();
        for (Credentialing_Application__c a : records) {
            AppQueueRow row = new AppQueueRow();
            row.id = a.Id;
            row.name = a.Name;
            row.providerId = a.Provider__c;
            row.providerName = a.Provider__r != null ? a.Provider__r.Name : null;
            row.applicationType = a.Application_Type__c;
            row.pathValue = a.Path__c;
            row.status = a.Status__c;
            row.subjectType = a.Subject_Type__c;
            row.attemptCount = a.Attempt_Count__c;
            row.dueDate = a.Due_Date__c;
            row.recordUrl = '/' + a.Id;
            row.providerUrl = a.Provider__c != null ? '/' + a.Provider__c : null;
            rows.add(row);
        }
        return rows;
    }

    private static List<CredQueueRow> mapCreds(List<Provider_Credential__c> records) {
        List<CredQueueRow> rows = new List<CredQueueRow>();
        for (Provider_Credential__c c : records) {
            CredQueueRow row = new CredQueueRow();
            row.id = c.Id;
            row.name = c.Name;
            row.providerId = c.Provider__c;
            row.providerName = c.Provider__r != null ? c.Provider__r.Name : null;
            row.credentialType = c.Credential_Type__c;
            row.status = c.Status__c;
            row.expirationDate = c.Expiration_Date__c;
            row.providerUrl = c.Provider__c != null ? '/' + c.Provider__c : null;
            rows.add(row);
        }
        return rows;
    }

    private static List<RecredQueueRow> mapRecred(List<Provider__c> records) {
        List<RecredQueueRow> rows = new List<RecredQueueRow>();
        for (Provider__c p : records) {
            RecredQueueRow row = new RecredQueueRow();
            row.id = p.Id;
            row.name = p.Name;
            row.externalId = p.External_Id__c;
            row.subjectType = p.Subject_Type__c;
            row.status = p.Credentialing_Status__c;
            row.recredDueDate = p.Recred_Due_Date__c;
            row.recordUrl = '/' + p.Id;
            rows.add(row);
        }
        return rows;
    }
}
