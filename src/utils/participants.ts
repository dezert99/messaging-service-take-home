/**
 * Normalize participants to ensure consistent ordering for database lookups
 * Always returns [smaller, larger] when sorted lexicographically
 * This ensures bidirectional messages (A→B and B→A) belong to the same conversation
 */
export function normalizeParticipants(from: string, to: string): [string, string] {
  return from < to ? [from, to] : [to, from];
}

/**
 * Check if a participant identifier appears to be an email address
 */
export function isEmailAddress(participant: string): boolean {
  return participant.includes('@');
}

/**
 * Check if a participant identifier appears to be a phone number
 */
export function isPhoneNumber(participant: string): boolean {
  return participant.startsWith('+') || /^\d+$/.test(participant);
}

/**
 * Validate that two participants can have a conversation
 * (basic validation - both should be same type: email or phone)
 */
export function validateParticipants(from: string, to: string): boolean {
  const fromIsEmail = isEmailAddress(from);
  const toIsEmail = isEmailAddress(to);
  
  // Both should be emails or both should be phone numbers
  return fromIsEmail === toIsEmail;
}