public with sharing class CredAssistController {
    @TestVisible private static Cred_Assist_Config__mdt testConfigOverride;
    @TestVisible private static String lastCalloutError;

    private static final Set<String> OPEN_APP_STATUSES = new Set<String>{
        'Draft', 'Intake', 'In_Review', 'Pending_Committee'
    };

    public class AssistResult {
        @AuraEnabled public String summary;
        @AuraEnabled public List<String> missingItems;
        @AuraEnabled public String draftNote;
        @AuraEnabled public String nextAction;
        @AuraEnabled public String source;
        @AuraEnabled public String warning;
        @AuraEnabled public Id taskId;
        /** Soft identity matches (same person, different name presentation). */
        @AuraEnabled public List<String> reconciledNames;
        /** Hard conflicts that need specialist review (e.g. specialty mismatch). */
        @AuraEnabled public List<String> exceptions;
        @AuraEnabled public String intakeSummary;
        @AuraEnabled public Boolean hasExceptions;
        /** Soft observations across Provider 360. */
        @AuraEnabled public List<String> insights;
        /** Missing expected demographic / history / profile data. */
        @AuraEnabled public List<String> completenessGaps;
        /** Document inventory and attachment notes. */
        @AuraEnabled public List<String> documentFindings;
        /** 0–100 profile/application completeness for the agent donut. */
        @AuraEnabled public Integer completenessScore;
        /** Short explanation of how the score was derived. */
        @AuraEnabled public String completenessExplainer;
    }

    private class DocumentInfo {
        String title;
        String fileType;
        Id linkedEntityId;
        String linkedEntityType;
    }

    private class AssistContext {
        Id recordId;
        Boolean providerScoped;
        Credentialing_Application__c app;
        List<Credentialing_Application__c> applications;
        Provider__c provider;
        List<Checklist_Item__c> checklist;
        List<Provider_Credential__c> credentials;
        List<Education_History__c> education;
        List<Work_History__c> workHistory;
        List<Provider_Address__c> addresses;
        List<DocumentInfo> documents;
        List<String> documentTitles;
        List<Map<String, String>> nameSignals;
        List<Map<String, String>> specialtySignals;
    }

    @AuraEnabled
    public static AssistResult assist(Id recordId) {
        AssistContext ctx = loadContext(recordId);
        AssistResult local = buildLocalAssist(ctx);
        lastCalloutError = null;

        Cred_Assist_Config__mdt config = resolveConfig();
        if (config == null) {
            local.warning = 'Cred Assist Config Default record was not found.';
            return withCompletenessScore(ctx, local);
        }
        if (String.isNotBlank(config.Bridge_URL__c)) {
            AssistResult bridged = callBridge(ctx, config, local);
            if (bridged != null) return withCompletenessScore(ctx, bridged);
        }
        if (String.isNotBlank(config.Claude_Api_Key__c)) {
            AssistResult claude = callClaude(ctx, config, local);
            if (claude != null) return withCompletenessScore(ctx, claude);
            local.warning = 'Claude call failed; using local assist. '
                + (String.isBlank(lastCalloutError) ? 'Check Remote Site and API key.' : lastCalloutError);
            return withCompletenessScore(ctx, local);
        }
        local.warning = 'Claude Api Key is blank on Cred Assist Config. Using local assist.';
        return withCompletenessScore(ctx, local);
    }

    @AuraEnabled
    public static AssistResult createTaskFromDraft(Id recordId, String draftNote, String subject) {
        AssistContext ctx = loadContext(recordId);
        Task t = new Task();
        String label = ctx.provider != null
            ? ctx.provider.Name
            : (ctx.app != null ? ctx.app.Name : 'Provider');
        t.Subject = String.isBlank(subject) ? 'Cred chase: ' + label : subject;
        t.Description = draftNote;
        t.WhatId = ctx.app != null ? ctx.app.Id : (ctx.provider != null ? ctx.provider.Id : recordId);
        t.Status = 'Not Started';
        t.Priority = 'Normal';
        t.ActivityDate = Date.today().addDays(3);
        insert t;

        AssistResult result = buildLocalAssist(ctx);
        result.draftNote = draftNote;
        result.taskId = t.Id;
        result.nextAction = 'Task created. Spec owns follow-up; status unchanged.';
        result.source = 'local';
        return result;
    }

    private static Cred_Assist_Config__mdt resolveConfig() {
        if (testConfigOverride != null) {
            return testConfigOverride;
        }
        List<Cred_Assist_Config__mdt> rows = [
            SELECT DeveloperName, Bridge_URL__c, Bridge_Secret__c, Claude_Api_Key__c, Model__c
            FROM Cred_Assist_Config__mdt
            WHERE DeveloperName = 'Default'
            LIMIT 1
        ];
        return rows.isEmpty() ? null : rows[0];
    }

    private static AssistContext loadContext(Id recordId) {
        if (recordId == null) {
            throw new AuraHandledException('Record Id is required.');
        }
        Schema.SObjectType sot = recordId.getSObjectType();
        if (sot == Credentialing_Application__c.SObjectType) {
            return loadApplicationContext(recordId);
        }
        if (sot == Provider__c.SObjectType) {
            return loadProviderContext(recordId);
        }
        throw new AuraHandledException('Credentialing Agent supports Provider and Credentialing Application records only.');
    }

    private static AssistContext loadApplicationContext(Id applicationId) {
        AssistContext ctx = new AssistContext();
        ctx.recordId = applicationId;
        ctx.providerScoped = false;
        ctx.app = [
            SELECT Id, Name, External_Id__c, Status__c, Application_Type__c, Path__c,
                   Subject_Type__c, Attempt_Count__c, Due_Date__c, Provider__c
            FROM Credentialing_Application__c
            WHERE Id = :applicationId
            LIMIT 1
        ];
        ctx.provider = queryProvider(ctx.app.Provider__c);
        ctx.applications = [
            SELECT Id, Name, External_Id__c, Status__c, Application_Type__c, Path__c,
                   Subject_Type__c, Attempt_Count__c, Due_Date__c, Provider__c
            FROM Credentialing_Application__c
            WHERE Provider__c = :ctx.app.Provider__c
            ORDER BY Due_Date__c ASC NULLS LAST, Name ASC
            LIMIT 40
        ];
        loadSharedGraph(ctx, ctx.app.Provider__c, new Set<Id>{ applicationId, ctx.app.Provider__c });
        // Checklist for the focused application (also include siblings for 360 gaps)
        Set<Id> appIds = new Set<Id>();
        for (Credentialing_Application__c a : ctx.applications) {
            appIds.add(a.Id);
        }
        ctx.checklist = [
            SELECT Id, Name, Item_Key__c, Required__c, Complete__c, Sort_Order__c,
                   Credentialing_Application__c
            FROM Checklist_Item__c
            WHERE Credentialing_Application__c IN :appIds
            ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
        ];
        ctx.nameSignals = buildNameSignals(ctx);
        ctx.specialtySignals = buildSpecialtySignals(ctx);
        return ctx;
    }

    private static AssistContext loadProviderContext(Id providerId) {
        AssistContext ctx = new AssistContext();
        ctx.recordId = providerId;
        ctx.providerScoped = true;
        ctx.provider = queryProvider(providerId);
        ctx.applications = [
            SELECT Id, Name, External_Id__c, Status__c, Application_Type__c, Path__c,
                   Subject_Type__c, Attempt_Count__c, Due_Date__c, Provider__c
            FROM Credentialing_Application__c
            WHERE Provider__c = :providerId
            ORDER BY Due_Date__c ASC NULLS LAST, Name ASC
            LIMIT 40
        ];
        // Prefer an open incomplete app as the chase anchor; else any open app
        for (Credentialing_Application__c a : ctx.applications) {
            if (a.Status__c == 'Intake') {
                ctx.app = a;
                break;
            }
        }
        if (ctx.app == null) {
            for (Credentialing_Application__c a : ctx.applications) {
                if (OPEN_APP_STATUSES.contains(a.Status__c)) {
                    ctx.app = a;
                    break;
                }
            }
        }
        if (ctx.app == null && !ctx.applications.isEmpty()) {
            ctx.app = ctx.applications[0];
        }

        Set<Id> linkIds = new Set<Id>{ providerId };
        for (Credentialing_Application__c a : ctx.applications) {
            linkIds.add(a.Id);
        }
        loadSharedGraph(ctx, providerId, linkIds);

        Set<Id> appIds = new Set<Id>();
        for (Credentialing_Application__c a : ctx.applications) {
            appIds.add(a.Id);
        }
        if (appIds.isEmpty()) {
            ctx.checklist = new List<Checklist_Item__c>();
        } else {
            ctx.checklist = [
                SELECT Id, Name, Item_Key__c, Required__c, Complete__c, Sort_Order__c,
                       Credentialing_Application__c
                FROM Checklist_Item__c
                WHERE Credentialing_Application__c IN :appIds
                ORDER BY Sort_Order__c ASC NULLS LAST, Name ASC
            ];
        }
        ctx.nameSignals = buildNameSignals(ctx);
        ctx.specialtySignals = buildSpecialtySignals(ctx);
        return ctx;
    }

    private static Provider__c queryProvider(Id providerId) {
        return [
            SELECT Id, Name, External_Id__c, NPI__c, Subject_Type__c, Specialty__c,
                   Facility_Type__c, Recred_Due_Date__c, Date_Of_Birth__c,
                   First_Name__c, Middle_Name__c, Last_Name__c, Name_Suffix__c
            FROM Provider__c
            WHERE Id = :providerId
            LIMIT 1
        ];
    }

    private static void loadSharedGraph(AssistContext ctx, Id providerId, Set<Id> documentLinkIds) {
        ctx.credentials = [
            SELECT Id, Name, Credential_Type__c, Status__c, Expiration_Date__c,
                   Issuing_Authority__c, Credential_Number__c
            FROM Provider_Credential__c
            WHERE Provider__c = :providerId
            ORDER BY Expiration_Date__c ASC NULLS LAST
            LIMIT 40
        ];
        ctx.education = [
            SELECT Id, Institution_Name__c, Degree_Type__c, Field_Of_Study__c
            FROM Education_History__c
            WHERE Provider__c = :providerId
            ORDER BY Graduation_Year__c DESC NULLS LAST
            LIMIT 20
        ];
        ctx.workHistory = [
            SELECT Id, Employer_Name__c, Title__c, Department__c, Is_Current__c
            FROM Work_History__c
            WHERE Provider__c = :providerId
            ORDER BY Is_Current__c DESC, End_Date__c DESC NULLS LAST
            LIMIT 20
        ];
        ctx.addresses = [
            SELECT Id, Address_Type__c, Line1__c, Line2__c, City__c, State__c,
                   Postal_Code__c, Country__c, Is_Primary__c
            FROM Provider_Address__c
            WHERE Provider__c = :providerId
            ORDER BY Is_Primary__c DESC, Address_Type__c ASC NULLS LAST
            LIMIT 20
        ];
        ctx.documents = new List<DocumentInfo>();
        ctx.documentTitles = new List<String>();
        for (ContentDocumentLink link : [
            SELECT LinkedEntityId, ContentDocument.Title, ContentDocument.FileType,
                   ContentDocument.CreatedDate
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :documentLinkIds
            ORDER BY ContentDocument.CreatedDate DESC
            LIMIT 80
        ]) {
            if (link.ContentDocument == null || String.isBlank(link.ContentDocument.Title)) {
                continue;
            }
            DocumentInfo doc = new DocumentInfo();
            doc.title = link.ContentDocument.Title;
            doc.fileType = link.ContentDocument.FileType;
            doc.linkedEntityId = link.LinkedEntityId;
            doc.linkedEntityType = link.LinkedEntityId != null
                ? String.valueOf(link.LinkedEntityId.getSObjectType())
                : null;
            ctx.documents.add(doc);
            ctx.documentTitles.add(doc.title);
        }
    }

    private static List<Map<String, String>> buildNameSignals(AssistContext ctx) {
        List<Map<String, String>> signals = new List<Map<String, String>>();
        if (ctx.provider == null) return signals;

        addSignal(signals, 'Application / profile display name', ctx.provider.Name);
        String legal = joinNameParts(
            ctx.provider.First_Name__c,
            ctx.provider.Middle_Name__c,
            ctx.provider.Last_Name__c,
            ctx.provider.Name_Suffix__c
        );
        addSignal(signals, 'Legal name parts', legal);
        if (String.isNotBlank(ctx.provider.NPI__c)) {
            addSignal(signals, 'NPI-linked profile name', ctx.provider.Name);
        }
        for (Provider_Credential__c c : ctx.credentials) {
            if (c.Credential_Type__c == 'Medical_License' && looksLikePersonName(c.Name)) {
                addSignal(signals, 'License record name', c.Name);
            }
            if (c.Credential_Type__c == 'Board_Certification' && looksLikePersonName(c.Name)) {
                addSignal(signals, 'Board certification name', c.Name);
            }
        }
        for (String title : ctx.documentTitles) {
            String guessed = guessPersonNameFromDocumentTitle(title);
            if (String.isNotBlank(guessed)) {
                addSignal(signals, 'Document "' + title + '"', guessed);
            } else {
                addSignal(signals, 'Uploaded document', title);
            }
        }
        return signals;
    }

    private static List<Map<String, String>> buildSpecialtySignals(AssistContext ctx) {
        List<Map<String, String>> signals = new List<Map<String, String>>();
        if (ctx.provider == null) return signals;

        addSignal(signals, 'Application specialty', ctx.provider.Specialty__c);
        addSignal(signals, 'Facility type', ctx.provider.Facility_Type__c);
        for (Education_History__c e : ctx.education) {
            if (String.isNotBlank(e.Field_Of_Study__c)) {
                addSignal(signals, 'Education / ' + e.Degree_Type__c, e.Field_Of_Study__c);
            }
        }
        for (Work_History__c w : ctx.workHistory) {
            if (String.isNotBlank(w.Title__c)) {
                addSignal(signals, 'Work title' + (w.Is_Current__c == true ? ' (current)' : ''), w.Title__c);
            }
            if (String.isNotBlank(w.Department__c)) {
                addSignal(signals, 'Work department', w.Department__c);
            }
        }
        for (Provider_Credential__c c : ctx.credentials) {
            if (c.Credential_Type__c == 'Board_Certification') {
                String board = String.isNotBlank(c.Issuing_Authority__c) ? c.Issuing_Authority__c : c.Name;
                addSignal(signals, 'Board certification', board);
            }
        }
        for (String title : ctx.documentTitles) {
            String lower = title.toLowerCase();
            if (lower.contains('cv') || lower.contains('resume') || lower.contains('curriculum')) {
                addSignal(signals, 'CV / resume document', title);
            }
            if (lower.contains('board')) {
                addSignal(signals, 'Board document', title);
            }
        }
        return signals;
    }

    private static void addSignal(List<Map<String, String>> signals, String source, String value) {
        if (String.isBlank(value)) return;
        signals.add(new Map<String, String>{
            'source' => source,
            'value' => value.trim()
        });
    }

    private static String joinNameParts(String first, String middle, String last, String suffix) {
        List<String> parts = new List<String>();
        if (String.isNotBlank(first)) parts.add(first.trim());
        if (String.isNotBlank(middle)) parts.add(middle.trim());
        if (String.isNotBlank(last)) parts.add(last.trim());
        if (String.isNotBlank(suffix)) parts.add(suffix.trim());
        return String.join(parts, ' ');
    }

    private static String guessPersonNameFromDocumentTitle(String title) {
        if (String.isBlank(title)) return null;
        String t = title.replace('_', ' ').replace('-', ' ');
        t = t.replaceAll('(?i)\\.(pdf|png|jpe?g|docx?|webp)$', '');
        t = t.replaceAll('(?i)\\b(cv|resume|license|dea|board|cert|malpractice|coi|attestation|npi)\\b', ' ');
        t = t.replaceAll('\\s+', ' ').trim();
        List<String> tokens = t.split(' ');
        if (tokens.size() < 2 || tokens.size() > 5) return null;
        for (String tok : tokens) {
            if (!Pattern.matches('(?i)^[a-z.]+$', tok)) return null;
        }
        return t;
    }

    private static final List<String> NUMBER_WORDS = new List<String>{
        'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'
    };

    private static final String STYLE_RULES =
        ' Style rules for all string values: Never use em dashes or en dashes. Use commas, periods, or hyphens only.'
        + ' Spell out whole numbers from zero through nine in prose (one, two, three).'
        + ' Always keep dates fully numerical (for example 2026-08-05 or August 5, 2026). Never spell out day or month numbers in dates.'
        + ' Use numerals for 10 and above, IDs, NPIs, and phone numbers.'
        + ' Use plain text only. Do not use Markdown (no **, *, #, backticks, or bullet markers).';

    private static final String INTAKE_RULES =
        ' Intake and Provider 360 analysis rules:'
        + ' Scrutinize ALL provider 360 data, documents, and inputs (identity, specialty, demographics,'
        + ' addresses, education, work history, credentials, applications, checklists, and uploaded files).'
        + ' 1) Name reconciliation: Variants like "John A. Smith", "John Smith MD", and "John Andrew Smith" usually represent the SAME person.'
        + ' Do not flag those as identity mismatches. Put a short reconciled note in reconciledNames.'
        + ' Only put true identity conflicts in exceptions (for example completely different surnames).'
        + ' 2) Specialty / practice conflicts ARE exceptions: if CV specialty, board certification, and application specialty diverge across practice families'
        + ' (example Cardiology vs Internal Medicine vs Cardiothoracic Surgery), add a clear exception requiring human review.'
        + ' 3) Closely related specialties in the same family (Cardiology and Cardiothoracic Surgery) may be noted in insights but are softer than cross-family conflicts.'
        + ' 4) Put missing expected profile/history data in completenessGaps; document inventory notes in documentFindings;'
        + ' softer observations in insights.';

    private static String spellSmallNumber(Integer n) {
        if (n != null && n >= 0 && n <= 9) {
            return NUMBER_WORDS[n];
        }
        return String.valueOf(n);
    }

    private static String sanitizeAssistProse(String input) {
        if (String.isBlank(input)) {
            return input;
        }
        String out = input.replace('—', ',').replace('–', '-');
        out = out.replaceAll('(?m)^#{1,6}\\s*', '');
        out = out.replaceAll('\\*\\*([^*]+)\\*\\*', '$1');
        out = out.replaceAll('__([^_]+)__', '$1');
        out = out.replaceAll('(?<!\\w)\\*([^*]+)\\*(?!\\w)', '$1');
        out = out.replaceAll('(?<!\\w)_([^_]+)_(?!\\w)', '$1');
        out = out.replaceAll('`([^`]+)`', '$1');
        out = out.replaceAll('(?m)^\\s*[-*+]\\s+', '');
        out = out.replaceAll('(?m)^\\s*\\d+\\.\\s+', '');
        while (out.contains(',,')) {
            out = out.replace(',,', ',');
        }
        out = out.replace(' ,', ',');

        List<String> dates = new List<String>();
        out = stashDates(out, dates);

        Pattern p = Pattern.compile('(?<![0-9A-Za-z_])([0-9])(?![0-9A-Za-z_])');
        Matcher m = p.matcher(out);
        String rebuilt = '';
        Integer last = 0;
        while (m.find()) {
            rebuilt += out.substring(last, m.start());
            Integer digit = Integer.valueOf(m.group(1));
            rebuilt += NUMBER_WORDS[digit];
            last = m.end();
        }
        rebuilt += out.substring(last);
        return restoreDates(rebuilt.trim(), dates);
    }

    private static String stashDates(String input, List<String> dates) {
        String out = input;
        out = stashPattern(out, dates, '\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b');
        out = stashPattern(out, dates, '\\b\\d{1,2}/\\d{1,2}/\\d{2,4}\\b');
        out = stashPattern(
            out,
            dates,
            '(?i)\\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b'
        );
        out = stashPattern(
            out,
            dates,
            '(?i)\\b\\d{1,2}(?:st|nd|rd|th)?\\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\s+\\d{4}\\b'
        );
        return out;
    }

    private static String stashPattern(String input, List<String> dates, String regex) {
        Pattern p = Pattern.compile(regex);
        Matcher m = p.matcher(input);
        String rebuilt = '';
        Integer last = 0;
        while (m.find()) {
            rebuilt += input.substring(last, m.start());
            String token = '__DATE' + String.valueOf(dates.size()) + '__';
            dates.add(m.group(0));
            rebuilt += token;
            last = m.end();
        }
        rebuilt += input.substring(last);
        return rebuilt;
    }

    private static String restoreDates(String input, List<String> dates) {
        String out = input;
        for (Integer i = 0; i < dates.size(); i++) {
            out = out.replace('__DATE' + String.valueOf(i) + '__', dates[i]);
        }
        return out;
    }

    private static List<String> sanitizeStringList(List<String> items, Boolean prose) {
        if (items == null) return new List<String>();
        List<String> cleaned = new List<String>();
        for (String item : items) {
            if (String.isBlank(item)) {
                cleaned.add(item);
            } else if (prose == true) {
                cleaned.add(sanitizeAssistProse(item));
            } else {
                cleaned.add(item.replace('—', ',').replace('–', '-'));
            }
        }
        return cleaned;
    }

    private static AssistResult sanitizeResult(AssistResult result) {
        if (result == null) {
            return null;
        }
        result.summary = sanitizeAssistProse(result.summary);
        result.draftNote = sanitizeAssistProse(result.draftNote);
        result.nextAction = sanitizeAssistProse(result.nextAction);
        result.intakeSummary = sanitizeAssistProse(result.intakeSummary);
        result.missingItems = sanitizeStringList(result.missingItems, false);
        result.reconciledNames = sanitizeStringList(result.reconciledNames, true);
        result.exceptions = sanitizeStringList(result.exceptions, true);
        result.insights = sanitizeStringList(result.insights, true);
        result.completenessGaps = sanitizeStringList(result.completenessGaps, true);
        result.documentFindings = sanitizeStringList(result.documentFindings, true);
        result.hasExceptions = result.exceptions != null && !result.exceptions.isEmpty();
        return result;
    }

    private static AssistResult buildLocalAssist(AssistContext ctx) {
        List<String> missing = collectMissingChecklist(ctx);

        Decimal attemptsDec = (ctx.app != null && ctx.app.Attempt_Count__c != null)
            ? ctx.app.Attempt_Count__c
            : 0;
        Integer attempts = Integer.valueOf(attemptsDec);
        Integer nextAttempt = Math.min(attempts + 1, 3);
        String providerName = ctx.provider != null ? ctx.provider.Name : 'Provider';
        String statusLabel = ctx.app != null ? ctx.app.Status__c : 'n/a';

        AssistResult result = new AssistResult();
        result.missingItems = missing;
        applyLocalIntakeAnalysis(ctx, result);

        if (ctx.providerScoped && ctx.app == null) {
            result.summary = providerName + ' Provider 360 reviewed with no credentialing applications on file.';
            result.draftNote = 'Hi. Reviewing the provider profile for ' + providerName
                + '. Please confirm whether a new credentialing application should be opened.';
            result.nextAction = result.hasExceptions
                ? 'Resolve intake exceptions with Spec before opening a new application.'
                : 'Confirm with Spec whether to open a New or Recred application.';
        } else if (missing.isEmpty()) {
            result.summary = providerName + (ctx.providerScoped ? ' Provider 360' : ' application')
                + ' looks checklist-complete (status ' + statusLabel + '). Ready for Spec review before advancing.';
            result.draftNote = 'Hi. Following up on the credentialing application for '
                + providerName + '. Checklist appears complete on our side. Please confirm any outstanding attestations so we can move this to review.';
            result.nextAction = result.hasExceptions
                ? 'Resolve intake exceptions with Spec before advancing toward In Review.'
                : 'Confirm completeness with Spec, then advance toward In Review.';
        } else {
            result.summary = providerName + ' is blocked on ' + spellSmallNumber(missing.size())
                + ' checklist item(s) (status ' + statusLabel + ', attempt ' + spellSmallNumber(attempts) + ').';
            List<String> lines = new List<String>();
            lines.add('Hi. This is outreach attempt ' + spellSmallNumber(nextAttempt)
                + ' regarding the credentialing application for ' + providerName + '. We still need:');
            for (String m : missing) {
                lines.add('- ' + m);
            }
            lines.add('');
            lines.add('Please send the outstanding items by the due date so we can continue processing.');
            result.draftNote = String.join(lines, '\n');
            result.nextAction = result.hasExceptions
                ? 'Chase missing items and route intake exceptions for Spec review.'
                : (attempts >= 2
                    ? 'Log Task for Spec; prepare TL escalation if attempt three fails.'
                    : 'Create Spec Task for chase attempt ' + spellSmallNumber(nextAttempt) + ' and attach this draft.');
        }
        if (result.hasExceptions) {
            result.summary += ' Intake exceptions require review.';
        }
        if (result.completenessGaps != null && !result.completenessGaps.isEmpty()) {
            result.summary += ' Completeness gaps noted.';
        }
        result.source = 'local';
        applyCompletenessScore(ctx, result);
        return sanitizeResult(result);
    }

    private static List<String> collectMissingChecklist(AssistContext ctx) {
        List<String> missing = new List<String>();
        if (ctx.checklist == null) return missing;

        Map<Id, String> appNames = new Map<Id, String>();
        if (ctx.applications != null) {
            for (Credentialing_Application__c a : ctx.applications) {
                appNames.put(a.Id, a.Name);
            }
        }

        Set<Id> focusAppIds = new Set<Id>();
        if (ctx.providerScoped) {
            for (Credentialing_Application__c a : ctx.applications) {
                if (OPEN_APP_STATUSES.contains(a.Status__c)) {
                    focusAppIds.add(a.Id);
                }
            }
        } else if (ctx.app != null) {
            focusAppIds.add(ctx.app.Id);
        }

        for (Checklist_Item__c item : ctx.checklist) {
            if (item.Complete__c == true || item.Required__c == false) continue;
            if (!focusAppIds.isEmpty() && !focusAppIds.contains(item.Credentialing_Application__c)) {
                continue;
            }
            String label = item.Name;
            if (ctx.providerScoped && appNames.containsKey(item.Credentialing_Application__c)) {
                label = appNames.get(item.Credentialing_Application__c) + ': ' + item.Name;
            }
            missing.add(label);
        }
        return missing;
    }

    @TestVisible
    private static void applyLocalIntakeAnalysis(AssistContext ctx, AssistResult result) {
        result.reconciledNames = new List<String>();
        result.exceptions = new List<String>();
        result.insights = new List<String>();
        result.completenessGaps = new List<String>();
        result.documentFindings = new List<String>();

        analyzeIdentity(ctx, result);
        analyzeSpecialty(ctx, result);
        analyzeCompleteness(ctx, result);
        analyzeCredentialHealth(ctx, result);
        analyzeApplicationHealth(ctx, result);
        analyzeDocuments(ctx, result);

        if (result.exceptions.isEmpty() && result.reconciledNames.isEmpty()
            && result.completenessGaps.isEmpty() && result.documentFindings.isEmpty()) {
            result.intakeSummary = 'Provider 360 signals reviewed. No strong identity, specialty, completeness, or document conflicts detected from structured data.';
        } else if (!result.exceptions.isEmpty()) {
            result.intakeSummary = 'Provider 360 review found '
                + spellSmallNumber(result.exceptions.size())
                + ' exception(s) requiring specialist review.';
        } else if (!result.completenessGaps.isEmpty()) {
            result.intakeSummary = 'Provider 360 review found '
                + spellSmallNumber(result.completenessGaps.size())
                + ' completeness gap(s). Identity variants reconciled where present.';
        } else {
            result.intakeSummary = 'Provider 360 identity variants reconciled. No specialty exceptions flagged.';
        }
        result.hasExceptions = !result.exceptions.isEmpty();
    }

    private static void analyzeIdentity(AssistContext ctx, AssistResult result) {
        List<String> personNames = new List<String>();
        for (Map<String, String> signal : ctx.nameSignals) {
            String source = signal.get('source');
            String value = signal.get('value');
            if (String.isBlank(value)) continue;
            if (source != null && source.startsWith('Uploaded document') && guessPersonNameFromDocumentTitle(value) == null) {
                continue;
            }
            String cleaned = source != null && source.startsWith('Document')
                ? guessPersonNameFromDocumentTitle(value)
                : value;
            if (String.isBlank(cleaned)) cleaned = value;
            if (looksLikePersonName(cleaned)) {
                personNames.add(cleaned);
            }
        }

        if (personNames.size() >= 2) {
            Boolean allCompatible = true;
            for (Integer i = 0; i < personNames.size(); i++) {
                for (Integer j = i + 1; j < personNames.size(); j++) {
                    if (!namesCompatible(personNames[i], personNames[j])) {
                        allCompatible = false;
                        result.exceptions.add(
                            'Identity conflict: "' + personNames[i] + '" vs "' + personNames[j]
                            + '" do not appear to be the same person.'
                        );
                    }
                }
            }
            if (allCompatible) {
                result.reconciledNames.add(
                    'Name variants appear to be the same person (' + String.join(uniqueStrings(personNames), '; ') + ').'
                );
            }
        } else if (personNames.size() == 1) {
            result.reconciledNames.add('Primary identity: ' + personNames[0] + '.');
        }
    }

    private static void analyzeSpecialty(AssistContext ctx, AssistResult result) {
        Map<String, String> familyBySource = new Map<String, String>();
        Set<String> softFamilies = new Set<String>();
        for (Map<String, String> signal : ctx.specialtySignals) {
            String source = signal.get('source');
            String value = signal.get('value');
            String family = specialtyFamily(value);
            if (family == null || family == 'UNKNOWN') continue;
            if (source != null && (source.contains('document') || source.contains('Document'))) {
                continue;
            }
            familyBySource.put(source + '=' + value, family);
            softFamilies.add(family);
        }

        Set<String> families = new Set<String>(familyBySource.values());
        if (families.size() >= 2) {
            if (isRelatedSpecialtyCluster(families)) {
                result.insights.add(
                    'Related specialties noted across sources (' + String.join(new List<String>(families), ', ')
                    + '). Same practice family; soft observation only.'
                );
            } else {
                List<String> detail = new List<String>();
                for (String key : familyBySource.keySet()) {
                    detail.add(key + ' [' + familyBySource.get(key) + ']');
                }
                result.exceptions.add(
                    'Specialty mismatch across sources requires review: ' + String.join(detail, '; ') + '.'
                );
            }
        }
    }

    private static Boolean isRelatedSpecialtyCluster(Set<String> families) {
        // Cardiothoracic + Cardiology are related; treat as soft insight rather than hard exception
        if (families.size() == 2
            && families.contains('CARDIOLOGY')
            && families.contains('CARDIOTHORACIC')) {
            return true;
        }
        return false;
    }

    private static void analyzeCompleteness(AssistContext ctx, AssistResult result) {
        if (ctx.provider == null) return;
        Boolean isPractitioner = ctx.provider.Subject_Type__c == 'Practitioner'
            || (ctx.app != null && ctx.app.Subject_Type__c == 'Practitioner');

        if (isPractitioner) {
            if (String.isBlank(ctx.provider.NPI__c)) {
                result.completenessGaps.add('Practitioner NPI is missing.');
            }
            if (ctx.provider.Date_Of_Birth__c == null) {
                result.completenessGaps.add('Practitioner date of birth is missing.');
            }
        }
        if (ctx.addresses == null || ctx.addresses.isEmpty()) {
            result.completenessGaps.add('No provider addresses on file.');
        }
        if (ctx.education == null || ctx.education.isEmpty()) {
            result.completenessGaps.add('No education history on file.');
        }
        if (ctx.workHistory == null || ctx.workHistory.isEmpty()) {
            result.completenessGaps.add('No work history on file.');
        }

        Boolean hasOpenIncomplete = false;
        if (ctx.applications != null) {
            for (Credentialing_Application__c a : ctx.applications) {
                if (a.Status__c == 'Intake' || a.Status__c == 'Draft') {
                    hasOpenIncomplete = true;
                    break;
                }
            }
        }
        if (hasOpenIncomplete && (ctx.documents == null || ctx.documents.isEmpty())) {
            result.completenessGaps.add('Open intake application has no linked documents.');
        }
    }

    private static AssistResult withCompletenessScore(AssistContext ctx, AssistResult result) {
        if (result == null) {
            return null;
        }
        applyCompletenessScore(ctx, result);
        return result;
    }

    /**
     * Deterministic score from structured Provider 360 signals (not model-generated).
     * Weighted: identity, addresses, education/work (practitioners), credentials,
     * required checklist completion, and linked documents.
     */
    private static void applyCompletenessScore(AssistContext ctx, AssistResult result) {
        List<String> missingParts = new List<String>();
        Integer earned = 0;
        Integer possible = 0;

        Boolean isPractitioner = ctx.provider != null && (
            ctx.provider.Subject_Type__c == 'Practitioner'
            || (ctx.app != null && ctx.app.Subject_Type__c == 'Practitioner')
        );

        if (ctx.provider != null) {
            if (isPractitioner) {
                possible += 10;
                if (String.isNotBlank(ctx.provider.NPI__c)) {
                    earned += 10;
                } else {
                    missingParts.add('NPI');
                }
                possible += 10;
                if (ctx.provider.Date_Of_Birth__c != null) {
                    earned += 10;
                } else {
                    missingParts.add('date of birth');
                }
            }
            possible += 5;
            if (String.isNotBlank(ctx.provider.Specialty__c)
                || String.isNotBlank(ctx.provider.Facility_Type__c)) {
                earned += 5;
            } else {
                missingParts.add(isPractitioner ? 'specialty' : 'facility type');
            }
        }

        possible += 15;
        if (ctx.addresses != null && !ctx.addresses.isEmpty()) {
            earned += 15;
        } else {
            missingParts.add('address');
        }

        if (isPractitioner) {
            possible += 10;
            if (ctx.education != null && !ctx.education.isEmpty()) {
                earned += 10;
            } else {
                missingParts.add('education');
            }
            possible += 10;
            if (ctx.workHistory != null && !ctx.workHistory.isEmpty()) {
                earned += 10;
            } else {
                missingParts.add('work history');
            }
        }

        possible += 15;
        Boolean hasValidCredential = false;
        if (ctx.credentials != null) {
            Date today = Date.today();
            for (Provider_Credential__c c : ctx.credentials) {
                if (c.Status__c == 'Expired') continue;
                if (c.Expiration_Date__c != null && c.Expiration_Date__c < today) continue;
                hasValidCredential = true;
                break;
            }
        }
        if (hasValidCredential) {
            earned += 15;
        } else {
            missingParts.add('valid credential');
        }

        Integer requiredTotal = 0;
        Integer requiredComplete = 0;
        Set<Id> focusAppIds = new Set<Id>();
        if (ctx.providerScoped && ctx.applications != null) {
            for (Credentialing_Application__c a : ctx.applications) {
                if (OPEN_APP_STATUSES.contains(a.Status__c)) {
                    focusAppIds.add(a.Id);
                }
            }
        } else if (ctx.app != null) {
            focusAppIds.add(ctx.app.Id);
        }
        if (ctx.checklist != null) {
            for (Checklist_Item__c item : ctx.checklist) {
                if (item.Required__c == false) continue;
                if (!focusAppIds.isEmpty() && !focusAppIds.contains(item.Credentialing_Application__c)) {
                    continue;
                }
                requiredTotal++;
                if (item.Complete__c == true) {
                    requiredComplete++;
                }
            }
        }
        possible += 15;
        if (requiredTotal == 0) {
            earned += 15;
        } else {
            earned += Integer.valueOf(Math.floor((Decimal.valueOf(requiredComplete) / requiredTotal) * 15));
            Integer openRequired = requiredTotal - requiredComplete;
            if (openRequired > 0) {
                missingParts.add(spellSmallNumber(openRequired) + ' checklist item(s)');
            }
        }

        possible += 10;
        if (ctx.documents != null && !ctx.documents.isEmpty()) {
            earned += 10;
        } else {
            missingParts.add('linked documents');
        }

        Integer score = possible == 0
            ? 0
            : Integer.valueOf(Math.round((Decimal.valueOf(earned) / possible) * 100));
        if (score > 100) score = 100;
        if (score < 0) score = 0;
        result.completenessScore = score;

        String band = score >= 85 ? 'Strong' : (score >= 60 ? 'Partial' : 'Low');
        String explainer = band + ' completeness (' + String.valueOf(score)
            + '). Weighted across identity, addresses'
            + (isPractitioner ? ', education, work history' : '')
            + ', credentials, required checklist, and documents.';
        if (!missingParts.isEmpty()) {
            Integer show = Math.min(4, missingParts.size());
            List<String> shown = new List<String>();
            for (Integer i = 0; i < show; i++) {
                shown.add(missingParts[i]);
            }
            explainer += ' Gaps: ' + String.join(shown, ', ') + '.';
            if (missingParts.size() > show) {
                explainer += ' +' + String.valueOf(missingParts.size() - show) + ' more.';
            }
        } else {
            explainer += ' No major structured gaps detected.';
        }
        result.completenessExplainer = explainer;
    }

    private static void analyzeCredentialHealth(AssistContext ctx, AssistResult result) {
        if (ctx.credentials == null) return;
        Date today = Date.today();
        Date soon = today.addDays(90);
        for (Provider_Credential__c c : ctx.credentials) {
            if (c.Expiration_Date__c == null) continue;
            String label = String.isNotBlank(c.Credential_Type__c) ? c.Credential_Type__c : c.Name;
            if (c.Expiration_Date__c < today || c.Status__c == 'Expired') {
                result.completenessGaps.add(
                    'Credential expired: ' + label + ' (' + String.valueOf(c.Expiration_Date__c) + ').'
                );
            } else if (c.Expiration_Date__c <= soon) {
                result.insights.add(
                    'Credential expiring within 90 days: ' + label + ' on '
                    + String.valueOf(c.Expiration_Date__c) + '.'
                );
            }
        }
    }

    private static void analyzeApplicationHealth(AssistContext ctx, AssistResult result) {
        if (ctx.applications == null) return;

        Integer openCount = 0;
        Integer incompleteOpen = 0;
        Boolean hasOpenRecred = false;
        for (Credentialing_Application__c a : ctx.applications) {
            if (!OPEN_APP_STATUSES.contains(a.Status__c)) continue;
            openCount++;
            if (a.Status__c == 'Intake' || a.Status__c == 'Draft') {
                incompleteOpen++;
            }
            if (a.Application_Type__c == 'Recred') {
                hasOpenRecred = true;
            }
            if (a.Due_Date__c != null && a.Due_Date__c < Date.today()
                && (a.Status__c == 'Intake' || a.Status__c == 'Draft')) {
                result.completenessGaps.add(
                    'Application ' + a.Name + ' is past due (' + String.valueOf(a.Due_Date__c) + ').'
                );
            } else if (a.Due_Date__c != null && a.Due_Date__c <= Date.today().addDays(14)
                && (a.Status__c == 'Intake' || a.Status__c == 'Draft')) {
                result.insights.add(
                    'Application ' + a.Name + ' due soon (' + String.valueOf(a.Due_Date__c) + ').'
                );
            }
        }

        if (incompleteOpen > 0 && ctx.checklist != null) {
            Integer incompleteItems = 0;
            for (Checklist_Item__c item : ctx.checklist) {
                if (item.Complete__c != true && item.Required__c != false) {
                    incompleteItems++;
                }
            }
            if (incompleteItems > 0) {
                result.insights.add(
                    'Open application(s) have ' + spellSmallNumber(incompleteItems)
                    + ' incomplete required checklist item(s).'
                );
            }
        }

        if (openCount >= 2) {
            result.insights.add(
                'Provider has ' + spellSmallNumber(openCount) + ' open credentialing applications.'
            );
        }

        if (ctx.provider != null && ctx.provider.Recred_Due_Date__c != null) {
            Date recredDue = ctx.provider.Recred_Due_Date__c;
            if (recredDue <= Date.today().addDays(90) && !hasOpenRecred) {
                result.completenessGaps.add(
                    'Recred due ' + String.valueOf(recredDue) + ' with no open Recred application.'
                );
            } else if (recredDue <= Date.today().addDays(180) && !hasOpenRecred) {
                result.insights.add(
                    'Recred due ' + String.valueOf(recredDue) + '; no open Recred application yet.'
                );
            }
        }
    }

    private static void analyzeDocuments(AssistContext ctx, AssistResult result) {
        Integer docCount = ctx.documents == null ? 0 : ctx.documents.size();
        if (docCount == 0) {
            result.documentFindings.add('No documents linked to provider or related applications.');
            return;
        }
        result.documentFindings.add(
            'Found ' + spellSmallNumber(docCount) + ' linked document(s) across provider and applications.'
        );

        String lastName = ctx.provider != null ? ctx.provider.Last_Name__c : null;
        if (String.isBlank(lastName) && ctx.provider != null && String.isNotBlank(ctx.provider.Name)) {
            List<String> nameParts = ctx.provider.Name.trim().split('\\s+');
            if (!nameParts.isEmpty()) {
                lastName = nameParts[nameParts.size() - 1];
            }
        }
        if (String.isNotBlank(lastName)) {
            String lastLower = lastName.toLowerCase().replaceAll('[^a-z]', '');
            Integer matched = 0;
            Integer checked = 0;
            for (DocumentInfo doc : ctx.documents) {
                checked++;
                String titleNorm = doc.title.toLowerCase().replaceAll('[^a-z]', '');
                if (titleNorm.contains(lastLower)) {
                    matched++;
                }
            }
            if (checked > 0 && matched == 0) {
                result.documentFindings.add(
                    'Document titles do not appear to include provider last name "' + lastName + '".'
                );
            } else if (matched > 0 && matched < checked) {
                result.insights.add(
                    'Some document titles include last name "' + lastName + '" ('
                    + spellSmallNumber(matched) + ' of ' + spellSmallNumber(checked) + ').'
                );
            }
        }

        // Expected attachment heuristics vs incomplete checklist items
        Map<String, List<String>> expectedTokens = new Map<String, List<String>>{
            'medical_license_copy' => new List<String>{ 'license', 'lic' },
            'dea_certificate' => new List<String>{ 'dea' },
            'board_certification' => new List<String>{ 'board', 'cert' },
            'malpractice_coi' => new List<String>{ 'malpractice', 'coi', 'insurance' },
            'cv_resume' => new List<String>{ 'cv', 'resume', 'curriculum' },
            'npi_confirmation' => new List<String>{ 'npi' }
        };

        Set<Id> focusApps = new Set<Id>();
        if (ctx.providerScoped) {
            for (Credentialing_Application__c a : ctx.applications) {
                if (a.Status__c == 'Intake' || a.Status__c == 'Draft') {
                    focusApps.add(a.Id);
                }
            }
        } else if (ctx.app != null) {
            focusApps.add(ctx.app.Id);
        }

        String allTitles = String.join(ctx.documentTitles, ' ').toLowerCase();
        for (Checklist_Item__c item : ctx.checklist) {
            if (item.Complete__c == true) continue;
            if (!focusApps.isEmpty() && !focusApps.contains(item.Credentialing_Application__c)) {
                continue;
            }
            String key = item.Item_Key__c == null ? '' : item.Item_Key__c.toLowerCase();
            List<String> tokens = expectedTokens.get(key);
            if (tokens == null) {
                // Fuzzy match on item name
                String nameLower = item.Name == null ? '' : item.Name.toLowerCase();
                if (nameLower.contains('license')) tokens = new List<String>{ 'license', 'lic' };
                else if (nameLower.contains('dea')) tokens = new List<String>{ 'dea' };
                else if (nameLower.contains('board')) tokens = new List<String>{ 'board', 'cert' };
                else if (nameLower.contains('cv') || nameLower.contains('resume')) {
                    tokens = new List<String>{ 'cv', 'resume' };
                } else if (nameLower.contains('malpractice') || nameLower.contains('coi')) {
                    tokens = new List<String>{ 'malpractice', 'coi' };
                }
            }
            if (tokens == null) continue;
            Boolean found = false;
            for (String tok : tokens) {
                if (allTitles.contains(tok)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                result.documentFindings.add(
                    'Expected attachment for incomplete checklist item "' + item.Name + '" not found in document titles.'
                );
            }
        }
    }

    private static List<String> uniqueStrings(List<String> values) {
        Set<String> seen = new Set<String>();
        List<String> out = new List<String>();
        for (String v : values) {
            String key = normalizeName(v);
            if (seen.contains(key)) continue;
            seen.add(key);
            out.add(v);
        }
        return out;
    }

    @TestVisible
    private static Boolean looksLikePersonName(String value) {
        if (String.isBlank(value)) return false;
        List<String> tokens = nameTokens(value);
        return tokens.size() >= 2 && tokens.size() <= 5;
    }

    @TestVisible
    private static String normalizeName(String value) {
        if (value == null) return '';
        String v = value.toLowerCase();
        v = v.replaceAll('[^a-z\\s]', ' ');
        v = v.replaceAll('\\b(md|do|mbbs|phd|jr|sr|ii|iii|iv|dds|dpm|np|pa|facs|facc)\\b', ' ');
        v = v.replaceAll('\\s+', ' ').trim();
        return v;
    }

    private static List<String> nameTokens(String value) {
        String n = normalizeName(value);
        if (String.isBlank(n)) return new List<String>();
        return n.split(' ');
    }

    @TestVisible
    private static Boolean namesCompatible(String a, String b) {
        List<String> ta = nameTokens(a);
        List<String> tb = nameTokens(b);
        if (ta.isEmpty() || tb.isEmpty()) return false;
        String lastA = ta[ta.size() - 1];
        String lastB = tb[tb.size() - 1];
        if (lastA != lastB) return false;

        String firstA = ta[0];
        String firstB = tb[0];
        if (firstA == firstB) return true;
        if (firstA.startsWith(firstB) || firstB.startsWith(firstA)) return true;
        if (firstA.length() == 1 && firstB.startsWith(firstA)) return true;
        if (firstB.length() == 1 && firstA.startsWith(firstB)) return true;
        return false;
    }

    @TestVisible
    private static String specialtyFamily(String raw) {
        if (String.isBlank(raw)) return null;
        String v = raw.toLowerCase();
        if (v.contains('cardiothoracic') || v.contains('cardiac surg') || v.contains('cardiovascular surg')) {
            return 'CARDIOTHORACIC';
        }
        if (v.contains('cardiolog') || v.contains('cardiac') || v.contains('cardiovascular')) {
            return 'CARDIOLOGY';
        }
        if (v.contains('internal medicine') || v.contains('internist')) {
            return 'INTERNAL_MEDICINE';
        }
        if (v.contains('family medicine') || v.contains('family practice')) {
            return 'FAMILY_MEDICINE';
        }
        if (v.contains('emergency')) return 'EMERGENCY';
        if (v.contains('pediatr')) return 'PEDIATRICS';
        if (v.contains('orthop')) return 'ORTHOPEDICS';
        if (v.contains('anesthes')) return 'ANESTHESIA';
        if (v.contains('radiolog')) return 'RADIOLOGY';
        if (v.contains('psychiatr')) return 'PSYCHIATRY';
        if (v.contains('surg')) return 'SURGERY';
        return 'UNKNOWN';
    }

    private static AssistResult callBridge(AssistContext ctx, Cred_Assist_Config__mdt config, AssistResult local) {
        try {
            String endpoint = config.Bridge_URL__c;
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.substring(0, endpoint.length() - 1);
            }
            endpoint += '/api/cred-assist';

            HttpRequest req = new HttpRequest();
            req.setMethod('POST');
            req.setEndpoint(endpoint);
            req.setHeader('Content-Type', 'application/json');
            if (String.isNotBlank(config.Bridge_Secret__c)) {
                req.setHeader('Authorization', 'Bearer ' + config.Bridge_Secret__c);
            }
            req.setTimeout(20000);
            req.setBody(buildPayloadJson(ctx));

            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
                return null;
            }
            return parseAssistResponse(res.getBody(), local, 'claude');
        } catch (Exception e) {
            return null;
        }
    }

    private static AssistResult callClaude(AssistContext ctx, Cred_Assist_Config__mdt config, AssistResult local) {
        try {
            lastCalloutError = null;
            HttpRequest req = new HttpRequest();
            req.setMethod('POST');
            req.setEndpoint('https://api.anthropic.com/v1/messages');
            req.setHeader('Content-Type', 'application/json');
            req.setHeader('x-api-key', config.Claude_Api_Key__c);
            req.setHeader('anthropic-version', '2023-06-01');
            // Provider 360 payloads need longer than the default 10s; Apex max is 120s.
            req.setTimeout(120000);

            String model = config.Model__c;
            if (String.isBlank(model)
                || model == 'claude-sonnet-4-20250514'
                || model.contains('20250514')) {
                model = 'claude-sonnet-4-5';
            }
            Map<String, Object> body = new Map<String, Object>();
            body.put('model', model);
            body.put('max_tokens', 1200);
            body.put(
                'system',
                'You are a credentialing intake and operations assistant for a healthcare payer POC.'
                + ' Scrutinize ALL provider 360 data, documents, and inputs in the payload.'
                + ' Prefer refining localHints when present. Keep every string concise (one to two sentences max per item).'
                + ' Return ONLY valid JSON with keys: summary, missingItems, draftNote, nextAction,'
                + ' intakeSummary, reconciledNames (string[]), exceptions (string[]),'
                + ' insights (string[]), completenessGaps (string[]), documentFindings (string[]).'
                + ' Do not approve, deny, change status, or send mail.'
                + STYLE_RULES
                + INTAKE_RULES
            );
            Map<String, Object> message = new Map<String, Object>();
            message.put('role', 'user');
            message.put('content', buildPayloadJson(ctx, local));
            body.put('messages', new List<Object>{ message });
            req.setBody(JSON.serialize(body));

            HttpResponse res = new Http().send(req);
            if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
                lastCalloutError = 'HTTP ' + res.getStatusCode() + ' ' + truncateErr(res.getBody());
                return null;
            }

            Map<String, Object> parsed = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
            Object contentObj = parsed.get('content');
            if (!(contentObj instanceof List<Object>)) {
                lastCalloutError = 'No content list';
                return null;
            }
            List<Object> content = (List<Object>) contentObj;
            if (content.isEmpty()) {
                lastCalloutError = 'Empty content';
                return null;
            }
            Map<String, Object> first = (Map<String, Object>) content[0];
            String textBody = String.valueOf(first.get('text'));
            AssistResult parsedResult = parseAssistResponse(textBody, local, 'claude');
            if (parsedResult == null) {
                lastCalloutError = 'Parse failed for ' + truncateErr(textBody);
            }
            return parsedResult;
        } catch (System.CalloutException ce) {
            lastCalloutError = ce.getMessage();
            return null;
        } catch (Exception e) {
            lastCalloutError = e.getMessage();
            return null;
        }
    }

    private static String truncateErr(String body) {
        if (String.isBlank(body)) return '';
        return body.length() > 400 ? body.substring(0, 400) : body;
    }

    private static String buildPayloadJson(AssistContext ctx) {
        return buildPayloadJson(ctx, null);
    }

    private static String buildPayloadJson(AssistContext ctx, AssistResult localHints) {
        Map<String, Object> payload = new Map<String, Object>();
        payload.put('mode', 'provider_360_intake_and_chase');
        payload.put('scope', ctx.providerScoped ? 'provider' : 'application');
        payload.put('recordId', ctx.recordId);

        if (ctx.app != null) {
            payload.put('application', serializeApplication(ctx.app));
        }
        List<Object> applications = new List<Object>();
        if (ctx.applications != null) {
            for (Credentialing_Application__c a : ctx.applications) {
                applications.add(serializeApplication(a));
            }
        }
        payload.put('applications', applications);

        payload.put('provider', new Map<String, Object>{
            'id' => ctx.provider.Id,
            'name' => ctx.provider.Name,
            'firstName' => ctx.provider.First_Name__c,
            'middleName' => ctx.provider.Middle_Name__c,
            'lastName' => ctx.provider.Last_Name__c,
            'nameSuffix' => ctx.provider.Name_Suffix__c,
            'externalId' => ctx.provider.External_Id__c,
            'npi' => ctx.provider.NPI__c,
            'dateOfBirth' => ctx.provider.Date_Of_Birth__c,
            'subjectType' => ctx.provider.Subject_Type__c,
            'specialty' => ctx.provider.Specialty__c,
            'facilityType' => ctx.provider.Facility_Type__c,
            'recredDueDate' => ctx.provider.Recred_Due_Date__c
        });

        List<Object> checklist = new List<Object>();
        for (Checklist_Item__c item : ctx.checklist) {
            checklist.add(new Map<String, Object>{
                'key' => item.Item_Key__c,
                'label' => item.Name,
                'required' => item.Required__c,
                'complete' => item.Complete__c == true,
                'applicationId' => item.Credentialing_Application__c
            });
        }
        payload.put('checklist', checklist);

        List<Object> creds = new List<Object>();
        for (Provider_Credential__c c : ctx.credentials) {
            creds.add(new Map<String, Object>{
                'type' => c.Credential_Type__c,
                'name' => c.Name,
                'status' => c.Status__c,
                'issuingAuthority' => c.Issuing_Authority__c,
                'credentialNumber' => c.Credential_Number__c,
                'expirationDate' => c.Expiration_Date__c
            });
        }
        payload.put('credentials', creds);

        List<Object> education = new List<Object>();
        for (Education_History__c e : ctx.education) {
            education.add(new Map<String, Object>{
                'institution' => e.Institution_Name__c,
                'degreeType' => e.Degree_Type__c,
                'fieldOfStudy' => e.Field_Of_Study__c
            });
        }
        payload.put('education', education);

        List<Object> work = new List<Object>();
        for (Work_History__c w : ctx.workHistory) {
            work.add(new Map<String, Object>{
                'employer' => w.Employer_Name__c,
                'title' => w.Title__c,
                'department' => w.Department__c,
                'isCurrent' => w.Is_Current__c == true
            });
        }
        payload.put('workHistory', work);

        List<Object> addresses = new List<Object>();
        for (Provider_Address__c a : ctx.addresses) {
            addresses.add(new Map<String, Object>{
                'type' => a.Address_Type__c,
                'line1' => a.Line1__c,
                'city' => a.City__c,
                'state' => a.State__c,
                'postalCode' => a.Postal_Code__c,
                'isPrimary' => a.Is_Primary__c == true
            });
        }
        payload.put('addresses', addresses);

        List<Object> documents = new List<Object>();
        for (DocumentInfo doc : ctx.documents) {
            documents.add(new Map<String, Object>{
                'title' => doc.title,
                'fileType' => doc.fileType,
                'linkedEntityType' => doc.linkedEntityType
            });
        }
        payload.put('documents', documents);
        payload.put('nameSignals', ctx.nameSignals);
        payload.put('specialtySignals', ctx.specialtySignals);
        if (localHints != null) {
            payload.put('localHints', new Map<String, Object>{
                'summary' => localHints.summary,
                'intakeSummary' => localHints.intakeSummary,
                'missingItems' => localHints.missingItems,
                'reconciledNames' => localHints.reconciledNames,
                'exceptions' => localHints.exceptions,
                'insights' => localHints.insights,
                'completenessGaps' => localHints.completenessGaps,
                'documentFindings' => localHints.documentFindings,
                'nextAction' => localHints.nextAction,
                'completenessScore' => localHints.completenessScore,
                'completenessExplainer' => localHints.completenessExplainer
            });
        }
        return JSON.serialize(payload);
    }

    private static Map<String, Object> serializeApplication(Credentialing_Application__c a) {
        return new Map<String, Object>{
            'id' => a.Id,
            'name' => a.Name,
            'externalId' => a.External_Id__c,
            'status' => a.Status__c,
            'applicationType' => a.Application_Type__c,
            'path' => a.Path__c,
            'subjectType' => a.Subject_Type__c,
            'attemptCount' => a.Attempt_Count__c,
            'dueDate' => a.Due_Date__c
        };
    }

    private static AssistResult parseAssistResponse(String raw, AssistResult local, String source) {
        if (String.isBlank(raw)) return null;
        String jsonText = raw.trim();
        if (jsonText.startsWith('{') == false) {
            Integer start = jsonText.indexOf('{');
            Integer last = jsonText.lastIndexOf('}');
            if (start < 0 || last <= start) return null;
            jsonText = jsonText.substring(start, last + 1);
        }

        Map<String, Object> root = (Map<String, Object>) JSON.deserializeUntyped(jsonText);
        if (root.containsKey('data') && root.get('data') instanceof Map<String, Object>) {
            root = (Map<String, Object>) root.get('data');
        }

        AssistResult result = new AssistResult();
        result.summary = root.containsKey('summary') ? String.valueOf(root.get('summary')) : local.summary;
        result.draftNote = root.containsKey('draftNote') ? String.valueOf(root.get('draftNote')) : local.draftNote;
        result.nextAction = root.containsKey('nextAction') ? String.valueOf(root.get('nextAction')) : local.nextAction;
        result.intakeSummary = root.containsKey('intakeSummary')
            ? String.valueOf(root.get('intakeSummary'))
            : local.intakeSummary;
        result.source = source;
        result.missingItems = new List<String>();
        if (root.get('missingItems') instanceof List<Object>) {
            for (Object o : (List<Object>) root.get('missingItems')) {
                result.missingItems.add(String.valueOf(o));
            }
        } else {
            result.missingItems = local.missingItems;
        }
        result.reconciledNames = parseStringList(root.get('reconciledNames'), local.reconciledNames);
        result.exceptions = parseStringList(root.get('exceptions'), local.exceptions);
        result.insights = parseStringList(root.get('insights'), local.insights);
        result.completenessGaps = parseStringList(root.get('completenessGaps'), local.completenessGaps);
        result.documentFindings = parseStringList(root.get('documentFindings'), local.documentFindings);
        return sanitizeResult(result);
    }

    private static List<String> parseStringList(Object raw, List<String> fallback) {
        List<String> out = new List<String>();
        if (raw instanceof List<Object>) {
            for (Object o : (List<Object>) raw) {
                out.add(String.valueOf(o));
            }
            return out;
        }
        return fallback == null ? new List<String>() : fallback;
    }
}
