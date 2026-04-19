import { type Collects, mergeCollects } from "../../core";
import * as vscode from "vscode";

export const hash_mode_collects: Collects = {
  HASHCAT_MODE_WORDLIST: "0",
  HASHCAT_MODE_COMBINATION: "1",
  HASHCAT_MODE_TOGGLE_CASE: "2",
  HASHCAT_MODE_MASK_BRUTE_FORCE: "3",
  HASHCAT_MODE_WORDLIST_MASK: "6",
  HASHCAT_MODE_MASK_WORDLIST: "7",
};

export const hash_device_collects: Collects = {
  HASHCAT_DEVICE_GPU: "2",
  HASHCAT_DEVICE_CPU: "1",
  HASHCAT_DEVICE_FPGA: "3",
};

export const hash_type_collects: Collects = {
  HASH_MD5: "0",
  HASH_SHA1: "100",
  HASH_MD5CYPT: "500",
  HASH_MD4: "900",
  HASH_NTLM: "1000",
  HASH_SHA256: "1400",
  HASH_APRMD5: "1600",
  HASH_SHA512: "1800",
  HASH_BCRYPT: "3200",
  HASH_NETNTLMv2: "5600",
  HASH_SHA256CRYPT: "7400",
  HASH_KRB5_PA_23: "7500",
  HASH_KRB5_PA_17: "19800",
  HASH_KRB5_PA_18: "19900",
  HASH_DJANGO_PBKDF2_SHA256: "10000",
  HASH_PBKDF2_HMAC_SHA256: "10900",
  HASH_KRB5_TGS_23: "13100",
  HASH_KRB5_TGS_17: "19600",
  HASH_KRB5_TGS_18: "19700",
  HASH_JWT: "16500",
  HASH_KRB5_AS_REP_23: "18200",
  HASH_KRB5_AS_REP_17: "19500",
  HASH_KRB5_AS_REP_18: "19700",
};

const hash_collects: Collects = mergeCollects(
  hash_mode_collects,
  hash_device_collects,
  hash_type_collects
);

export function getDefaultCollects(): Collects {
  const config = vscode.workspace.getConfiguration("weaponized");
  const weapon_config_collects: Collects = {
    LHOST: config.get("lhost", "LHOST"),
    LPORT: String(config.get("lport") || "6789"),
    LISTEN_ON: String(config.get("listenon") || "8890"),
  };
  const weapon_envs: Collects = config.get("envs") || {};
  return mergeCollects(hash_collects, weapon_config_collects, weapon_envs);
}

// Backward-compat: keep the old name for hashcat.ts
export const defaultCollects: Collects = getDefaultCollects();
