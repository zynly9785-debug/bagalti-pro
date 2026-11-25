export function normalizePhoneForAuth(value: string): string {
  const trimmed = value.trim().replace(/[\s().-]/g, '');
  let normalized: string;
  if (trimmed.startsWith('+')) normalized = `+${trimmed.slice(1).replace(/\D/g, '')}`;
  else if (trimmed.startsWith('00')) normalized = `+${trimmed.slice(2).replace(/\D/g, '')}`;
  else {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('967')) normalized = `+${digits}`;
    else if (digits.startsWith('0')) normalized = `+967${digits.slice(1)}`;
    else normalized = `+967${digits}`;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw new Error('أدخل رقم هاتف صحيحاً مع رمز الدولة أو كرقم يمني محلي.');
  return normalized;
}

/** Supabase needs email or a phone provider verified by SMS. If the merchant chooses no OTP,
 * keep the real phone as their login ID in the UI and use this non-deliverable internal alias. */
export function authAliasForPhone(value: string): string {
  const digits = normalizePhoneForAuth(value).slice(1);
  return `p${digits}@login.baqalati-pro.app`;
}
