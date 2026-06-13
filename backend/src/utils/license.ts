import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const SUPABASE_URL = process.env["SUPABASE_URL"] || "https://ejyuncafwhdwrrenqoyi.supabase.co";
const SUPABASE_KEY = process.env["SUPABASE_KEY"] || "sb_secret_D2vjZXmnXQOB-s5fChovZg_obcpHlol";

const dataDir = path.join(process.cwd(), "data");
const licenseFilePath = path.join(dataDir, "license.json");

export interface LicenseInfo {
  key: string;
  hwid: string;
  activatedAt: string;
}

export let isActivated = false;
export let activeLicenseKey = "";

/**
 * Gets a unique hashed hardware ID (HWID) based on machine UUID.
 */
export function getMachineId(): string {
  try {
    let rawId = "";
    if (process.platform === "win32") {
      const output = execSync("wmic csproduct get uuid").toString();
      rawId = output.replace("UUID", "").trim();
    } else {
      // Linux / macOS
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

/**
 * Checks if a valid license file exists and queries Supabase to verify it.
 */
export async function initializeLicenseCheck(): Promise<boolean> {
  try {
    if (!fs.existsSync(licenseFilePath)) {
      console.log("🔑 [Licensing] No se encontró el archivo de licencia. Activación requerida.");
      isActivated = false;
      return false;
    }

    const fileContent = fs.readFileSync(licenseFilePath, "utf-8");
    const licenseInfo = JSON.parse(fileContent) as LicenseInfo;
    const currentHwid = getMachineId();

    if (licenseInfo.hwid !== currentHwid) {
      console.warn("🔑 [Licensing] El HWID guardado no coincide con el actual. Reactivación requerida.");
      isActivated = false;
      return false;
    }

    // Verify online against Supabase
    console.log("🔑 [Licensing] Verificando licencia guardada en Supabase...");
    const verified = await checkOnlineLicense(licenseInfo.key, currentHwid);
    if (verified) {
      console.log("🔑 [Licensing] Licencia verificada y válida.");
      isActivated = true;
      activeLicenseKey = licenseInfo.key;
      return true;
    } else {
      console.warn("🔑 [Licensing] La licencia online ya no es válida o está suspendida.");
      isActivated = false;
      return false;
    }
  } catch (err) {
    console.error("🔑 [Licensing] Error al inicializar verificación de licencia:", err);
    isActivated = false;
    return false;
  }
}

/**
 * Checks license key against Supabase RPC.
 */
async function checkOnlineLicense(key: string, hwid: string): Promise<boolean> {
  try {
    const url = `${SUPABASE_URL}/rest/v1/rpc/verify_license`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        p_key: key,
        p_hwid: hwid
      })
    });

    if (!response.ok) {
      console.error("🔑 [Licensing] HTTP error checking license:", response.status, response.statusText);
      return false;
    }

    const data = (await response.json()) as { success: boolean; message: string }[];
    if (data && data.length > 0 && data[0]?.success) {
      return true;
    }
    console.warn("🔑 [Licensing] Supabase reject:", data && data[0]?.message);
    return false;
  } catch (err) {
    console.error("🔑 [Licensing] Connection error to Supabase:", err);
    // If Supabase is offline but we already had a local license, fallback to true so the app is robust.
    return fs.existsSync(licenseFilePath);
  }
}

/**
 * Activates a new key and saves it locally.
 */
export async function activateLicense(key: string): Promise<{ success: boolean; message: string }> {
  try {
    const hwid = getMachineId();
    console.log(`🔑 [Licensing] Intentando activar clave: ${key} con HWID: ${hwid}`);

    const url = `${SUPABASE_URL}/rest/v1/rpc/verify_license`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        p_key: key,
        p_hwid: hwid
      })
    });

    if (!response.ok) {
      return { success: false, message: `Error de servidor de licencias (HTTP ${response.status})` };
    }

    const data = (await response.json()) as { success: boolean; message: string }[];
    if (data && data.length > 0 && data[0]?.success) {
      // Save license locally
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const licenseInfo: LicenseInfo = {
        key,
        hwid,
        activatedAt: new Date().toISOString()
      };

      fs.writeFileSync(licenseFilePath, JSON.stringify(licenseInfo, null, 2), "utf-8");
      isActivated = true;
      activeLicenseKey = key;
      return { success: true, message: data[0]?.message || "Activación exitosa" };
    }

    return { success: false, message: (data && data[0]?.message) || "Error desconocido al validar clave." };
  } catch (err) {
    console.error("🔑 [Licensing] Error al activar licencia:", err);
    return { success: false, message: `Error de conexión: ${(err as any).message}` };
  }
}

/**
 * Updates the license owner field in Supabase.
 */
export async function updateLicenseOwner(ownerUsername: string): Promise<boolean> {
  try {
    const key = activeLicenseKey || (fs.existsSync(licenseFilePath) ? JSON.parse(fs.readFileSync(licenseFilePath, "utf-8")).key : "");
    if (!key) {
      console.warn("🔑 [Licensing] No se encontró clave activa para actualizar el propietario.");
      return false;
    }

    console.log(`🔑 [Licensing] Actualizando propietario de la licencia a '${ownerUsername}' en Supabase...`);
    const url = `${SUPABASE_URL}/rest/v1/licenses?key=eq.${key}`;
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        owner: ownerUsername
      })
    });

    if (!response.ok) {
      console.error("🔑 [Licensing] Error actualizando propietario en Supabase:", response.status, response.statusText);
      return false;
    }

    console.log("🔑 [Licensing] Propietario de la licencia actualizado con éxito en Supabase.");
    return true;
  } catch (err) {
    console.error("🔑 [Licensing] Error al conectar con Supabase para actualizar propietario:", err);
    return false;
  }
}
