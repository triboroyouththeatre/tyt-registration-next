// ── Shared UUID constants ─────────────────────────────────────────────────────
// Single source of truth for all status/type IDs that are referenced across
// multiple files. If a value ever changes, update it here only.

// Registration statuses
export const REGISTRATION_STATUS_PENDING   = '448779d0-8e45-47e1-b653-37d8fb16eb20';
export const REGISTRATION_STATUS_ACTIVE    = 'd3ae5075-819c-41e2-a685-bbfaea5171b1';
export const REGISTRATION_STATUS_CANCELLED = '1878c625-8ce3-472c-b6d1-b84fdb04d90b';

// Payment statuses
export const PAYMENT_STATUS_PENDING  = '92d4b30c-799e-43ba-83e1-f7989d95f612';
export const PAYMENT_STATUS_PAID     = '7009f776-f127-4f74-8c48-0efec65316a8';
export const PAYMENT_STATUS_OVERDUE  = '62d6b52c-e975-4701-b82a-0873d2cf6343';

// Payment types
export const PAYMENT_TYPE_DEPOSIT  = '57347d8e-8b1f-4beb-8bdd-b706fa9bc5a2';
export const PAYMENT_TYPE_FULL     = '78cdca58-6a51-4a89-9f61-ff2eb1d62faf';
export const PAYMENT_TYPE_REFUND   = '4f51031a-e6ec-464a-9aaa-77279bd09ec9';

// Award levels
export const AWARD_LEVEL_NO_AWARD = '386e44d8-0a4d-4462-85f1-adaa8231a287';