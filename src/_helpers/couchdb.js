/* Utility helpers for CouchDB
*/

/* RETURN: boolean whether object name indicates it is a CouchDB design object
===================================================================================================== */
exports.isDesignObject = objectName => objectName.startsWith('_');

