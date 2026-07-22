import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const SUPABASE_URL = process.env["SUPABASE_URL"] || "https://ejyuncafwhdwrrenqoyi.supabase.co";
const SUPABASE_KEY = process.env["SUPABASE_KEY"];

if (!SUPABASE_KEY) {
  console.warn("⚠️ [Licensing] SUPABASE_KEY no configurada. La validacion de licencias fallara.");
}

const dataDir = path.join(process.cwd(), "data");
const licenseFilePath = path.join(dataDir, "license.json");

export interface LicenseInfo {
  key: string;
  hwid: string;
  activatedAt: string;
}

export let isActivated = false;
export let activeLicenseKey = "";

export function getMachineId(): string {
  try {
    let rawId = "";
    if (process.platform === "win32") {
      const output = execSync("wmic csproduct get uuid").toString();
      rawId = output.replace("UUID", "").trim();
    } else {
      try {
        rawId = execSync("cat /etc/machine-id").toString().trim();
      } catch {
        try {
          rawId = execSync("cat /sys/class/dmi/id/product_uuid").toString().trim();
        } catch {
          rawId = process.env["COMPUTERNAME"] || process.env["HOSTNAME"] || "generic-host";
        }
      }
    }
    if (!rawId || rawId.length < 5) {
      rawId = `${process.platform}-${process.arch}-${process.env["COMPUTERNAME"] || process.env["HOSTNAME"] || "unknown"}`;
    }
    return crypto.createHash("sha256").update(rawId).digest("hex");
  } catch (e) {
    const fallback = `${process.platform}-${process.arch}-${process.env["COMPUTERNAME"] || process.env["HOSTNAME"] || "fallback"}`;
    return crypto.createHash("sha256").update(fallback).digest("hex");
  }
}

export async function initializeLicenseCheck(): Promise<boolean> {
  try {
    if (!fs.existsSync(licenseFilePath)) {
      console.log("🔑 [Licensing] No se encontro el archivo de licencia. Activacion requerida.");
      isActivated = false;
      return false;
    }
    const fileContent = fs.readFileSync(licenseFilePath, "utf-8");
    const licenseInfo = JSON.parse(fileContent) as LicenseInfo;
    const currentHwid = getMachineId();
    if (licenseInfo.hwid !== currentHwid) {
      console.warn("🔑 [Licensing] HWID no coincide. Reactivacion requerida.");
      isActivated = false;
      return false;
    }
    console.log("🔑 [Licensing] Verificando licencia guardada en Supabase...");
    const verified = await checkOnlineLicense(licenseInfo.key, currentHwid);
    if (verified) {
      console.log("🔑 [Licensing] Licencia verificada y valida.");
      isActivated = true;
      activeLicenseKey = licenseInfo.key;
      return true;
    } else {
      console.warn("🔑 [Licensing] La licencia online ya no es valida.");
      isActivated = false;
      return false;
    }
  } catch (err) {
    console.error("🔑 [Licensing] Error al inicializar verificacion:", err);
    isActivated = false;
    return false;
  }
}

async function checkOnlineLicense(key: string, hwid: string): Promise<boolean> {
  if (!SUPABASE_KEY) return false;
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/verify_license`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ p_key: key, p_hwid: hwid })
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { success: boolean; message: string }[];
    return !!(data && data.length > 0 && data[0]?.success);
  } catch (err) {
    console.error("🔑 [Licensing] Error de conexion a Supabase:", err);
    return fs.existsSync(licenseFilePath);
  }
}

export async function activateLicense(key: string): Promise<{ success: boolean; message: string }> {
  if (!SUPABASE_KEY) return { success: false, message: "SUPABASE_KEY no configurada" };
  try {
    const hwid = getMachineId();
    const url = `${SUPABASE_URL}/rest/v1/rpc/verify_license`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ p_key: key, p_hwid: hwid })
    });
    if (!response.ok) {
      return { success: false, message: `Error de servidor (HTTP ${response.status})` };
    }
    const data = (await response.json()) as { success: boolean; message: string }[];
    if (data && data.length > 0 && data[0]?.success) {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const licenseInfo: LicenseInfo = { key, hwid, activatedAt: new Date().toISOString() };
      fs.writeFileSync(licenseFilePath, JSON.stringify(licenseInfo, null, 2), "utf-8");
      isActivated = true;
      activeLicenseKey = key;
      return { success: true, message: data[0]?.message || "Activacion exitosa" };
    }
    return { success: false, message: (data && data[0]?.message) || "Error al validar clave." };
  } catch (err) {
    return { success: false, message: `Error de conexion: ${(err as Error).message}` };
  }
}

export async function updateLicenseOwner(ownerUsername: string): Promise<boolean> {
  if (!SUPABASE_KEY) return false;
  try {
    const key = activeLicenseKey || (fs.existsSync(licenseFilePath) ? JSON.parse(fs.readFileSync(licenseFilePath, "utf-8")).key : "");
    if (!key) return false;
    const url = `${SUPABASE_URL}/rest/v1/licenses?key=eq.${key}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({ owner: ownerUsername })
    });
    return response.ok;
  } catch (err) {
    return false;
  }
}
