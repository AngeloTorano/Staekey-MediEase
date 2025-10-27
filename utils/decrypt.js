// utils/decrypt.js
import CryptoJS from "crypto-js";

const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY // Must match backend

export function decryptObject(encryptedText) {
  try {
    const [ivHex, encryptedHex] = encryptedText.split(":");
    const iv = CryptoJS.enc.Hex.parse(ivHex);
    const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);

    // Try HEX first
    let decrypted = CryptoJS.AES.decrypt(
      { ciphertext: CryptoJS.enc.Hex.parse(encryptedHex) },
      key,
      { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
    );
    let decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);

    // If HEX fails, try BASE64
    if (!decryptedStr) {
      decrypted = CryptoJS.AES.decrypt(
        { ciphertext: CryptoJS.enc.Base64.parse(encryptedHex) },
        key,
        { iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 }
      );
      decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
    }

    if (!decryptedStr) throw new Error("Decryption produced empty string");
    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt data");
  }
}
