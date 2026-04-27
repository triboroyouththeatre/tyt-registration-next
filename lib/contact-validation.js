/**
 * Validates contacts and participants for duplicate phone/email/name conflicts.
 * Returns an array of error strings. Empty array = no errors.
 *
 * @param {object} params
 * @param {Array} params.guardians - priority 1 & 2 contacts
 * @param {Array} params.emergencyContacts - priority 3 & 4 contacts
 * @param {Array} params.participants - participant records
 */
export function validateContacts({ guardians = [], emergencyContacts = [], participants = [] }) {
  const errors = [];

  const guardianPhones = guardians.map(g => g.phone).filter(Boolean);
  const guardianEmails = guardians.map(g => g.email).filter(Boolean).map(e => e.toLowerCase());
  const guardianNames = guardians.map(g => `${g.first_name} ${g.last_name}`.toLowerCase().trim());

  // Participant phone/email must not match any guardian
  for (const p of participants) {
    if (p.phone && guardianPhones.includes(p.phone)) {
      errors.push(`Participant ${p.first_name} ${p.last_name}'s phone number matches a parent/guardian. Participant contact information must be different from parent/guardian contact information.`);
    }
    if (p.email && guardianEmails.includes(p.email.toLowerCase())) {
      errors.push(`Participant ${p.first_name} ${p.last_name}'s email address matches a parent/guardian. Participant contact information must be different from parent/guardian contact information.`);
    }
  }

  // Emergency contact phone/name must not match any guardian
  for (const ec of emergencyContacts) {
    if (!ec.first_name && !ec.last_name && !ec.phone) continue; // skip empty slots

    const ecName = `${ec.first_name} ${ec.last_name}`.toLowerCase().trim();
    const ecLabel = `${ec.first_name} ${ec.last_name}`;

    if (ec.phone && guardianPhones.includes(ec.phone)) {
      errors.push(`Emergency contact ${ecLabel}'s phone number matches a parent/guardian. Emergency contacts must have different contact information from parent/guardians.`);
    }
    if (ecName && guardianNames.includes(ecName)) {
      errors.push(`Emergency contact ${ecLabel} appears to be the same person as a parent/guardian. Emergency contacts must be different people.`);
    }
  }

  // Emergency contacts must not duplicate each other
  if (emergencyContacts.length === 2) {
    const ec1 = emergencyContacts[0];
    const ec2 = emergencyContacts[1];
    if (!ec2.first_name && !ec2.last_name && !ec2.phone) return errors; // ec2 empty

    const name1 = `${ec1.first_name} ${ec1.last_name}`.toLowerCase().trim();
    const name2 = `${ec2.first_name} ${ec2.last_name}`.toLowerCase().trim();

    if (ec1.phone && ec2.phone && ec1.phone === ec2.phone) {
      errors.push('Your two emergency contacts have the same phone number. Please enter different contact information for each.');
    }
    if (name1 && name2 && name1 === name2) {
      errors.push('Your two emergency contacts appear to be the same person. Please enter different people for each emergency contact.');
    }
  }

  return errors;
}