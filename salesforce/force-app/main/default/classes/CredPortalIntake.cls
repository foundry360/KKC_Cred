@RestResource(urlMapping='/cred/portal/*')
global with sharing class CredPortalIntake {
    global class ProviderPayload {
        public String displayName;
        public String npi;
        public String organizationName;
        public String specialty;
        public String facilityType;
        public String email;
        public String phone;
        public String firstName;
        public String lastName;
        public String externalId;
    }

    global class IntakeRequest {
        public String subjectType;
        public String applicationType;
        public String path;
        public String providerExternalId;
        public ProviderPayload provider;
        public Map<String, Boolean> checklistComplete;
    }

    global class IntakeResponse {
        public String providerId;
        public String providerExternalId;
        public String applicationId;
        public String applicationExternalId;
        public String status;
        public String providerName;
        public List<ChecklistItemResult> checklistItems;
    }

    global class ChecklistItemResult {
        public String id;
        public String itemKey;
        public String externalId;
        public Boolean complete;
    }

    global class LookupRow {
        public String id;
        public String externalId;
        public String displayName;
        public String subjectType;
        public String npi;
        public String organizationName;
        public String specialty;
        public String facilityType;
        public String email;
        public String phone;
    }

    global class LookupResponse {
        public List<LookupRow> data;
    }

    global class ErrorResponse {
        public String error;
    }

    private class ChecklistTemplateItem {
        String key;
        String label;
        ChecklistTemplateItem(String key, String label) {
            this.key = key;
            this.label = label;
        }
    }

    @HttpPost
    global static void createIntake() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        res.addHeader('Content-Type', 'application/json');

        try {
            if (req.requestBody == null) {
                writeError(res, 400, 'Request body is required');
                return;
            }
            IntakeRequest body = (IntakeRequest) JSON.deserialize(
                req.requestBody.toString(),
                IntakeRequest.class
            );
            IntakeResponse created = createIntakeInternal(body);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(created));
        } catch (CredPortalException e) {
            writeError(res, 400, e.getMessage());
        } catch (Exception e) {
            writeError(res, 500, e.getMessage());
        }
    }

    @HttpGet
    global static void lookupProviders() {
        RestRequest req = RestContext.request;
        RestResponse res = RestContext.response;
        res.addHeader('Content-Type', 'application/json');

        try {
            String q = req.params != null ? req.params.get('q') : null;
            LookupResponse out = new LookupResponse();
            out.data = lookupProvidersInternal(q);
            res.statusCode = 200;
            res.responseBody = Blob.valueOf(JSON.serialize(out));
        } catch (Exception e) {
            writeError(res, 500, e.getMessage());
        }
    }

    @TestVisible
    global static IntakeResponse createIntakeInternal(IntakeRequest body) {
        if (body == null) {
            throw new CredPortalException('Request body is required');
        }
        if (String.isBlank(body.subjectType) || String.isBlank(body.applicationType) || String.isBlank(body.path)) {
            throw new CredPortalException('subjectType, applicationType, and path are required');
        }
        if (body.provider == null || String.isBlank(body.provider.displayName)) {
            if (String.isBlank(body.providerExternalId)) {
                throw new CredPortalException('Provider display name is required for new records');
            }
        }

        String subjectType = mapSubject(body.subjectType);
        String applicationType = mapAppType(body.applicationType);
        String pathValue = mapPath(body.path);
        Map<String, Boolean> checklistComplete = body.checklistComplete == null
            ? new Map<String, Boolean>()
            : body.checklistComplete;

        Provider__c provider = resolveProvider(body, subjectType);
        upsert provider External_Id__c;

        List<ChecklistTemplateItem> template = checklistForSubject(subjectType);
        Boolean allComplete = true;
        for (ChecklistTemplateItem item : template) {
            if (checklistComplete.get(item.key) != true) {
                allComplete = false;
                break;
            }
        }
        String statusValue = allComplete ? 'In_Review' : 'Intake';
        String appExternalId = truncateExt(
            provider.External_Id__c + '-APP-' + applicationType.toUpperCase() + '-' + stamp()
        );

        Credentialing_Application__c app = new Credentialing_Application__c(
            External_Id__c = appExternalId,
            Provider__c = provider.Id,
            Subject_Type__c = subjectType,
            Application_Type__c = applicationType,
            Path__c = pathValue,
            Status__c = statusValue,
            Attempt_Count__c = 0,
            Due_Date__c = Date.today().addDays(30)
        );
        insert app;

        List<Checklist_Item__c> checklistRows = new List<Checklist_Item__c>();
        Integer sortOrder = 1;
        for (ChecklistTemplateItem item : template) {
            Boolean complete = checklistComplete.get(item.key) == true;
            checklistRows.add(new Checklist_Item__c(
                Name = truncateName(item.label),
                External_Id__c = truncateExt(appExternalId + '-CHK-' + item.key),
                Credentialing_Application__c = app.Id,
                Item_Key__c = item.key,
                Required__c = true,
                Complete__c = complete,
                Sort_Order__c = sortOrder
            ));
            sortOrder++;
        }
        insert checklistRows;

        IntakeResponse out = new IntakeResponse();
        out.providerId = provider.Id;
        out.providerExternalId = provider.External_Id__c;
        out.applicationId = app.Id;
        out.applicationExternalId = app.External_Id__c;
        out.status = statusValue;
        out.providerName = provider.Name;
        out.checklistItems = new List<ChecklistItemResult>();
        for (Checklist_Item__c row : checklistRows) {
            ChecklistItemResult item = new ChecklistItemResult();
            item.id = row.Id;
            item.itemKey = row.Item_Key__c;
            item.externalId = row.External_Id__c;
            item.complete = row.Complete__c;
            out.checklistItems.add(item);
        }
        return out;
    }

    @TestVisible
    global static List<LookupRow> lookupProvidersInternal(String query) {
        List<LookupRow> rows = new List<LookupRow>();
        if (String.isBlank(query) || query.trim().length() < 2) {
            return rows;
        }
        String q = '%' + query.trim() + '%';
        for (Provider__c p : [
            SELECT Id, Name, External_Id__c, Subject_Type__c, NPI__c,
                   Organization_Name__c, Specialty__c, Facility_Type__c, Email__c, Phone__c
            FROM Provider__c
            WHERE Name LIKE :q
               OR External_Id__c LIKE :q
               OR NPI__c LIKE :q
               OR Organization_Name__c LIKE :q
            ORDER BY Name
            LIMIT 12
        ]) {
            LookupRow row = new LookupRow();
            row.id = p.Id;
            row.externalId = p.External_Id__c;
            row.displayName = p.Name;
            row.subjectType = p.Subject_Type__c == 'Facility' ? 'facility' : 'practitioner';
            row.npi = p.NPI__c;
            row.organizationName = p.Organization_Name__c;
            row.specialty = p.Specialty__c;
            row.facilityType = p.Facility_Type__c;
            row.email = p.Email__c;
            row.phone = p.Phone__c;
            rows.add(row);
        }
        return rows;
    }

    private static Provider__c resolveProvider(IntakeRequest body, String subjectType) {
        String externalId = null;
        if (String.isNotBlank(body.providerExternalId)) {
            externalId = truncateExt(body.providerExternalId);
        } else if (body.provider != null && String.isNotBlank(body.provider.externalId)) {
            externalId = truncateExt(body.provider.externalId);
        }

        if (String.isNotBlank(externalId)) {
            List<Provider__c> existing = [
                SELECT Id, Name, External_Id__c, Subject_Type__c, NPI__c, Organization_Name__c,
                       Specialty__c, Facility_Type__c, Email__c, Phone__c, First_Name__c, Last_Name__c,
                       Credentialing_Status__c
                FROM Provider__c
                WHERE External_Id__c = :externalId
                LIMIT 1
            ];
            if (!existing.isEmpty()) {
                Provider__c p = existing[0];
                applyProviderFields(p, body.provider, subjectType, false);
                return p;
            }
        }

        if (body.provider == null || String.isBlank(body.provider.displayName)) {
            throw new CredPortalException('Provider display name is required for new records');
        }

        String prefix = subjectType == 'Facility' ? 'FAC' : 'PRV';
        if (String.isBlank(externalId)) {
            externalId = truncateExt(prefix + '-PORTAL-' + stamp());
        }

        Provider__c created = new Provider__c(
            External_Id__c = externalId,
            Subject_Type__c = subjectType,
            Credentialing_Status__c = 'Pending'
        );
        applyProviderFields(created, body.provider, subjectType, true);
        return created;
    }

    private static void applyProviderFields(
        Provider__c p,
        ProviderPayload payload,
        String subjectType,
        Boolean isNew
    ) {
        if (payload == null) {
            return;
        }
        if (String.isNotBlank(payload.displayName)) {
            p.Name = truncateName(payload.displayName);
        }
        if (isNew || String.isNotBlank(payload.npi)) {
            p.NPI__c = blankToNull(payload.npi);
        }
        if (isNew || String.isNotBlank(payload.organizationName)) {
            p.Organization_Name__c = blankToNull(payload.organizationName);
        }
        if (isNew || String.isNotBlank(payload.specialty)) {
            p.Specialty__c = blankToNull(payload.specialty);
        }
        if (isNew || String.isNotBlank(payload.facilityType)) {
            p.Facility_Type__c = blankToNull(payload.facilityType);
        }
        if (isNew || String.isNotBlank(payload.email)) {
            p.Email__c = blankToNull(payload.email);
        }
        if (isNew || String.isNotBlank(payload.phone)) {
            p.Phone__c = blankToNull(payload.phone);
        }
        if (isNew || String.isNotBlank(payload.firstName)) {
            p.First_Name__c = blankToNull(payload.firstName);
        }
        if (isNew || String.isNotBlank(payload.lastName)) {
            p.Last_Name__c = blankToNull(payload.lastName);
        }
        p.Subject_Type__c = subjectType;
        if (String.isBlank(p.Credentialing_Status__c)) {
            p.Credentialing_Status__c = 'Pending';
        }
    }

    private static List<ChecklistTemplateItem> checklistForSubject(String subjectType) {
        if (subjectType == 'Facility') {
            return new List<ChecklistTemplateItem>{
                new ChecklistTemplateItem('facility_license', 'Facility license'),
                new ChecklistTemplateItem('accreditation', 'Accreditation documentation'),
                new ChecklistTemplateItem('malpractice_coi', 'Malpractice certificate of insurance'),
                new ChecklistTemplateItem('ownership_documentation', 'Ownership documentation')
            };
        }
        return new List<ChecklistTemplateItem>{
            new ChecklistTemplateItem('npi_copy', 'Copy of National Provider Identifier (NPI)'),
            new ChecklistTemplateItem('state_license_copy', 'Copy of State Practitioner License'),
            new ChecklistTemplateItem('personal_information', 'Personal Information such as Phone number, Email address, Home address, etc.'),
            new ChecklistTemplateItem('federal_tax_id', 'Federal Tax ID number'),
            new ChecklistTemplateItem('medicaid_number', 'Medicaid Number'),
            new ChecklistTemplateItem('medicare_number', 'Medicare Number'),
            new ChecklistTemplateItem('dea_cds_certificates', 'Copy of DEA (federal) certificate and CDS (state) certificate'),
            new ChecklistTemplateItem('social_security_card', 'Copy of Social Security Card'),
            new ChecklistTemplateItem('medical_degrees_training', 'Copy of all Medical Degrees, Internships, Training Certificates, etc.'),
            new ChecklistTemplateItem('work_background', 'Work Background with the names of the Healthcare Practices and Affiliated Letters'),
            new ChecklistTemplateItem('board_certificate', 'Copy of Current Board Certificate'),
            new ChecklistTemplateItem('malpractice_insurance', 'Copy of Malpractice Insurance Certificate'),
            new ChecklistTemplateItem('curriculum_vitae', 'Curriculum Vitae'),
            new ChecklistTemplateItem('drivers_license', 'Copy of Drivers License')
        };
    }

    private static String mapSubject(String value) {
        return value != null && value.toLowerCase() == 'facility' ? 'Facility' : 'Practitioner';
    }

    private static String mapAppType(String value) {
        return value != null && value.toLowerCase() == 'recred' ? 'Recred' : 'New';
    }

    private static String mapPath(String value) {
        if (value == null) return 'CAQH';
        String v = value.toLowerCase();
        if (v == 'in_house' || v == 'delegated') return 'In_House';
        if (v == 'facility') return 'Facility';
        return 'CAQH';
    }

    private static String stamp() {
        Long ms = Datetime.now().getTime();
        Integer rand = Math.abs(Crypto.getRandomInteger());
        return String.valueOf(ms) + String.valueOf(Math.mod(rand, 10000));
    }

    /** Keep External_Id__c unique within Text(40). */
    private static String truncateExt(String value) {
        if (value == null) return null;
        if (value.length() <= 40) return value;
        Integer h = 0;
        for (Integer i = 0; i < value.length(); i++) {
            h = Math.mod((31 * h + value.charAt(i)), 2147483647);
        }
        String hash = String.valueOf(h);
        if (hash.length() > 8) {
            hash = hash.substring(hash.length() - 8);
        } else {
            hash = ('00000000' + hash).right(8);
        }
        return value.substring(0, 31) + '-' + hash;
    }

    private static String truncateName(String value) {
        if (value == null) return null;
        return value.length() <= 80 ? value : value.substring(0, 80);
    }

    private static String blankToNull(String value) {
        return String.isBlank(value) ? null : value.trim();
    }

    private static void writeError(RestResponse res, Integer statusCode, String message) {
        res.statusCode = statusCode;
        ErrorResponse err = new ErrorResponse();
        err.error = message;
        res.responseBody = Blob.valueOf(JSON.serialize(err));
    }

    global class CredPortalException extends Exception {
    }
}
