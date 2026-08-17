import { prisma } from "@/lib/db";

export const AISENSY_CONFIG_ID = "default";

export type AisensySettings = {
  apiKey: string | null;
  otpCampaignName: string | null;
  reminderCampaignName: string | null;
  completeCampaignName: string | null;
};

function envFallbackKey(): string | null {
  return (
    process.env.AISENSY_API_KEY?.trim() ||
    process.env.AiSensy_API_KEY?.trim() ||
    process.env.AiSensy_API_KYE?.trim() ||
    process.env.AISENSY_API_KYE?.trim() ||
    null
  );
}

function envFallbackOtpCampaign(): string | null {
  return process.env.AISENSY_CAMPAIGN_NAME?.trim() || null;
}

/** Load AiSensy settings from DB (singleton row). */
export async function getAisensySettings(): Promise<AisensySettings> {
  let row = await prisma.aisensyConfig.findUnique({
    where: { id: AISENSY_CONFIG_ID },
  });

  if (!row) {
    row = await prisma.aisensyConfig.create({
      data: { id: AISENSY_CONFIG_ID },
    });
  }

  let apiKey = row.apiKey?.trim() || null;
  let otpCampaignName = row.otpCampaignName?.trim() || null;

  // One-time bootstrap from .env when DB is empty (remove from .env after saving here).
  const patches: Partial<AisensySettings> = {};
  if (!apiKey) {
    const fromEnv = envFallbackKey();
    if (fromEnv) {
      apiKey = fromEnv;
      patches.apiKey = fromEnv;
    }
  }
  if (!otpCampaignName) {
    const fromEnv = envFallbackOtpCampaign();
    if (fromEnv) {
      otpCampaignName = fromEnv;
      patches.otpCampaignName = fromEnv;
    }
  }
  if (Object.keys(patches).length > 0) {
    row = await prisma.aisensyConfig.update({
      where: { id: AISENSY_CONFIG_ID },
      data: patches,
    });
  }

  return {
    apiKey,
    otpCampaignName,
    reminderCampaignName: row.reminderCampaignName?.trim() || null,
    completeCampaignName: row.completeCampaignName?.trim() || null,
  };
}

export async function updateAisensySettings(
  input: Partial<AisensySettings> & { apiKey?: string | null },
): Promise<AisensySettings> {
  const data: Record<string, string | null | undefined> = {};

  if (input.apiKey !== undefined) {
    const trimmed = input.apiKey?.trim();
    data.apiKey = trimmed || null;
  }
  if (input.otpCampaignName !== undefined) {
    const trimmed = input.otpCampaignName?.trim();
    data.otpCampaignName = trimmed || null;
  }
  if (input.reminderCampaignName !== undefined) {
    const trimmed = input.reminderCampaignName?.trim();
    data.reminderCampaignName = trimmed || null;
  }
  if (input.completeCampaignName !== undefined) {
    const trimmed = input.completeCampaignName?.trim();
    data.completeCampaignName = trimmed || null;
  }

  await prisma.aisensyConfig.upsert({
    where: { id: AISENSY_CONFIG_ID },
    create: { id: AISENSY_CONFIG_ID, ...data },
    update: data,
  });

  return getAisensySettings();
}

export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "••••••••";
  return `${"•".repeat(Math.min(12, value.length - 4))}${value.slice(-4)}`;
}

export async function isAisensyOtpConfigured(): Promise<boolean> {
  const settings = await getAisensySettings();
  return Boolean(settings.apiKey && settings.otpCampaignName);
}
