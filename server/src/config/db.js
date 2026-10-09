const prismaBase = require("./prismaBase");
const { NOT_TRASHED } = require("../utils/trashStatus");

// Applications in the Trash are invisible to the rest of the app — lists, counts, look-ups and
// updates all behave as if they were deleted. Every KycApplication query gets "status is not
// trashed" added to its filter. (Nested `kycApplications` includes on User are filtered where
// they are written.) The Trash module reads them through config/prismaBase.js.
const withNotTrashed = (where) => {
  const w = where || {};
  const and = w.AND === undefined ? [] : Array.isArray(w.AND) ? w.AND : [w.AND];
  return { ...w, AND: [...and, NOT_TRASHED] };
};

const FILTERED_OPERATIONS = [
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany",
  "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany",
];

const prisma = prismaBase.$extends({
  name: "hideTrashedApplications",
  query: {
    kycApplication: Object.fromEntries(
      FILTERED_OPERATIONS.map((operation) => [
        operation,
        ({ args, query }) => query({ ...(args || {}), where: withNotTrashed(args?.where) }),
      ])
    ),
  },
});

module.exports = prisma;
