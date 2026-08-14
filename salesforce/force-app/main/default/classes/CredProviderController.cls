public with sharing class CredProviderController {
    public class ProviderRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String externalId;
        @AuraEnabled public String subjectType;
        @AuraEnabled public String npi;
        @AuraEnabled public String organizationName;
        @AuraEnabled public String specialty;
        @AuraEnabled public String facilityType;
        @AuraEnabled public String status;
        @AuraEnabled public Date recredDueDate;
        @AuraEnabled public String detailLabel;
    }

    public class ProviderDetail {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String externalId;
        @AuraEnabled public String subjectType;
        @AuraEnabled public String npi;
        @AuraEnabled public String organizationName;
        @AuraEnabled public String specialty;
        @AuraEnabled public String facilityType;
        @AuraEnabled public String status;
        @AuraEnabled public String email;
        @AuraEnabled public String phone;
        @AuraEnabled public String mobilePhone;
        @AuraEnabled public Date credStartDate;
        @AuraEnabled public Date credEndDate;
        @AuraEnabled public Date recredDueDate;
        @AuraEnabled public String middleName;
        @AuraEnabled public String nameSuffix;
        @AuraEnabled public Date dateOfBirth;
        @AuraEnabled public String gender;
        @AuraEnabled public String ssnLast4;
        @AuraEnabled public String birthCountry;
        @AuraEnabled public String preferredLanguages;
        @AuraEnabled public String caqhId;
        @AuraEnabled public String practiceState;
    }

    public class CredentialRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String credentialType;
        @AuraEnabled public String credentialNumber;
        @AuraEnabled public String issuingAuthority;
        @AuraEnabled public Date issuedDate;
        @AuraEnabled public Date expirationDate;
        @AuraEnabled public String status;
        @AuraEnabled public Id providerId;
        @AuraEnabled public String providerName;
    }

    public class ApplicationRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public String applicationType;
        @AuraEnabled public String pathValue;
        @AuraEnabled public String status;
        @AuraEnabled public String subjectType;
        @AuraEnabled public Decimal attemptCount;
        @AuraEnabled public Date dueDate;
        @AuraEnabled public Id providerId;
        @AuraEnabled public String providerName;
    }

    public class EducationRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String institutionName;
        @AuraEnabled public String degreeType;
        @AuraEnabled public String fieldOfStudy;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public Decimal graduationYear;
        @AuraEnabled public String country;
    }

    public class WorkHistoryRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String employerName;
        @AuraEnabled public String title;
        @AuraEnabled public String department;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public Boolean isCurrent;
        @AuraEnabled public String location;
    }

    public class AddressRow {
        @AuraEnabled public Id id;
        @AuraEnabled public String addressType;
        @AuraEnabled public String line1;
        @AuraEnabled public String line2;
        @AuraEnabled public String city;
        @AuraEnabled public String stateCode;
        @AuraEnabled public String postalCode;
        @AuraEnabled public String country;
        @AuraEnabled public Boolean isPrimary;
    }

    @AuraEnabled(cacheable=true)
    public static List<ProviderRow> listProviders(String subjectType, String searchTerm) {
        String st = String.isBlank(subjectType) ? 'All' : subjectType;
        String likeTerm = String.isBlank(searchTerm) ? null : '%' + searchTerm.trim() + '%';

        String soql =
            'SELECT Id, Name, External_Id__c, Subject_Type__c, NPI__c, Organization_Name__c, ' +
            'Specialty__c, Facility_Type__c, Credentialing_Status__c, Recred_Due_Date__c ' +
            'FROM Provider__c';

        List<String> wheres = new List<String>();
        if (st == 'Practitioner' || st == 'Facility') {
            wheres.add('Subject_Type__c = :st');
        }
        if (likeTerm != null) {
            wheres.add('(Name LIKE :likeTerm OR External_Id__c LIKE :likeTerm OR NPI__c LIKE :likeTerm OR Organization_Name__c LIKE :likeTerm)');
        }
        if (!wheres.isEmpty()) {
            soql += ' WHERE ' + String.join(wheres, ' AND ');
        }
        soql += ' ORDER BY Name LIMIT 500';

        List<ProviderRow> rows = new List<ProviderRow>();
        for (Provider__c p : Database.query(soql)) {
            ProviderRow row = new ProviderRow();
            row.id = p.Id;
            row.name = p.Name;
            row.externalId = p.External_Id__c;
            row.subjectType = p.Subject_Type__c;
            row.npi = p.NPI__c;
            row.organizationName = p.Organization_Name__c;
            row.specialty = p.Specialty__c;
            row.facilityType = p.Facility_Type__c;
            row.status = p.Credentialing_Status__c;
            row.recredDueDate = p.Recred_Due_Date__c;
            row.detailLabel = String.isNotBlank(p.Specialty__c) ? p.Specialty__c : p.Facility_Type__c;
            rows.add(row);
        }
        return rows;
    }

    /**
     * Deletes a provider and related credentialing applications (lookup is Restrict).
     * Master-detail children (credentials, education, work, addresses, checklist) cascade.
     */
    @AuraEnabled
    public static void deleteProvider(Id providerId) {
        if (providerId == null) {
            throw new AuraHandledException('Provider Id is required');
        }
        List<Provider__c> providers = [
            SELECT Id, Name FROM Provider__c WHERE Id = :providerId LIMIT 1
        ];
        if (providers.isEmpty()) {
            throw new AuraHandledException('Provider was not found or is already deleted');
        }
        delete [
            SELECT Id FROM Credentialing_Application__c WHERE Provider__c = :providerId
        ];
        delete providers;
    }

    @AuraEnabled(cacheable=true)
    public static ProviderDetail getProvider(Id providerId) {
        Provider__c p = [
            SELECT Id, Name, External_Id__c, Subject_Type__c, NPI__c, Organization_Name__c,
                   Specialty__c, Facility_Type__c, Credentialing_Status__c, Email__c, Phone__c,
                   Mobile_Phone__c, Cred_Start_Date__c, Cred_End_Date__c, Recred_Due_Date__c,
                   Middle_Name__c, Name_Suffix__c, Date_Of_Birth__c, Gender__c, SSN_Last_4__c,
                   Birth_Country__c, Preferred_Languages__c, CAQH_ID__c, Practice_State__c
            FROM Provider__c
            WHERE Id = :providerId
            LIMIT 1
        ];
        ProviderDetail d = new ProviderDetail();
        d.id = p.Id;
        d.name = p.Name;
        d.externalId = p.External_Id__c;
        d.subjectType = p.Subject_Type__c;
        d.npi = p.NPI__c;
        d.organizationName = p.Organization_Name__c;
        d.specialty = p.Specialty__c;
        d.facilityType = p.Facility_Type__c;
        d.status = p.Credentialing_Status__c;
        d.email = p.Email__c;
        d.phone = p.Phone__c;
        d.mobilePhone = p.Mobile_Phone__c;
        d.credStartDate = p.Cred_Start_Date__c;
        d.credEndDate = p.Cred_End_Date__c;
        d.recredDueDate = p.Recred_Due_Date__c;
        d.middleName = p.Middle_Name__c;
        d.nameSuffix = p.Name_Suffix__c;
        d.dateOfBirth = p.Date_Of_Birth__c;
        d.gender = p.Gender__c;
        d.ssnLast4 = p.SSN_Last_4__c;
        d.birthCountry = p.Birth_Country__c;
        d.preferredLanguages = p.Preferred_Languages__c;
        d.caqhId = p.CAQH_ID__c;
        d.practiceState = p.Practice_State__c;
        return d;
    }

    @AuraEnabled(cacheable=true)
    public static List<CredentialRow> listCredentials(Id providerId) {
        List<CredentialRow> rows = new List<CredentialRow>();
        for (Provider_Credential__c c : [
            SELECT Id, Name, Credential_Type__c, Credential_Number__c, Issuing_Authority__c,
                   Issued_Date__c, Expiration_Date__c, Status__c, Provider__c, Provider__r.Name
            FROM Provider_Credential__c
            WHERE Provider__c = :providerId
            ORDER BY Expiration_Date__c NULLS LAST
        ]) {
            rows.add(mapCredential(c));
        }
        return rows;
    }

    @AuraEnabled(cacheable=true)
    public static List<CredentialRow> listAllCredentials(String statusFilter, String searchTerm) {
        Boolean filterAll = String.isBlank(statusFilter) || statusFilter == 'All';
        String term = String.isBlank(searchTerm) ? null : '%' + String.escapeSingleQuotes(searchTerm.trim()) + '%';

        String soql =
            'SELECT Id, Name, Credential_Type__c, Credential_Number__c, Issuing_Authority__c, ' +
            'Issued_Date__c, Expiration_Date__c, Status__c, Provider__c, Provider__r.Name ' +
            'FROM Provider_Credential__c WHERE Id != null';
        if (!filterAll) {
            soql += ' AND Status__c = \'' + String.escapeSingleQuotes(statusFilter) + '\'';
        }
        if (term != null) {
            soql +=
                ' AND (Name LIKE \'' + term + '\'' +
                ' OR Provider__r.Name LIKE \'' + term + '\'' +
                ' OR Credential_Type__c LIKE \'' + term + '\'' +
                ' OR Credential_Number__c LIKE \'' + term + '\')';
        }
        soql += ' ORDER BY Expiration_Date__c ASC NULLS LAST, CreatedDate DESC LIMIT 200';

        List<CredentialRow> rows = new List<CredentialRow>();
        for (Provider_Credential__c c : Database.query(soql)) {
            rows.add(mapCredential(c));
        }
        return rows;
    }

    private static CredentialRow mapCredential(Provider_Credential__c c) {
        CredentialRow row = new CredentialRow();
        row.id = c.Id;
        row.name = c.Name;
        row.credentialType = c.Credential_Type__c;
        row.credentialNumber = c.Credential_Number__c;
        row.issuingAuthority = c.Issuing_Authority__c;
        row.issuedDate = c.Issued_Date__c;
        row.expirationDate = c.Expiration_Date__c;
        row.status = c.Status__c;
        row.providerId = c.Provider__c;
        row.providerName = c.Provider__r != null ? c.Provider__r.Name : null;
        return row;
    }

    @AuraEnabled(cacheable=true)
    public static List<ApplicationRow> listApplications(Id providerId) {
        List<ApplicationRow> rows = new List<ApplicationRow>();
        for (Credentialing_Application__c a : [
            SELECT Id, Name, Application_Type__c, Path__c, Status__c, Subject_Type__c,
                   Attempt_Count__c, Due_Date__c, Provider__c, Provider__r.Name
            FROM Credentialing_Application__c
            WHERE Provider__c = :providerId
            ORDER BY CreatedDate DESC
        ]) {
            rows.add(mapApplication(a));
        }
        return rows;
    }

    @AuraEnabled(cacheable=true)
    public static List<ApplicationRow> listAllApplications(String statusFilter, String searchTerm) {
        Boolean filterAll = String.isBlank(statusFilter) || statusFilter == 'All';
        String term = String.isBlank(searchTerm) ? null : '%' + String.escapeSingleQuotes(searchTerm.trim()) + '%';

        String soql =
            'SELECT Id, Name, Application_Type__c, Path__c, Status__c, Subject_Type__c, ' +
            'Attempt_Count__c, Due_Date__c, Provider__c, Provider__r.Name ' +
            'FROM Credentialing_Application__c WHERE Id != null';
        if (!filterAll) {
            soql += ' AND Status__c = \'' + String.escapeSingleQuotes(statusFilter) + '\'';
        }
        if (term != null) {
            soql +=
                ' AND (Name LIKE \'' + term + '\'' +
                ' OR Provider__r.Name LIKE \'' + term + '\'' +
                ' OR Path__c LIKE \'' + term + '\')';
        }
        soql += ' ORDER BY Due_Date__c ASC NULLS LAST, CreatedDate DESC LIMIT 200';

        List<ApplicationRow> rows = new List<ApplicationRow>();
        for (Credentialing_Application__c a : Database.query(soql)) {
            rows.add(mapApplication(a));
        }
        return rows;
    }

    private static ApplicationRow mapApplication(Credentialing_Application__c a) {
        ApplicationRow row = new ApplicationRow();
        row.id = a.Id;
        row.name = a.Name;
        row.applicationType = a.Application_Type__c;
        row.pathValue = a.Path__c;
        row.status = a.Status__c;
        row.subjectType = a.Subject_Type__c;
        row.attemptCount = a.Attempt_Count__c;
        row.dueDate = a.Due_Date__c;
        row.providerId = a.Provider__c;
        row.providerName = a.Provider__r != null ? a.Provider__r.Name : null;
        return row;
    }

    @AuraEnabled(cacheable=true)
    public static List<EducationRow> listEducation(Id providerId) {
        List<EducationRow> rows = new List<EducationRow>();
        for (Education_History__c e : [
            SELECT Id, Institution_Name__c, Degree_Type__c, Field_Of_Study__c,
                   Start_Date__c, End_Date__c, Graduation_Year__c, Country__c
            FROM Education_History__c
            WHERE Provider__c = :providerId
            ORDER BY End_Date__c DESC NULLS LAST, Graduation_Year__c DESC NULLS LAST
        ]) {
            EducationRow row = new EducationRow();
            row.id = e.Id;
            row.institutionName = e.Institution_Name__c;
            row.degreeType = e.Degree_Type__c;
            row.fieldOfStudy = e.Field_Of_Study__c;
            row.startDate = e.Start_Date__c;
            row.endDate = e.End_Date__c;
            row.graduationYear = e.Graduation_Year__c;
            row.country = e.Country__c;
            rows.add(row);
        }
        return rows;
    }

    @AuraEnabled(cacheable=true)
    public static List<WorkHistoryRow> listWorkHistory(Id providerId) {
        List<WorkHistoryRow> rows = new List<WorkHistoryRow>();
        for (Work_History__c w : [
            SELECT Id, Employer_Name__c, Title__c, Department__c,
                   Start_Date__c, End_Date__c, Is_Current__c, Location__c
            FROM Work_History__c
            WHERE Provider__c = :providerId
            ORDER BY Is_Current__c DESC, End_Date__c DESC NULLS LAST, Start_Date__c DESC NULLS LAST
        ]) {
            WorkHistoryRow row = new WorkHistoryRow();
            row.id = w.Id;
            row.employerName = w.Employer_Name__c;
            row.title = w.Title__c;
            row.department = w.Department__c;
            row.startDate = w.Start_Date__c;
            row.endDate = w.End_Date__c;
            row.isCurrent = w.Is_Current__c;
            row.location = w.Location__c;
            rows.add(row);
        }
        return rows;
    }

    @AuraEnabled(cacheable=true)
    public static List<AddressRow> listAddresses(Id providerId) {
        List<AddressRow> rows = new List<AddressRow>();
        for (Provider_Address__c a : [
            SELECT Id, Address_Type__c, Line1__c, Line2__c, City__c, State__c,
                   Postal_Code__c, Country__c, Is_Primary__c
            FROM Provider_Address__c
            WHERE Provider__c = :providerId
            ORDER BY Address_Type__c
        ]) {
            AddressRow row = new AddressRow();
            row.id = a.Id;
            row.addressType = a.Address_Type__c;
            row.line1 = a.Line1__c;
            row.line2 = a.Line2__c;
            row.city = a.City__c;
            row.stateCode = a.State__c;
            row.postalCode = a.Postal_Code__c;
            row.country = a.Country__c;
            row.isPrimary = a.Is_Primary__c;
            rows.add(row);
        }
        return rows;
    }
}
