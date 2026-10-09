// A KYC application deleted from the admin / Globe portal goes to the Trash instead of being removed:
// its status becomes TRASH_STATUS and stepStatuses[TRASH_KEY] keeps what is needed to restore it
// ({ previousStatus, deletedAt, deletedBy, deletedById, deletedByRole }).
// The shared Prisma client (config/db.js) hides trashed applications from every query, so they
// behave as deleted everywhere; only the Trash screens read them (through config/prismaBase.js).
const TRASH_STATUS = "trashed";
const TRASH_KEY = "_trash";
const NOT_TRASHED = { status: { not: TRASH_STATUS } };

module.exports = { TRASH_STATUS, TRASH_KEY, NOT_TRASHED };
