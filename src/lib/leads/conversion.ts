import "server-only";

import type { Prisma, Lead, InsuranceLine } from "@prisma/client";
import { encryptSensitiveValue, maskedPreviewFor, ARCHIVED_SENSITIVE_PREFIX } from "@/lib/sensitiveData";
import { getLineDef, parseYmd, readStoredLineDetails, type ListItem } from "@/lib/leads/lineSchema";

/**
 * Lead → Cliente: lleva los campos de la línea de negocio del lead
 * (Lead.lineDetails) al perfil 1:1 del cliente que corresponde a ESA línea
 * (MedicareProfile, ObamacareProfile o FamilyHeritageProfile), y copia los
 * datos restringidos (ya cifrados, sin descifrarlos) a SensitiveField del
 * cliente. Corre dentro de la misma transacción de la conversión.
 */
export async function copyLeadDataToClient(
  tx: Prisma.TransactionClient,
  lead: Lead & { interestedLine: InsuranceLine | null },
  clientId: string
): Promise<void> {
  // ── Datos restringidos ya guardados en el lead ──
  const leadSensitive = await tx.sensitiveField.findMany({
    where: { leadId: lead.id, NOT: { fieldKey: { startsWith: ARCHIVED_SENSITIVE_PREFIX } } },
  });
  // Claves conocidas por el panel de datos sensibles del cliente.
  const clientKeyFor = (leadKey: string) =>
    ({
      "FAMILY_HERITAGE.routingNumber": "routing_number",
      "FAMILY_HERITAGE.accountNumber": "bank_account_number",
    })[leadKey] ?? leadKey;
  const refByLeadKey = new Map<string, string>();
  for (const f of leadSensitive) {
    const row = await tx.sensitiveField.create({
      data: {
        clientId,
        fieldKey: clientKeyFor(f.fieldKey),
        encryptedValue: f.encryptedValue,
        maskedPreview: f.maskedPreview,
      },
    });
    refByLeadKey.set(f.fieldKey, row.id);
  }

  /** Cifra un valor que en el lead era texto normal pero que el perfil del
   * cliente modela como referencia a SensitiveField (ej. N.º de Medicare). */
  async function sensitiveRef(fieldKey: string, value: string | undefined): Promise<string | null> {
    const plain = (value ?? "").trim();
    if (!plain) return null;
    const row = await tx.sensitiveField.upsert({
      where: { clientId_fieldKey: { clientId, fieldKey } },
      update: { encryptedValue: encryptSensitiveValue(plain), maskedPreview: maskedPreviewFor(plain) },
      create: { clientId, fieldKey, encryptedValue: encryptSensitiveValue(plain), maskedPreview: maskedPreviewFor(plain) },
    });
    return row.id;
  }

  const code = getLineDef(lead.interestedLine?.code)?.code ?? null;
  const v = readStoredLineDetails(lead.lineDetails, code);
  if (!code || !v) return;

  const s = (key: string) => (typeof v[key] === "string" ? (v[key] as string) : "");
  const yes = (key: string) => v[key] === "yes";
  const num = (key: string) => {
    const n = Number(s(key));
    return s(key) && Number.isFinite(n) ? n : null;
  };
  const date = (ymd: string) => (parseYmd(ymd) ? new Date(`${ymd}T00:00:00Z`) : null);
  const list = (key: string) => (Array.isArray(v[key]) ? (v[key] as ListItem[]) : []);
  const strOrNull = (x: string | undefined) => (x && x.trim() ? x.trim() : null);
  /** "5' 7\"", "5'7", "5 7" o "67" (pulgadas) → pulgadas totales. */
  const heightInInches = (raw: string): number | null => {
    const t = raw.trim();
    if (!t) return null;
    if (/^\d+(\.\d+)?$/.test(t) && Number(t) > 8) return Number(t); // ya en pulgadas
    const ftIn = /^(\d)\s*(?:'|ft|pies?)?\s*(\d{1,2})?\s*(?:"|in)?$/i.exec(t);
    if (ftIn && Number(ftIn[1]) <= 8) return Number(ftIn[1]) * 12 + Number(ftIn[2] ?? 0);
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  if (code === "MEDICARE") {
    const dual = Array.isArray(v.dualClassification) ? (v.dualClassification as string[]) : [];
    const planType = (x: string) => (["HMO", "PPO", "D_SNP", "C_SNP"].includes(x) ? (x as "HMO") : null);
    const method = (x: string) => (["PHONE", "IN_PERSON", "VIRTUAL"].includes(x) ? (x as "PHONE") : null);
    const [poaFirst, ...poaRest] = s("poaFullName").split(" ");
    await tx.medicareProfile.create({
      data: {
        clientId,
        medicareNumberRef: await sensitiveRef("medicare_number", s("medicareNumber")),
        hasMedicaid: yes("hasMedicaid"),
        medicaidNumberRef: await sensitiveRef("medicaid_number", s("medicaidNumber")),
        dualClassification: dual.filter((d) => d !== "NONE").join(", ") || null,
        qmb: dual.includes("QMB"),
        fbde: dual.includes("FBDE"),
        slmb: dual.includes("SLMB"),
        extraHelp: dual.includes("EXTRA_HELP"),
        healthRating: num("healthRating"),
        weight: num("weight"),
        height: heightInInches(s("height")),
        homeAttendant: yes("homeAttendant"),
        homeAttendantCompany: strOrNull(s("homeAttendantCompany")),
        hasCancer: yes("hasCancer"),
        onDialysis: yes("onDialysis"),
        primaryDoctorName: strOrNull(s("primaryDoctorName")),
        primaryDoctorAddress: strOrNull(s("primaryDoctorAddress")),
        primaryDoctorPhone: strOrNull(s("primaryDoctorPhone")),
        preferredPharmacy: strOrNull(s("preferredPharmacy")),
        offeredCarrierId: strOrNull(s("carrierId")),
        currentPlanName: strOrNull(s("currentPlanName")),
        currentPlanType: planType(s("currentPlanType")),
        offeredPlanName: strOrNull(s("offeredPlanName")),
        offeredPlanType: planType(s("offeredPlanType")),
        changeReason: strOrNull(s("changeReason")),
        electionPeriod: strOrNull(s("electionPeriod")),
        presentationMethod: method(s("presentationMethod")),
        soaSigned: !!s("soaDate"),
        soaDate: date(s("soaDate")),
        soaMethod: strOrNull(s("soaMethod")),
        callRecordingUrl: strOrNull(s("callRecording")),
        effectiveDate: date(s("effectiveDate")),
        confirmationNumber: strOrNull(s("confirmationNumber")),
        poa: yes("hasPoa"),
        poaFirstName: yes("hasPoa") ? strOrNull(poaFirst) : null,
        poaLastName: yes("hasPoa") ? strOrNull(poaRest.join(" ")) : null,
        poaAddress: strOrNull(s("poaAddress")),
        poaPhone: strOrNull(s("poaPhone")),
        poaRelationship: strOrNull(s("poaRelationship")),
        currentAor: yes("hasCurrentAor"),
        currentAorName: strOrNull(s("currentAorName")),
        acceptsAgentChange: yes("acceptsChange"),
        acceptsPlanChange: yes("acceptsChange"),
        signatureUrl: strOrNull(s("signature")),
        conditions: {
          create: list("conditions")
            .filter((c) => c.name)
            .map((c) => ({ name: c.name, isChronic: c.chronic === "yes" })),
        },
        medications: {
          create: list("medications")
            .filter((m) => m.name)
            .map((m) => ({ name: m.name, mg: strOrNull(m.mg), frequency: strOrNull(m.frequency) })),
        },
        specialists: {
          create: list("specialists")
            .filter((sp) => sp.name)
            .map((sp) => ({ name: sp.name, address: strOrNull(sp.address), phone: strOrNull(sp.phone) })),
        },
      },
    });
    return;
  }

  if (code === "OBAMACARE") {
    const planType = (x: string) => (["BRONZE", "SILVER", "GOLD"].includes(x) ? (x as "BRONZE") : null);
    const dob = lead.dob;
    const age = dob ? Math.floor((Date.now() - dob.getTime()) / (365.25 * 86_400_000)) : null;
    await tx.obamacareProfile.create({
      data: {
        clientId,
        age,
        householdIncomeRef: await sensitiveRef("household_income", s("income")),
        householdSize: num("householdSize"),
        immigrationStatusRef: await sensitiveRef("immigration_status", s("immigrationStatus")),
        maritalStatus: strOrNull(s("maritalStatus")),
        hasSpouse: yes("hasSpouse"),
        filesJointTaxes: yes("jointTaxes"),
        hasEmployerCoverage: yes("employerCoverage"),
        period: strOrNull(s("period")),
        carrierId: strOrNull(s("carrierId")),
        planName: strOrNull(s("planName")),
        planType: planType(s("planType")),
        monthlyPremium: num("monthlyPremium"),
        marketplaceApplicationId: strOrNull(s("marketplaceAppId")),
        marketplaceConsent: !!s("consentDate"),
        consentDate: date(s("consentDate")),
        effectiveDate: date(s("effectiveDate")),
        dependents: {
          create: list("dependents").map((d) => ({
            firstName: d.firstName,
            lastName: d.lastName,
            dob: date(d.dob),
            ssnRef: refByLeadKey.get(`OBAMACARE.dependents.${d._id}.ssn`) ?? null,
          })),
        },
      },
    });
    return;
  }

  if (code === "FAMILY_HERITAGE") {
    const plan = s("planType");
    const coverage = s("coverageType");
    const ref = (k: string) => refByLeadKey.get(`FAMILY_HERITAGE.${k}`) ?? null;
    await tx.familyHeritageProfile.create({
      data: {
        clientId,
        planType: ["ELITE_8", "PREFERRED_4", "STANDARD_2"].includes(plan) ? (plan as "ELITE_8") : null,
        coverageType: ["INDIVIDUAL", "COUPLE", "SINGLE_PARENT", "FAMILY"].includes(coverage)
          ? (coverage as "INDIVIDUAL")
          : null,
        issueAge: num("issueAge"),
        rop: yes("rop"),
        monthlyPremium: num("monthlyPremium"),
        policyNumber: strOrNull(s("policyNumber")),
        effectiveDate: date(s("effectiveDate")),
        bankNameRef: ref("bankName"),
        accountHolderRef: ref("accountHolder"),
        accountCityRef: ref("accountCity"),
        routingNumberRef: ref("routingNumber"),
        accountNumberRef: ref("accountNumber"),
        coveredMembers: {
          create: list("coveredMembers").map((m) => ({
            firstName: m.firstName,
            lastName: m.lastName,
            dob: date(m.dob),
            relationship: strOrNull(m.relationship),
            ssnRef: refByLeadKey.get(`FAMILY_HERITAGE.coveredMembers.${m._id}.ssn`) ?? null,
          })),
        },
      },
    });
  }
}

